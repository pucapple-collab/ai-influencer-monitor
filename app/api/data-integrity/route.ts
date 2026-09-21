import { NextResponse } from "next/server";
import { readCharacters } from "../../lib/local-characters";
import { readContentJobs } from "../../lib/local-content-jobs";

export async function GET() {
  const [characters, jobs] = await Promise.all([readCharacters(), readContentJobs()]);
  const characterIds = new Set(characters.map((item) => item.id));
  const orphanJobs = jobs.filter((job) => job.characterId && !characterIds.has(job.characterId));
  const invalidStatuses = jobs.filter((job) => !["draft", "ready", "generating", "review", "published"].includes(String(job.status).toLowerCase()));
  const approvalViolations = jobs.filter((job) =>
    ["generating", "review", "published"].includes(String(job.status).toLowerCase()) &&
    String(job.approval ?? "").toLowerCase() !== "approved"
  );

  const issues = [
    ...orphanJobs.map((job) => ({ type: "ORPHAN_JOB", id: job.id, message: "Content job references a missing character." })),
    ...invalidStatuses.map((job) => ({ type: "INVALID_STATUS", id: job.id, message: `Invalid job status: ${job.status}` })),
    ...approvalViolations.map((job) => ({ type: "APPROVAL_VIOLATION", id: job.id, message: "Generated/review/published job is not approved." })),
  ];

  return NextResponse.json({
    ok: true,
    status: issues.length ? "ATTENTION" : "HEALTHY",
    externalCallMade: false,
    paidUsageTriggered: false,
    counts: { characters: characters.length, jobs: jobs.length, issues: issues.length },
    issues,
    checkedAt: new Date().toISOString(),
  });
}
