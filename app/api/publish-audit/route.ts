import { NextResponse } from "next/server";
import { getPublishAudit } from "../../lib/publish-audit";

export async function GET() {
  const records = await getPublishAudit();
  return NextResponse.json({
    ok: true,
    externalCallMade: false,
    paidUsageTriggered: false,
    summary: {
      total: records.length,
      ready: records.filter((item) => item.status === "PUBLISH_READY").length,
      blocked: records.filter((item) => item.status !== "PUBLISH_READY").length,
      actualCost: records.reduce((sum, item) => sum + item.actualCost, 0),
    },
    records,
  });
}
