import { NextRequest, NextResponse } from "next/server";
import { routeFactoryTask, type FactoryTaskKind } from "../../lib/ai/orchestrator";

const kinds = new Set<FactoryTaskKind>(["architecture", "coding", "research", "bulk", "image", "video"]);

export async function GET(request: NextRequest) {
  const task = (new URL(request.url).searchParams.get("task") ?? "coding") as FactoryTaskKind;
  if (!kinds.has(task)) return NextResponse.json({ ok: false, error: "Unsupported task kind." }, { status: 400 });
  return NextResponse.json({
    ok: true,
    route: routeFactoryTask(task),
    externalCallMade: false,
    paidUsageTriggered: false,
  });
}
