import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { PROJECT_STATUS_ID } from "../../lib/project-status";
import { supabase, supabaseConfigured } from "../../lib/supabase";
import { getAIProviders } from "../../lib/ai/providers";
import { getExecutions } from "../../lib/ai/execution-store";

async function readRuntimeJson<T>(name: string, fallback: T): Promise<T> {
  try {
    const file = path.join(process.cwd(), "runtime", name);
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export async function GET() {
  try {
    if (!supabaseConfigured) {
      return NextResponse.json({
        ok: false,
        status: "CONFIG_REQUIRED",
        timestamp: new Date().toISOString(),
        externalCallMade: false,
        error: "Supabase environment variables are not configured for this deployment.",
      }, { status: 503 });
    }
    const [servicesResult, tasksResult] = await Promise.all([
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

    const actionableTotal =
      completedTasks.length + pendingTasks.length + blockedTasks.length;

    const aiProviders = getAIProviders();

    const aiProvidersReady = () =>
      aiProviders.some((provider) => provider.status === "CONFIGURED");

    const coreSteps = [
      { id: "project", ready: true, title: "Project" },
      { id: "next", ready: true, title: "Next.js" },
      { id: "dashboard", ready: true, title: "Dashboard" },
      { id: "characters", ready: true, title: "Characters" },
      { id: "data", ready: true, title: "Data Model" },
      {
        id: "database",
        ready: Boolean(projectStatus && projectStatus.status !== "pending"),
        title: "Database",
      },
      {
        id: "image-ai",
        ready: aiProvidersReady(),
        title: "Image AI",
      },
      {
        id: "video-ai",
        ready: aiProvidersReady(),
        title: "Video AI",
      },
      {
        id: "publishing",
        ready: false,
        title: "Publishing",
      },
    ];

    const factoryProgress = Math.round(
      (coreSteps.filter((step) => step.ready).length / coreSteps.length) * 100
    );

    const nextMission =
      coreSteps.find((step) => !step.ready)?.title ?? "Factory operational";

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

    const localCharacters = await readRuntimeJson<
      Array<{ status?: string }>
    >("characters.json", []);

    const localContentJobs = await readRuntimeJson<
      Array<{ status?: string; approval?: string }>
    >("content-jobs.json", []);



    const aiConnectedCount = aiProviders.filter(
      (provider) => provider.status === "CONFIGURED"
    ).length;

    const aiNotConnectedCount = aiProviders.filter(
      (provider) => provider.status === "NOT_CONNECTED"
    ).length;

    const executions = await getExecutions();

    const executionSummary = {
      total: executions.length,
      completed: executions.filter(
        (execution) => execution.status === "COMPLETED"
      ).length,
      blocked: executions.filter(
        (execution) => execution.status === "BLOCKED"
      ).length,
      errors: executions.filter(
        (execution) => execution.status === "ERROR"
      ).length,
      queued: executions.filter(
        (execution) => execution.status === "QUEUED"
      ).length,
      estimatedCost: executions.reduce(
        (sum, execution) => sum + (execution.estimatedCost || 0),
        0
      ),
      actualCost: executions.reduce(
        (sum, execution) => sum + (execution.actualCost || 0),
        0
      ),
    };

    const localOperations = {
      influencers: localCharacters.length,
      contentJobs: localContentJobs.length,
      approvedContent: localContentJobs.filter(
        (job) => job.approval === "approved"
      ).length,
      pendingApproval: localContentJobs.filter(
        (job) => !job.approval || job.approval === "pending"
      ).length,
      generating: localContentJobs.filter(
        (job) => String(job.status ?? "").toLowerCase() === "generating"
      ).length,
      review: localContentJobs.filter(
        (job) => String(job.status ?? "").toLowerCase() === "review"
      ).length,
      published: localContentJobs.filter(
        (job) => String(job.status ?? "").toLowerCase() === "published"
      ).length,
    };

    let status = "READY";
    let message = "Factory core is online.";

    if (blockedTasks.length > 0) {
      status = "BLOCKED";
      message =
        blockedTasks[0].blocked_reason ??
        `${blockedTasks[0].title} is blocked.`;
    } else if (pendingTasks.length > 0) {
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
        nextMission,
        coreReadyCount: coreSteps.filter((step) => step.ready).length,
        coreStepCount: coreSteps.length,
        completedTaskCount: completedTasks.length,
        actionableTaskCount: actionableTotal,
        waitingTaskCount: waitingTasks.length,
        serviceCount: services.length,
        activeServiceCount: activeServices.length,
        serviceProgress,
        localInfluencerCount: localOperations.influencers,
        localContentJobCount: localOperations.contentJobs,
        approvedContentCount: localOperations.approvedContent,
        aiExecutionCost: executionSummary.actualCost,
        paidServiceRequired: false,
        aiConnectedCount,
        aiNotConnectedCount,
        aiExecutionCount: executionSummary.total,
        aiCompletedCount: executionSummary.completed,
        aiBlockedCount: executionSummary.blocked,
        aiErrorCount: executionSummary.errors,
        aiQueuedCount: executionSummary.queued,
        aiEstimatedCost: executionSummary.estimatedCost,
        aiActualCost: executionSummary.actualCost,

      },

      coreSteps,
      localOperations,
      ai: {
        providers: aiProviders,
        connectedCount: aiConnectedCount,
        notConnectedCount: aiNotConnectedCount,
        paidRequired: false,
        executions: executionSummary,
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
