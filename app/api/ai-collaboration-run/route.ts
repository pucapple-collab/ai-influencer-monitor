import { NextRequest, NextResponse } from "next/server";
import { blockRemoteMutation } from "../../lib/local-api-guard";
import { runDevelopmentCollaboration } from "../../lib/ai/collaboration-runner";

export async function POST(request:NextRequest){
  const blocked=blockRemoteMutation(request); if(blocked) return blocked;
  const body=await request.json();
  if(typeof body.task!=="string"||!body.task.trim()) return NextResponse.json({ok:false,error:"task is required"},{status:400});
  const result=await runDevelopmentCollaboration({task:body.task,context:typeof body.context==="string"?body.context:undefined,real:body.mode==="real",confirmExternalCall:body.confirmExternalCall===true});
  return NextResponse.json(result,{status:result.ok?200:result.real?502:200});
}
