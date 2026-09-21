import { NextRequest, NextResponse } from "next/server";
import { getContentJob } from "../../lib/local-content-jobs";
import { simulateFactoryPipeline } from "../../lib/ai/factory-pipeline";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const jobId = String(body.jobId ?? "").trim();
    if (!jobId) return NextResponse.json({ ok: false, error: "jobId required." }, { status: 400 });

    const job = await getContentJob(jobId);
    if (!job) return NextResponse.json({ ok: false, error: "Content job not found." }, { status: 404 });
    if (String(job.approval ?? "pending").toLowerCase() !== "approved" || String(job.status).toLowerCase() !== "ready") {
      return NextResponse.json({ ok: false, status: "BLOCKED", externalCallMade: false, actualCost: 0, error: "Job must be approved and ready." }, { status: 409 });
    }

    const prompt = String(body.prompt ?? job.prompt ?? job.script ?? "").trim();
    const result = simulateFactoryPipeline(prompt);
    return NextResponse.json({ ok: true, jobId, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, externalCallMade: false, actualCost: 0, error: error instanceof Error ? error.message : "Factory dry-run failed." }, { status: 400 });
  }
}
