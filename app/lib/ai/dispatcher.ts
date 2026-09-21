import { adapters, type AIProviderId } from "./adapters";
import type { FactoryTaskKind } from "./orchestrator";
import { routeFactoryTask } from "./orchestrator";

export type DispatchMode = "dry_run" | "real";
export type DispatchResult = {
  ok: boolean; task: FactoryTaskKind; provider: AIProviderId; fallbackUsed: boolean;
  executed: boolean; externalCallMade: boolean; paidUsageTriggered: boolean;
  status: string; output?: string; error?: string;
};

const inflight = new Map<AIProviderId, number>();
const limits: Record<AIProviderId, number> = { claude: 2, gemini: 3, higgsfield: 1 };

function enter(provider: AIProviderId) {
  const n=inflight.get(provider)??0;
  if(n>=limits[provider]) return false;
  inflight.set(provider,n+1); return true;
}
function leave(provider: AIProviderId){ inflight.set(provider,Math.max(0,(inflight.get(provider)??1)-1)); }

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
  for(let i=0;i<candidates.length;i++){
    const provider=candidates[i];
    if(!enter(provider)){lastError=`${provider} concurrency limit reached.`;continue;}
    try{
      const r=await adapters[provider].execute({prompt:input.prompt,model:input.model});
      if(r.status==="COMPLETED") return {ok:true,task:input.task,provider,fallbackUsed:i>0,executed:r.executed,externalCallMade:r.executed,paidUsageTriggered:r.executed,status:r.status,output:r.output};
      lastError=r.error??`${provider} failed.`;
      // Never fallback after an ambiguous/queued external submission.
      if(r.executed&&r.status!=="ERROR") break;
    } finally { leave(provider); }
  }
  return {ok:false,task:input.task,provider:route.primary,fallbackUsed:false,executed:false,externalCallMade:false,paidUsageTriggered:false,status:"ERROR",error:lastError};
}
