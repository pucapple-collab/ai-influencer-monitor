import { NextRequest, NextResponse } from "next/server";
import { blockRemoteMutation } from "../../lib/local-api-guard";
import { dispatchFactoryTask } from "../../lib/ai/dispatcher";
import { getProviderWorkQueue, updateProviderWork } from "../../lib/ai/work-queue";
import { appendProviderAudit } from "../../lib/ai/dispatch-audit";

export async function POST(request: NextRequest) {
  const blocked=blockRemoteMutation(request); if(blocked) return blocked;
  try {
    const body = await request.json().catch(() => ({}));
    const mode = body.mode === "real" ? "real" : "dry_run";
    const requested = Number(body.limit ?? 10);
    const limit = Math.max(1, Math.min(mode === "real" ? 1 : 20, Number.isFinite(requested) ? requested : 10));
    if (mode === "real" && (process.env.FACTORY_REAL_EXECUTION_ENABLED !== "true" || body.confirmExternalCall !== true)) {
      return NextResponse.json({ok:false,status:"BLOCKED",externalCallMade:false,paidUsageTriggered:false,error:"Real queue execution requires server switch and explicit confirmation."},{status:409});
    }
    const queue = await getProviderWorkQueue();
    for (const stale of queue.filter(item => item.status === "RUNNING" && Date.now()-Date.parse(item.updatedAt)>5*60*1000)) {
      await updateProviderWork(stale.id,{status:"ERROR",lastError:"Recovered stale RUNNING item after 5 minutes."});
    }
    const refreshed = await getProviderWorkQueue();
    const planned = refreshed.filter(item => item.status === "PLANNED" && !(mode === "real" && item.externalCallMade)).slice(0, limit);
    const results = [];
    for (const item of planned) {
      const attempts=(item.attempts ?? 0)+1;
      const idempotencyKey=item.idempotencyKey ?? item.id;
      await updateProviderWork(item.id,{status:"RUNNING",attempts,idempotencyKey});
      const result=await dispatchFactoryTask({task:item.task,prompt:item.prompt,mode,confirmExternalCall:body.confirmExternalCall===true});
      await updateProviderWork(item.id,{status:result.ok?"COMPLETED":result.status==="BLOCKED"?"BLOCKED":"ERROR",lastProvider:result.provider,lastError:result.error,externalCallMade:result.externalCallMade,providerRequestId:result.requestId,idempotencyKey});
      await appendProviderAudit({workId:item.id,mode,provider:result.provider,status:result.status,externalCallMade:result.externalCallMade,paidUsageTriggered:result.paidUsageTriggered,requestId:result.requestId,idempotencyKey,error:result.error});
      results.push({id:item.id,...result});
      if(mode==="real" && result.externalCallMade) break;
    }
    return NextResponse.json({ok:results.every(r=>r.ok),mode,count:results.length,externalCallMade:results.some(r=>r.externalCallMade),paidUsageTriggered:results.some(r=>r.paidUsageTriggered),results});
  } catch (error) {
    return NextResponse.json({ok:false,externalCallMade:false,paidUsageTriggered:false,error:error instanceof Error?error.message:"Queue run failed."},{status:500});
  }
}
