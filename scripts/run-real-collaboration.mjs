const base=process.env.FACTORY_LOCAL_URL||"http://127.0.0.1:3000";
const task=process.argv.slice(2).join(" ")||"Review the current factory orchestration and identify the highest-priority reliability or test gap with concrete implementation and test recommendations.";

async function json(url,init){
  const r=await fetch(url,init);
  const body=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(`${r.status} ${body.error||r.statusText}`);
  return body;
}

try{
  const readiness=await json(base+"/api/provider-readiness");
  const providers=readiness.providers||readiness;
  const missing=["claude","gemini"].filter(id=>{
    const p=Array.isArray(providers)?providers.find(x=>x.id===id):providers?.[id];
    return !p?.credentialConfigured||!p?.executionImplemented;
  });
  if(missing.length) throw new Error("Provider not executable: "+missing.join(", "));

  const result=await json(base+"/api/ai-collaboration-run",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({task,mode:"real",confirmExternalCall:true})
  });
  const logs=await json(base+"/api/ai-development-log");
  const items=logs.items||logs.logs||[];
  const id=result.collaborationId;
  const cycle=items.filter(x=>typeof x.task==="string" && (x.task===id || x.task.startsWith(id+":")));
  const evidence={
    claude:cycle.filter(x=>x.agent==="claude").map(x=>x.status),
    gemini:cycle.filter(x=>x.agent==="gemini").map(x=>x.status),
    reviews:cycle.filter(x=>x.status==="REVIEW").length,
    improvement:cycle.some(x=>x.status==="IMPROVEMENT")
  };
  const proven=result.crossReviewComplete && evidence.reviews===2 && evidence.improvement;
  if(!proven) throw new Error("Current collaboration cycle is missing reciprocal review/improvement evidence.");
  console.log(JSON.stringify({
    ok:result.ok,
    real:result.real,
    crossReviewComplete:result.crossReviewComplete,
    externalCallMade:result.externalCallMade,
    paidUsageTriggered:result.paidUsageTriggered,
    collaborationId:id,
    providers:{claude:result.claude?.status,gemini:result.gemini?.status,claudeReview:result.claudeReview?.status,geminiReview:result.geminiReview?.status},
    evidence
  },null,2));
  if(!result.crossReviewComplete) process.exitCode=2;
}catch(error){
  console.error("COLLABORATION_RUN_FAILED:",error instanceof Error?error.message:String(error));
  process.exitCode=1;
}
