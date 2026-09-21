import { NextRequest, NextResponse } from "next/server";
import { blockRemoteMutation } from "../../lib/local-api-guard";
import { getContentJob } from "../../lib/local-content-jobs";
import { getPublishReadiness, publishAdapters, type PublishPlatform } from "../../lib/publish-adapters";

export async function GET(){
  return NextResponse.json({ok:true,platforms:getPublishReadiness(),externalCallMade:false,paidUsageTriggered:false});
}

export async function POST(request: NextRequest) {
  const blocked=blockRemoteMutation(request); if(blocked) return blocked;
  try {
    const body=await request.json();
    const jobId=String(body.jobId??"").trim();
    const platform=String(body.platform??"").trim() as PublishPlatform;
    const job=await getContentJob(jobId);
    if(!job) return NextResponse.json({ok:false,error:"Content job not found."},{status:404});
    if(job.status!=="review"||job.reviewDecision!=="approved")
      return NextResponse.json({ok:false,status:"BLOCKED",error:"Approved review is required before publish."},{status:409});
    if(process.env.FACTORY_REAL_PUBLISH_ENABLED!=="true")
      return NextResponse.json({ok:true,status:"READY_TO_PUBLISH",externalCallMade:false,jobId,platforms:getPublishReadiness(),message:"Publish gate passed. Real publishing remains disabled."});
    if(!platform || !publishAdapters[platform])
      return NextResponse.json({ok:false,status:"PUBLISH_PLATFORM_REQUIRED",externalCallMade:false,jobId,platforms:getPublishReadiness(),error:"Choose a configured publish platform."},{status:409});
    const adapter=publishAdapters[platform];
    if(!adapter.configured())
      return NextResponse.json({ok:false,status:"PUBLISH_CREDENTIALS_REQUIRED",externalCallMade:false,jobId,platform,error:`${platform} credentials are not configured.`},{status:409});
    return NextResponse.json({ok:false,status:"PUBLISH_ADAPTER_REQUIRED",externalCallMade:false,jobId,platform,error:"Credentials are present, but the external platform posting implementation is not enabled yet."},{status:501});
  } catch(error) {
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Publish preflight failed.",externalCallMade:false},{status:500});
  }
}
