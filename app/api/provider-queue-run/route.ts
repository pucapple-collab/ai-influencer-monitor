import { NextRequest, NextResponse } from "next/server";
import { dispatchFactoryTask } from "../../lib/ai/dispatcher";
import { getProviderWorkQueue, updateProviderWork } from "../../lib/ai/work-queue";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const mode = body.mode === "real" ? "real" : "dry_run";
    const requested = Number(body.limit ?? 10);
    const limit = Math.max(1, Math.min(mode === "real" ? 1 : 20, Number.isFinite(requested) ? requested : 10));
    if (mode === "real" && (process.env.FACTORY_REAL_EXECUTION_ENABLED !== "true" || body.confirmExternalCall !== true)) {
      return NextResponse.json({ok:false,status:"BLOCKED",externalCallMade:false,paidUsageTriggered:false,error:"Real queue execution requires server switch and explicit confirmation."},{status:409});
    }
    const queue = await getProviderWorkQueue();
    const planned = queue.filter(item => item.status === "PLANNED").slice(0, limit);
    const results = [];
    for (const item of planned) {
      const attempts=(item.attempts ?? 0)+1;
      await updateProviderWork(item.id,{status:"RUNNING",attempts});
      const result=await dispatchFactoryTask({task:item.task,prompt:item.prompt,mode,confirmExternalCall:body.confirmExternalCall===true});
      await updateProviderWork(item.id,{status:result.ok?"COMPLETED":result.status==="BLOCKED"?"BLOCKED":"ERROR",lastProvider:result.provider,lastError:result.error,externalCallMade:result.externalCallMade});
      results.push({id:item.id,...result});
      if(mode==="real" && result.externalCallMade) break;
    }
    return NextResponse.json({ok:results.every(r=>r.ok),mode,count:results.length,externalCallMade:results.some(r=>r.externalCallMade),paidUsageTriggered:results.some(r=>r.paidUsageTriggered),results});
  } catch (error) {
    return NextResponse.json({ok:false,externalCallMade:false,paidUsageTriggered:false,error:error instanceof Error?error.message:"Queue run failed."},{status:500});
  }
}
