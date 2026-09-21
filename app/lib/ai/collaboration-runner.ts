import { randomUUID } from "crypto";
import { dispatchFactoryTask, type DispatchResult } from "./dispatcher";
import { appendAgentDevelopmentLog } from "./development-log";
import { appendProviderAudit } from "./dispatch-audit";
import type { FactoryTaskKind } from "./orchestrator";

type CollaborationInput = { task:string; context?:string; real?:boolean; confirmExternalCall?:boolean };

const safe = (value:string, limit=8000) => value.replace(/(?:sk-ant-|AIza|hf_)[A-Za-z0-9_\-]{8,}/g,"[REDACTED]").slice(0,limit);

async function run(agent:"claude"|"gemini", task:FactoryTaskKind, prompt:string, real:boolean, confirmExternalCall:boolean, workId:string) {
  await appendAgentDevelopmentLog({agent,task:workId,status:"STARTED",summary:`Accepted ${task} collaboration assignment.`});
  const result=await dispatchFactoryTask({task,prompt,mode:real?"real":"dry_run",confirmExternalCall});
  const success=result.status==="COMPLETED";
  await appendProviderAudit({workId,mode:real?"real":"dry_run",provider:result.provider,status:result.status,externalCallMade:result.externalCallMade,paidUsageTriggered:result.paidUsageTriggered,requestId:result.requestId,error:success?undefined:safe(result.error||"Unknown provider error",500)});
  await appendAgentDevelopmentLog({agent,task:workId,status:success?"SUCCESS":"ERROR",summary:success?`${task} assignment completed.`:`${task} assignment failed.`,error:success?undefined:safe(result.error||"Unknown provider error",500)});
  return result;
}

export async function runDevelopmentCollaboration(input:CollaborationInput){
  const collaborationId=randomUUID();
  const confirmed=input.confirmExternalCall===true;
  const real=input.real===true && confirmed && process.env.FACTORY_REAL_EXECUTION_ENABLED==="true";
  const base=safe([input.task,input.context].filter(Boolean).join("\n\n"));
  const claudePrompt=`Architecture/coding task. Produce a concrete implementation/review plan with risks and tests.\n\n${base}`;
  const geminiPrompt=`Independent verification task. Find missing cases, test gaps, API/reliability risks and concrete fixes.\n\n${base}`;

  const [claude,gemini]=await Promise.all([
    run("claude","coding",claudePrompt,real,confirmed,`${collaborationId}:claude-primary`),
    run("gemini","research",geminiPrompt,real,confirmed,`${collaborationId}:gemini-primary`)
  ]);

  let claudeReview:DispatchResult|undefined;
  let geminiReview:DispatchResult|undefined;
  if(claude.status==="COMPLETED" && gemini.status==="COMPLETED"){
    const c=safe(claude.output||"No Claude result");
    const g=safe(gemini.output||"No Gemini result");
    // Reviews are real provider calls in real mode, not copied log labels.
    [geminiReview,claudeReview]=await Promise.all([
      run("gemini","research",`Review Claude's proposed implementation. Identify concrete defects, missing tests, unsafe assumptions, and exact corrections. Do not repeat the proposal.\n\nCLAUDE RESULT:\n${c}`,real,confirmed,`${collaborationId}:gemini-review`),
      run("claude","coding",`Review Gemini's verification findings against the implementation goal. Resolve conflicts and return exact code/test changes worth adopting.\n\nGEMINI RESULT:\n${g}`,real,confirmed,`${collaborationId}:claude-review`)
    ]);

    if(geminiReview.status==="COMPLETED") await appendAgentDevelopmentLog({agent:"gemini",relatedAgent:"claude",task:collaborationId,status:"REVIEW",summary:"Completed an actual provider review of Claude output."});
    if(claudeReview.status==="COMPLETED") await appendAgentDevelopmentLog({agent:"claude",relatedAgent:"gemini",task:collaborationId,status:"REVIEW",summary:"Completed an actual provider review of Gemini output."});
  }

  const crossReviewComplete=claude.status==="COMPLETED" && gemini.status==="COMPLETED" && claudeReview?.status==="COMPLETED" && geminiReview?.status==="COMPLETED";
  if(crossReviewComplete) await appendAgentDevelopmentLog({agent:"chatgpt",relatedAgent:"claude",task:collaborationId,status:"IMPROVEMENT",summary:"Actual reciprocal provider review completed; findings ready for consolidation."});

  const results=[claude,gemini,claudeReview,geminiReview].filter(Boolean) as DispatchResult[];
  return {ok:crossReviewComplete,collaborationId,real,crossReviewComplete,claude,gemini,claudeReview,geminiReview,externalCallMade:results.some(x=>x.externalCallMade),paidUsageTriggered:results.some(x=>x.paidUsageTriggered)};
}
