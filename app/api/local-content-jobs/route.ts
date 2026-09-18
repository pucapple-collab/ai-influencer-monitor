import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const file = path.join(process.cwd(), "runtime", "content-jobs.json");

type Job = {
  id: string;
  title: string;
  characterId: string | null;
  type: string;
  status: string;
  createdAt: string;
};

async function readJobs(): Promise<Job[]> {
  try { return JSON.parse(await fs.readFile(file, "utf8")); }
  catch { return []; }
}

async function writeJobs(data: Job[]) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2), { mode: 0o600 });
}

export async function GET() {
  return NextResponse.json({ ok: true, jobs: await readJobs() });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const title = String(body.title ?? "").trim();

  if (!title)
    return NextResponse.json({ ok: false, error: "Title required" }, { status: 400 });

  const jobs = await readJobs();
  const job: Job = {
    id: crypto.randomUUID(),
    title,
    characterId: body.characterId || null,
    type: String(body.type || "post"),
    status: "draft",
    createdAt: new Date().toISOString(),
  };

  jobs.unshift(job);
  await writeJobs(jobs);
  return NextResponse.json({ ok: true, job });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const jobs = await readJobs();
  const index = jobs.findIndex((job) => job.id === body.id);

  if (index < 0)
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  jobs[index] = {
    ...jobs[index],
    status: String(body.status ?? jobs[index].status),
    type: String(body.type ?? jobs[index].type),
  };
  await writeJobs(jobs);
  return NextResponse.json({ ok: true, job: jobs[index] });
}

export async function DELETE(request: NextRequest) {
  const id = new URL(request.url).searchParams.get("id");
  const jobs = await readJobs();
  const next = jobs.filter((job) => job.id !== id);
  await writeJobs(next);
  return NextResponse.json({ ok: true });
}
