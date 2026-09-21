import fs from "node:fs/promises";

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
  const evidence={
    claude:items.filter(x=>x.agent==="claude").slice(0,6).map(x=>x.status),
    gemini:items.filter(x=>x.agent==="gemini").slice(0,6).map(x=>x.status),
    improvement:items.some(x=>x.status==="IMPROVEMENT")
  };
  console.log(JSON.stringify({
    ok:result.ok,
    real:result.real,
    crossReviewComplete:result.crossReviewComplete,
    externalCallMade:result.externalCallMade,
    paidUsageTriggered:result.paidUsageTriggered,
    providers:{claude:result.claude?.status,gemini:result.gemini?.status},
    evidence
  },null,2));
  if(!result.crossReviewComplete) process.exitCode=2;
}catch(error){
  console.error("COLLABORATION_RUN_FAILED:",error instanceof Error?error.message:String(error));
  process.exitCode=1;
}
