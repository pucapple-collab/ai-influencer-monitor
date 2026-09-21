import { adapters, type AIProviderId } from "./adapters";
import type { FactoryTaskKind } from "./orchestrator";
import { routeFactoryTask } from "./orchestrator";
import { canExecuteAI } from "./providers";

export type DispatchMode = "dry_run" | "real";
export type DispatchResult = {
  ok: boolean; task: FactoryTaskKind; provider: AIProviderId; fallbackUsed: boolean;
  executed: boolean; externalCallMade: boolean; paidUsageTriggered: boolean;
  status: string; output?: string; requestId?: string; error?: string;
};

const inflight = new Map<AIProviderId, number>();
const limits: Record<AIProviderId, number> = { claude: 2, gemini: 3, higgsfield: 1 };

const waiters = new Map<AIProviderId, Array<() => void>>();
async function enter(provider: AIProviderId) {
  while ((inflight.get(provider) ?? 0) >= limits[provider]) {
    await new Promise<void>((resolve) => {
      const queue = waiters.get(provider) ?? [];
      queue.push(resolve);
      waiters.set(provider, queue);
    });
  }
  inflight.set(provider, (inflight.get(provider) ?? 0) + 1);
}
function leave(provider: AIProviderId){
  inflight.set(provider,Math.max(0,(inflight.get(provider)??1)-1));
  waiters.get(provider)?.shift()?.();
}

export async function dispatchFactoryTask(input:{task:FactoryTaskKind;prompt:string;mode?:DispatchMode;confirmExternalCall?:boolean;model?:string}):Promise<DispatchResult>{
  const route=routeFactoryTask(input.task);
  const mode=input.mode??"dry_run";
  const candidates=[route.primary,...(route.fallback&&route.fallback!==route.primary?[route.fallback]:[])] as AIProviderId[];
  if(mode!=="real"){
    return {ok:true,task:input.task,provider:route.primary,fallbackUsed:false,executed:false,externalCallMade:false,paidUsageTriggered:false,status:"DRY_RUN",output:`DRY_RUN routed to ${route.primary}`};
  }
  if(process.env.FACTORY_REAL_EXECUTION_ENABLED!=="true"||input.confirmExternalCall!==true){
    return {ok:false,task:input.task,provider:route.primary,fallbackUsed:false,executed:false,externalCallMade:false,paidUsageTriggered:false,status:"BLOCKED",error:"Real execution requires server switch and explicit confirmation."};
  }
  let lastError="No executable provider.";
  let attemptedProvider: AIProviderId = route.primary;
  let fallbackUsed = false;
  let externalCallMade = false;
  for(let i=0;i<candidates.length;i++){
    const provider=candidates[i];
    attemptedProvider = provider;
    fallbackUsed = i > 0;
    if(!canExecuteAI(provider)){lastError=`${provider} is not executable.`;continue;}
    await enter(provider);
    try{
      const r=await adapters[provider].execute({prompt:input.prompt,model:input.model});
      externalCallMade = externalCallMade || r.executed;
      if(r.status==="COMPLETED") return {ok:true,task:input.task,provider,fallbackUsed,executed:r.executed,externalCallMade:r.executed,paidUsageTriggered:r.executed,status:r.status,output:r.output,requestId:r.requestId};
      lastError=r.error??`${provider} failed.`;
      // Never fallback after an ambiguous/queued external submission.
      if(r.executed) break;
    } catch (error) {
      lastError=error instanceof Error ? `${provider}: ${error.name === "AbortError" ? "request timeout" : error.message}` : `${provider} request failed.`;
      // A thrown transport error can be ambiguous after submission. Do not fallback and risk duplicate paid work.
      break;
    } finally { leave(provider); }
  }
  return {ok:false,task:input.task,provider:attemptedProvider,fallbackUsed,executed:externalCallMade,externalCallMade,paidUsageTriggered:externalCallMade,status:"ERROR",error:lastError};
}
