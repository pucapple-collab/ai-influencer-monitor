import { NextRequest, NextResponse } from "next/server";
import { blockRemoteMutation } from "../../lib/local-api-guard";
import { getContentJob } from "../../lib/local-content-jobs";
import { savePublishAudit } from "../../lib/publish-audit";

async function audit(jobId: string, mode: "DRY_RUN" | "REAL", status: "PUBLISH_READY" | "BLOCKED" | "REAL_PUBLISH_DISABLED" | "CONFIRMATION_REQUIRED" | "NOT_CONNECTED", message: string) {
  return savePublishAudit({ jobId, mode, status, externalCallMade: false, actualCost: 0, message });
}

export async function POST(request: NextRequest) {
  const blocked = blockRemoteMutation(request); if (blocked) return blocked;
  try {
    const body = await request.json();
    const jobId = String(body.jobId ?? "").trim();
    const modeRaw = String(body.mode ?? "dry_run").toLowerCase();
    if (!jobId) return NextResponse.json({ ok: false, error: "jobId required." }, { status: 400 });
    if (!["dry_run", "real"].includes(modeRaw)) return NextResponse.json({ ok: false, error: "mode must be dry_run or real" }, { status: 400 });
    const mode = modeRaw === "real" ? "REAL" : "DRY_RUN";

    const job = await getContentJob(jobId);
    if (!job) return NextResponse.json({ ok: false, error: "Content job not found." }, { status: 404 });
    if (String(job.approval ?? "").toLowerCase() !== "approved" || String(job.status).toLowerCase() !== "review") {
      const message = "Job must be approved and in review.";
      const record = await audit(jobId, mode, "BLOCKED", message);
      return NextResponse.json({ ok: false, status: "BLOCKED", externalCallMade: false, actualCost: 0, audit: record, error: message }, { status: 409 });
    }

    if (mode === "DRY_RUN") {
      const message = "Publish gate passed. No platform API was called.";
      const record = await audit(jobId, mode, "PUBLISH_READY", message);
      return NextResponse.json({ ok: true, jobId, mode, status: "PUBLISH_READY", externalCallMade: false, actualCost: 0, audit: record, message });
    }

    if (process.env.FACTORY_REAL_PUBLISH_ENABLED !== "true") {
      const message = "Real publishing is disabled by the server safety switch.";
      const record = await audit(jobId, mode, "REAL_PUBLISH_DISABLED", message);
      return NextResponse.json({ ok: false, jobId, status: "REAL_PUBLISH_DISABLED", externalCallMade: false, actualCost: 0, audit: record, message }, { status: 409 });
    }

    if (body.confirmExternalPublish !== true) {
      const message = "Real publishing requires explicit confirmation.";
      const record = await audit(jobId, mode, "CONFIRMATION_REQUIRED", message);
      return NextResponse.json({ ok: false, jobId, status: "CONFIRMATION_REQUIRED", externalCallMade: false, actualCost: 0, audit: record, message }, { status: 409 });
    }

    const message = "Publishing adapter is not connected. No external platform call was made.";
    const record = await audit(jobId, mode, "NOT_CONNECTED", message);
    return NextResponse.json({ ok: false, jobId, status: "NOT_CONNECTED", externalCallMade: false, actualCost: 0, audit: record, message }, { status: 409 });
  } catch (error) {
    return NextResponse.json({ ok: false, externalCallMade: false, actualCost: 0, error: error instanceof Error ? error.message : "Publish gate failed." }, { status: 400 });
  }
}
