import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  readContentJobs,
  mutateContentJobs,
  patchContentJob,
  type LocalContentJob,
} from "../../lib/local-content-jobs";

export async function GET() {
  return NextResponse.json({ ok: true, jobs: await readContentJobs() });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const title = String(body.title ?? "").trim();
  if (!title) return NextResponse.json({ ok: false, error: "Title required" }, { status: 400 });

  const job: LocalContentJob = {
    id: crypto.randomUUID(),
    title,
    characterId: body.characterId || null,
    type: String(body.type || "post"),
    status: "draft",
    script: "",
    prompt: "",
    approval: "pending",
    createdAt: new Date().toISOString(),
  };
  await mutateContentJobs((jobs) => {
    jobs.unshift(job);
  });
  return NextResponse.json({ ok: true, job });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const jobId = String(body.id ?? body.jobId ?? "").trim();
  const jobs = await readContentJobs();
  const index = jobs.findIndex((job) => job.id === jobId);
  if (index < 0) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const requestedStatus = String(body.status ?? jobs[index].status).toLowerCase();
  const approval = String(body.approval ?? jobs[index].approval ?? "pending").toLowerCase();
  const allowed = ["draft", "ready", "generating", "review", "published"];
  if (!allowed.includes(requestedStatus))
    return NextResponse.json({ ok: false, error: "Invalid status" }, { status: 400 });
  if (["generating", "review", "published"].includes(requestedStatus) && approval !== "approved")
    return NextResponse.json({ ok: false, error: "Approval required before generation." }, { status: 409 });

  const updated = await patchContentJob(jobId, {
    status: requestedStatus,
    type: String(body.type ?? jobs[index].type),
    script: String(body.script ?? jobs[index].script ?? ""),
    prompt: String(body.prompt ?? jobs[index].prompt ?? ""),
    approval,
  });
  if (!updated) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, job: updated });
}

export async function DELETE(request: NextRequest) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  await mutateContentJobs((jobs) => {
    const index = jobs.findIndex((job) => job.id === id);
    if (index >= 0) jobs.splice(index, 1);
  });
  return NextResponse.json({ ok: true });
}
