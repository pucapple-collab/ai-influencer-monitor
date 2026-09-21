import { NextRequest, NextResponse } from "next/server";
import { blockRemoteMutation } from "../../lib/local-api-guard";
import { dispatchFactoryTask } from "../../lib/ai/dispatcher";
import type { FactoryTaskKind } from "../../lib/ai/orchestrator";
const kinds=new Set<FactoryTaskKind>(["architecture","coding","research","bulk","image","video"]);
export async function POST(request:NextRequest){
  const blocked=blockRemoteMutation(request); if(blocked) return blocked;
 try{
  const body=await request.json(); const task=String(body.task??"") as FactoryTaskKind; const prompt=String(body.prompt??"").trim();
  if(!kinds.has(task)||!prompt) return NextResponse.json({ok:false,error:"Valid task and prompt required."},{status:400});
  const result=await dispatchFactoryTask({task,prompt,mode:body.mode==="real"?"real":"dry_run",confirmExternalCall:body.confirmExternalCall===true,model:body.model});
  return NextResponse.json(result,{status:result.ok?200:409});
 }catch(e){return NextResponse.json({ok:false,executed:false,externalCallMade:false,paidUsageTriggered:false,error:e instanceof Error?e.message:"Dispatch failed."},{status:500});}
}
