import { NextResponse } from "next/server";
import { getFactoryRuns } from "../../lib/factory-run-store";

export async function GET() {
  const runs = await getFactoryRuns();
  return NextResponse.json({
    ok: true,
    externalCallMade: false,
    paidUsageTriggered: false,
    summary: { total: runs.length, completed: runs.filter((run) => run.status === "COMPLETED").length, actualCost: 0 },
    runs,
  });
}
