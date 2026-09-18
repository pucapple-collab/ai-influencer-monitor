import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { PROJECT_STATUS_ID } from "../../lib/project-status";
import { supabase } from "../../lib/supabase";
import { getAIProviders } from "../../lib/ai/providers";

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

    const localCharacters = await readRuntimeJson<
      Array<{ status?: string }>
    >("characters.json", []);

    const localContentJobs = await readRuntimeJson<
      Array<{ status?: string; approval?: string }>
    >("content-jobs.json", []);

    const aiProviders = getAIProviders();

    const aiConnectedCount = aiProviders.filter(
      (provider) => provider.status === "CONFIGURED"
    ).length;

    const aiNotConnectedCount = aiProviders.filter(
      (provider) => provider.status === "NOT_CONNECTED"
    ).length;

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
        (job) => job.status === "generating"
      ).length,
      published: localContentJobs.filter(
        (job) => job.status === "published"
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
        completedTaskCount: completedTasks.length,
        actionableTaskCount: actionableTotal,
        waitingTaskCount: waitingTasks.length,
        serviceCount: services.length,
        activeServiceCount: activeServices.length,
        serviceProgress,
        localInfluencerCount: localOperations.influencers,
        localContentJobCount: localOperations.contentJobs,
        approvedContentCount: localOperations.approvedContent,
        aiExecutionCost: 0,
        paidServiceRequired: false,
      },

      localOperations,
      ai: {
        providers: aiProviders,
        connectedCount: aiConnectedCount,
        notConnectedCount: aiNotConnectedCount,
        paidRequired: false,
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
