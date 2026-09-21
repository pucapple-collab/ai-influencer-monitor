import { NextRequest, NextResponse } from "next/server";
import { blockRemoteMutation } from "../../lib/local-api-guard";
import { getContentJob, patchContentJob } from "../../lib/local-content-jobs";

export async function POST(request: NextRequest) {
  const blocked=blockRemoteMutation(request); if(blocked) return blocked;
  try {
    const body=await request.json();
    const jobId=String(body.jobId??"").trim();
    const job=await getContentJob(jobId);
    if(!job) return NextResponse.json({ok:false,error:"Content job not found."},{status:404});
    if(job.status!=="review"||job.reviewDecision!=="approved")
      return NextResponse.json({ok:false,status:"BLOCKED",error:"Approved review is required before publish."},{status:409});
    if(process.env.FACTORY_REAL_PUBLISH_ENABLED!=="true")
      return NextResponse.json({ok:true,status:"READY_TO_PUBLISH",externalCallMade:false,jobId,message:"Publish gate passed. Real publishing remains disabled."});
    return NextResponse.json({ok:false,status:"PUBLISH_ADAPTER_REQUIRED",externalCallMade:false,jobId,error:"Real publish switch is enabled but no platform adapter is configured."},{status:501});
  } catch(error) {
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Publish preflight failed."},{status:500});
  }
}
