import { NextRequest, NextResponse } from "next/server";

export function blockRemoteMutation(request: NextRequest) {
  if (process.env.VERCEL) {
    return NextResponse.json({ok:false,error:"Local runtime mutation is disabled on hosted deployments.",externalCallMade:false,paidUsageTriggered:false},{status:403});
  }
  const host=request.nextUrl.hostname;
  if (host==="localhost"||host==="127.0.0.1"||host==="::1") return null;
  return NextResponse.json({ok:false,error:"Local runtime mutation requires localhost.",externalCallMade:false,paidUsageTriggered:false},{status:403});
}
