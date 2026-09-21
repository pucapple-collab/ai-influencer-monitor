import { NextRequest, NextResponse } from "next/server";
import { getProviderWorkQueue, planProviderWork } from "../../lib/ai/work-queue";
import type { FactoryTaskKind } from "../../lib/ai/orchestrator";

const kinds = new Set<FactoryTaskKind>(["architecture","coding","research","bulk","image","video"]);

export async function GET() {
  const items = getProviderWorkQueue();
  return NextResponse.json({ ok: true, items, externalCallMade: false, paidUsageTriggered: false });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const task = String(body.task ?? "") as FactoryTaskKind;
    const prompt = String(body.prompt ?? "");
    if (!kinds.has(task)) return NextResponse.json({ ok:false,error:"Unsupported task kind." },{status:400});
    const item = planProviderWork(task,prompt);
    return NextResponse.json({ ok:true,item,externalCallMade:false,paidUsageTriggered:false });
  } catch (error) {
    return NextResponse.json({ ok:false,error:error instanceof Error?error.message:"Planning failed." },{status:400});
  }
}
