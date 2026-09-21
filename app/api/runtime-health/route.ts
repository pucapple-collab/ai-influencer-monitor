import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { readCharacters } from "../../lib/local-characters";
import { readContentJobs } from "../../lib/local-content-jobs";
import { getExecutions } from "../../lib/ai/execution-store";
import { getPublishAudit } from "../../lib/publish-audit";
import { getProviderWorkSummary } from "../../lib/ai/work-queue";

async function fileSize(name: string) {
  try { return (await fs.stat(path.join(process.cwd(), "runtime", name))).size; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
}

export async function GET() {
  const [characters, jobs, executions, publishAudit, sizes, providerQueue] = await Promise.all([
    readCharacters(),
    readContentJobs(),
    getExecutions(),
    getPublishAudit(),
    Promise.all(["characters.json", "content-jobs.json", "ai-executions.json", "publish-audit.json"].map(fileSize)),
    getProviderWorkSummary(),
  ]);
  const totalBytes = sizes.reduce((sum, size) => sum + size, 0);
  const limits = { executionRecords: 500, publishAuditRecords: 500 };
  const warnings: string[] = [];
  if (executions.length >= limits.executionRecords) warnings.push("AI execution audit retention limit reached; oldest records are rotated.");
  if (publishAudit.length >= limits.publishAuditRecords) warnings.push("Publish audit retention limit reached; oldest records are rotated.");
  if (totalBytes > 5 * 1024 * 1024) warnings.push("Local runtime data exceeds 5 MB.");

  return NextResponse.json({
    ok: true,
    status: warnings.length ? "ATTENTION" : "HEALTHY",
    externalCallMade: false,
    paidUsageTriggered: false,
    counts: { characters: characters.length, jobs: jobs.length, executions: executions.length, publishAudit: publishAudit.length, providerWork: providerQueue.total },
    providerQueue,
    storage: { totalBytes, files: { characters: sizes[0], jobs: sizes[1], executions: sizes[2], publishAudit: sizes[3] } },
    limits,
    warnings,
    checkedAt: new Date().toISOString(),
  });
}
