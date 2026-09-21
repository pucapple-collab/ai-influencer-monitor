import { NextRequest, NextResponse } from "next/server";
import { blockRemoteMutation } from "../../lib/local-api-guard";
import { getContentJob, patchContentJob } from "../../lib/local-content-jobs";

export async function POST(request: NextRequest) {
  const blocked=blockRemoteMutation(request); if(blocked) return blocked;
  try {
    const body=await request.json();
    const jobId=String(body.jobId??"").trim();
    const decision=String(body.decision??"").toLowerCase();
    if(!jobId||!["approved","rejected"].includes(decision))
      return NextResponse.json({ok:false,error:"jobId and approved/rejected decision required."},{status:400});
    const job=await getContentJob(jobId);
    if(!job) return NextResponse.json({ok:false,error:"Content job not found."},{status:404});
    if(job.status!=="review") return NextResponse.json({ok:false,error:"Only review-stage content can be decided."},{status:409});
    const now=new Date().toISOString();
    const updated=await patchContentJob(jobId,{
      reviewDecision:decision as "approved"|"rejected",
      reviewNote:String(body.note??"").slice(0,2000),
      reviewedAt:now,
      status:decision==="approved"?"review":"ready",
      generationError:decision==="rejected"?"Review rejected. Revise before regenerating.":"",
    });
    return NextResponse.json({ok:true,job:updated,publishReady:decision==="approved"});
  } catch(error) {
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Review failed."},{status:500});
  }
}
