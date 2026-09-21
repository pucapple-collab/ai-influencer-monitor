import { NextResponse } from "next/server";
import { readCharacters } from "../../lib/local-characters";
import { readContentJobs } from "../../lib/local-content-jobs";
import { getExecutions } from "../../lib/ai/execution-store";
import { getPublishAudit } from "../../lib/publish-audit";
import { getFactoryRuns } from "../../lib/factory-run-store";

export async function GET() {
  const [characters, jobs, executions, publishAudit, factoryRuns] = await Promise.all([
    readCharacters(),
    readContentJobs(),
    getExecutions(),
    getPublishAudit(),
    getFactoryRuns(),
  ]);
  const exportedAt = new Date().toISOString();
  const backup = {
    schemaVersion: 1,
    exportedAt,
    source: "AI-Influencer-Factory local runtime",
    secretsIncluded: false,
    externalCallMade: false,
    paidUsageTriggered: false,
    data: { characters, jobs, executions, publishAudit, factoryRuns },
  };
  return new NextResponse(JSON.stringify(backup, null, 2) + "\n", {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="factory-backup-${exportedAt.slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
