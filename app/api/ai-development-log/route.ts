import { NextRequest, NextResponse } from "next/server";
import { appendAgentDevelopmentLog, getAgentDevelopmentLog, type AgentId, type AgentLogStatus } from "../../lib/ai/development-log";
import { blockRemoteMutation } from "../../lib/local-api-guard";

const agents = new Set<AgentId>(["chatgpt","claude","gemini","higgsfield","work"]);
const statuses = new Set<AgentLogStatus>(["STARTED","PROGRESS","SUCCESS","ERROR","REVIEW","IMPROVEMENT"]);

export async function GET() {
  const items = await getAgentDevelopmentLog();
  const byAgent = Object.fromEntries([...agents].map(agent => [agent, items.filter(x => x.agent === agent).slice(0, 50)]));
  return NextResponse.json({ ok:true, items:items.slice(0,200), byAgent, externalCallMade:false, paidUsageTriggered:false });
}

export async function POST(request: NextRequest) {
  const blocked = blockRemoteMutation(request); if (blocked) return blocked;
  const body = await request.json();
  if (!agents.has(body.agent) || !statuses.has(body.status) || typeof body.task !== "string" || typeof body.summary !== "string")
    return NextResponse.json({ok:false,error:"Invalid agent development log entry."},{status:400});
  const entry = await appendAgentDevelopmentLog({
    agent:body.agent, task:body.task, status:body.status, summary:body.summary,
    error:typeof body.error==="string"?body.error:undefined,
    improvement:typeof body.improvement==="string"?body.improvement:undefined,
    relatedAgent:agents.has(body.relatedAgent)?body.relatedAgent:undefined,
  });
  return NextResponse.json({ok:true,entry,externalCallMade:false,paidUsageTriggered:false});
}
