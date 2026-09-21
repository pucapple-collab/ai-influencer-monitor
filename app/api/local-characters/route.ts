import { NextRequest, NextResponse } from "next/server";
import { createCharacter, deleteCharacter, patchCharacter, readCharacters } from "../../lib/local-characters";
import { deleteContentJobsForCharacter, readContentJobs } from "../../lib/local-content-jobs";

export async function GET() {
  return NextResponse.json({ ok: true, characters: await readCharacters() });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const concept = String(body.concept ?? "").trim();
  if (!name) return NextResponse.json({ ok: false, error: "Character name is required." }, { status: 400 });
  return NextResponse.json({ ok: true, character: await createCharacter({ name, concept }) });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const id = String(body.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  const patch: { name?: string; concept?: string; status?: string } = {};
  if (body.name !== undefined) {
    patch.name = String(body.name).trim();
    if (!patch.name) return NextResponse.json({ ok: false, error: "Character name cannot be empty." }, { status: 400 });
  }
  if (body.concept !== undefined) patch.concept = String(body.concept).trim();
  if (body.status !== undefined) patch.status = String(body.status).trim();
  const character = await patchCharacter(id, patch);
  if (!character) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, character });
}

export async function DELETE(request: NextRequest) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id") ?? "";
  const cascade = url.searchParams.get("cascade") === "true";
  const jobs = (await readContentJobs()).filter((job) => job.characterId === id);
  if (jobs.length && !cascade) {
    return NextResponse.json({
      ok: false,
      status: "DEPENDENCY_BLOCKED",
      dependentJobs: jobs.length,
      error: "Character has content jobs. Delete them first or explicitly use cascade=true.",
    }, { status: 409 });
  }
  if (!(await deleteCharacter(id))) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  const deletedJobs = cascade ? await deleteContentJobsForCharacter(id) : 0;
  return NextResponse.json({ ok: true, deletedJobs });
}
