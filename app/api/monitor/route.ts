import { NextResponse } from "next/server";
import { PROJECT_STATUS_ID } from "../../lib/project-status";
import { supabase } from "../../lib/supabase";

export async function GET() {
  try {
    const [servicesResult, tasksResult] = await Promise.all([
      supabase
        .from("services")
        .select("service_id,name,role,status,progress,current_job,next_action,usage_today,usage_month,quota,updated_at")
        .order("service_id"),

      supabase
        .from("setup_tasks")
        .select("task_id,service_id,title,status,evidence_url,required_input,blocked_reason,updated_at")
        .order("updated_at", { ascending: false }),
    ]);

    if (servicesResult.error) throw servicesResult.error;
    if (tasksResult.error) throw tasksResult.error;

    const services = servicesResult.data ?? [];
    const allTasks = tasksResult.data ?? [];

    const projectStatus =
      allTasks.find((task) => task.task_id === PROJECT_STATUS_ID) ?? null;

    const tasks = allTasks.filter(
      (task) => task.task_id !== PROJECT_STATUS_ID
    );

    const completedTasks = tasks.filter((task) =>
      ["completed", "ready", "done"].includes(task.status)
    );

    const pendingTasks = tasks.filter((task) => task.status === "pending");
    const blockedTasks = tasks.filter((task) => task.status === "blocked");
    const waitingTasks = tasks.filter((task) => task.status === "waiting");

    // Deferred external integrations do not reduce core construction progress.
    const actionableTotal =
      completedTasks.length + pendingTasks.length + blockedTasks.length;

    const factoryProgress =
      actionableTotal > 0
        ? Math.round((completedTasks.length / actionableTotal) * 100)
        : completedTasks.length > 0
          ? 100
          : 0;

    const activeServices = services.filter((service) =>
      ["ready", "running", "completed", "active"].includes(service.status)
    );

    const serviceProgress =
      services.length > 0
        ? Math.round(
            services.reduce(
              (total, service) => total + (service.progress ?? 0),
              0
            ) / services.length
          )
        : 0;

    let status = "READY";
    let message = "Factory core is online.";

    if (blockedTasks.length) {
      status = "BLOCKED";
      message =
        blockedTasks[0].blocked_reason ??
        `${blockedTasks[0].title} is blocked.`;
    } else if (pendingTasks.length) {
      status = "NEXT";
      message = `Next: ${pendingTasks[0].title}`;
    }

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      summary: {
        status,
        message,
        factoryProgress,
        completedTaskCount: completedTasks.length,
        actionableTaskCount: actionableTotal,
        waitingTaskCount: waitingTasks.length,
        serviceCount: services.length,
        activeServiceCount: activeServices.length,
        serviceProgress,
      },
      operations: {
        characters: { status: "LOCKED", count: null },
        workflows: { status: "LOCKED", count: null },
        approvals: { status: "LOCKED", count: null },
        usage: { status: "LOCKED", count: null },
        errors: { status: "LOCKED", count: null },
      },
      projectStatus,
      latestTask: pendingTasks[0] ?? blockedTasks[0] ?? null,
      services,
      tasks,
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
            : "Unknown monitor API error.",
      },
      { status: 500 }
    );
  }
}
