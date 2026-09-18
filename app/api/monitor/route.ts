import { NextResponse } from "next/server";
import { PROJECT_STATUS_ID } from "../../lib/project-status";
import { supabase } from "../../lib/supabase";

export async function GET() {
  try {
    const [servicesResult, tasksResult, errorsResult, runsResult] =
      await Promise.all([
        supabase
          .from("services")
          .select(
            "service_id,name,role,status,progress,current_job,next_action,usage_today,usage_month,quota,updated_at"
          )
          .order("service_id"),

        supabase
          .from("setup_tasks")
          .select(
            "task_id,service_id,title,status,evidence_url,required_input,blocked_reason,updated_at"
          )
          .order("updated_at", { ascending: false }),

        supabase
          .from("system_errors")
          .select(
            "error_id,service_id,workflow_id,severity,message,first_seen,last_seen,resolved"
          )
          .eq("resolved", false)
          .order("last_seen", { ascending: false }),

        supabase
          .from("workflow_runs")
          .select(
            "run_id,workflow_id,service_id,character_id,status,started_at,finished_at,retry_count,estimated_cost,actual_cost,error,created_at"
          )
          .in("status", ["queued", "running"])
          .order("created_at", { ascending: false }),
      ]);

    if (servicesResult.error) throw servicesResult.error;
    if (tasksResult.error) throw tasksResult.error;
    if (errorsResult.error) throw errorsResult.error;
    if (runsResult.error) throw runsResult.error;

    const services = servicesResult.data ?? [];
    const projectStatus = (tasksResult.data ?? []).find(
      (task) => task.task_id === PROJECT_STATUS_ID
    ) ?? null;
    const tasks = (tasksResult.data ?? []).filter(
      (task) => task.task_id !== PROJECT_STATUS_ID
    );
    const errors = errorsResult.data ?? [];
    const runs = runsResult.data ?? [];

    const activeServices = services.filter((service) =>
      ["ready", "running", "completed"].includes(service.status)
    );

    const averageProgress =
      services.length > 0
        ? Math.round(
            services.reduce(
              (total, service) => total + (service.progress ?? 0),
              0
            ) / services.length
          )
        : 0;

    const blockedTasks = tasks.filter(
      (task) => task.status === "blocked"
    );

    const pendingTasks = tasks.filter(
      (task) => task.status === "pending"
    );

    const waitingTasks = tasks.filter(
      (task) => task.status === "waiting"
    );

    // Only actionable tasks can be NEXT; waiting and finished tasks stay listed.
    const latestTask = pendingTasks[0] ?? blockedTasks[0] ?? null;

    const latestError = errors[0] ?? null;

    let status = "READY";
    let message = "현재 시스템이 정상적으로 작동하고 있어요.";

    if (latestError) {
      status = latestError.severity === "critical" ? "CRITICAL" : "ERROR";
      message = latestError.message;
    } else if (blockedTasks.length > 0) {
      status = "BLOCKED";
      message =
        blockedTasks[0].blocked_reason ??
        `${blockedTasks[0].title} 작업이 진행을 기다리고 있어요.`;
    } else if (runs.length > 0) {
      status = "RUNNING";
      message = `${runs.length}개의 작업이 현재 실행 중이에요.`;
    } else if (latestTask) {
      status = "NEXT";
      message = `다음 작업: ${latestTask.title}`;
    }

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),

      summary: {
        status,
        message,
        serviceCount: services.length,
        activeServiceCount: activeServices.length,
        averageProgress,
        pendingTaskCount: pendingTasks.length,
        waitingTaskCount: waitingTasks.length,
        blockedTaskCount: blockedTasks.length,
        openErrorCount: errors.length,
        runningWorkflowCount: runs.length,
      },

      projectStatus,
      latestTask,
      latestError,
      services,
      tasks,
      errors,
      runningWorkflows: runs,
    });
  } catch (error) {
    console.error("Monitor API error:", error);

    return NextResponse.json(
      {
        ok: false,
        timestamp: new Date().toISOString(),
        error:
          error instanceof Error
            ? error.message
            : "Monitor API에서 알 수 없는 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
