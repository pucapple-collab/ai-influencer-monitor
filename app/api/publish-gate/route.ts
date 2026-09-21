import { NextRequest, NextResponse } from "next/server";
import { getContentJob, patchContentJob } from "../../lib/local-content-jobs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const jobId = String(body.jobId ?? "").trim();
    const mode = String(body.mode ?? "dry_run").toLowerCase();
    if (!jobId) return NextResponse.json({ ok: false, error: "jobId required." }, { status: 400 });
    if (!["dry_run", "real"].includes(mode)) return NextResponse.json({ ok: false, error: "mode must be dry_run or real" }, { status: 400 });

    const job = await getContentJob(jobId);
    if (!job) return NextResponse.json({ ok: false, error: "Content job not found." }, { status: 404 });
    if (String(job.approval ?? "").toLowerCase() !== "approved" || String(job.status).toLowerCase() !== "review") {
      return NextResponse.json({ ok: false, status: "BLOCKED", externalCallMade: false, error: "Job must be approved and in review." }, { status: 409 });
    }

    if (mode === "dry_run") {
      return NextResponse.json({
        ok: true,
        jobId,
        mode: "DRY_RUN",
        status: "PUBLISH_READY",
        externalCallMade: false,
        actualCost: 0,
        message: "Publish gate passed. No platform API was called.",
      });
    }

    if (body.confirmExternalPublish !== true) {
      return NextResponse.json({
        ok: false,
        jobId,
        status: "CONFIRMATION_REQUIRED",
        externalCallMade: false,
        message: "Real publishing requires explicit confirmation.",
      }, { status: 409 });
    }

    return NextResponse.json({
      ok: false,
      jobId,
      status: "NOT_CONNECTED",
      externalCallMade: false,
      message: "Publishing adapter is not connected. No external platform call was made.",
    }, { status: 409 });
  } catch (error) {
    return NextResponse.json({ ok: false, externalCallMade: false, error: error instanceof Error ? error.message : "Publish gate failed." }, { status: 400 });
  }
}
