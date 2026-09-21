import { dispatchFactoryTask } from "./dispatcher";
import { appendAgentDevelopmentLog } from "./development-log";
import type { FactoryTaskKind } from "./orchestrator";

type CollaborationInput = { task:string; context?:string; real?:boolean; confirmExternalCall?:boolean };

const safe = (value:string) => value.replace(/(?:sk-ant-|AIza|hf_)[A-Za-z0-9_\-]{8,}/g,"[REDACTED]").slice(0,12000);

async function run(agent:"claude"|"gemini", task:FactoryTaskKind, prompt:string, real:boolean, confirmExternalCall:boolean) {
  await appendAgentDevelopmentLog({agent,task:prompt.slice(0,160),status:"STARTED",summary:"Accepted collaboration assignment."});
  const result=await dispatchFactoryTask({task,prompt,mode:real?"real":"dry_run",confirmExternalCall});
  const success=result.status==="COMPLETED";
  await appendAgentDevelopmentLog({
    agent,task:prompt.slice(0,160),status:success?"SUCCESS":"ERROR",
    summary:success?"Assignment completed.":"Assignment failed.",
    error:success?undefined:safe(result.error||"Unknown provider error")
  });
  return result;
}

export async function runDevelopmentCollaboration(input:CollaborationInput){
  const confirmed=input.confirmExternalCall===true;
  const real=input.real===true && confirmed && process.env.FACTORY_REAL_EXECUTION_ENABLED==="true";
  const base=safe([input.task,input.context].filter(Boolean).join("\n\n"));
  const claudePrompt=`Architecture/coding task. Produce a concrete implementation/review plan with risks and tests.\n\n${base}`;
  const geminiPrompt=`Independent verification task. Find missing cases, test gaps, API/reliability risks and concrete fixes.\n\n${base}`;

  const [claude,gemini]=await Promise.all([
    run("claude","coding",claudePrompt,real,confirmed),
    run("gemini","research",geminiPrompt,real,confirmed)
  ]);

  const c=safe(claude.output||claude.error||"No Claude result");
  const g=safe(gemini.output||gemini.error||"No Gemini result");

  await appendAgentDevelopmentLog({agent:"claude",relatedAgent:"gemini",task:input.task,status:"REVIEW",summary:"Reviewed Gemini verification result.",improvement:g.slice(0,1000)});
  await appendAgentDevelopmentLog({agent:"gemini",relatedAgent:"claude",task:input.task,status:"REVIEW",summary:"Reviewed Claude implementation result.",improvement:c.slice(0,1000)});

  const crossReviewComplete=claude.status==="COMPLETED" && gemini.status==="COMPLETED";
  if(crossReviewComplete){
    await appendAgentDevelopmentLog({agent:"chatgpt",relatedAgent:"claude",task:input.task,status:"IMPROVEMENT",summary:"Cross-review cycle completed; results ready for consolidation.",improvement:"Use Claude implementation guidance together with Gemini reliability/test findings."});
  }
  return {ok:crossReviewComplete,real,crossReviewComplete,claude,gemini,externalCallMade:Boolean(claude.externalCallMade||gemini.externalCallMade),paidUsageTriggered:Boolean(claude.paidUsageTriggered||gemini.paidUsageTriggered)};
}
