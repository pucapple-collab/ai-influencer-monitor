import { NextResponse } from "next/server";
import { getAIProviders } from "../../lib/ai/providers";
import { getProviderWorkSummary } from "../../lib/ai/work-queue";
import { getProviderAudit } from "../../lib/ai/dispatch-audit";
export async function GET(){const providers=getAIProviders().map(p=>({id:p.id,name:p.name,role:p.role,configured:p.keyConfigured,executionImplemented:p.executionImplemented,executableNow:p.keyConfigured&&p.executionImplemented}));const queue=await getProviderWorkSummary();const audit=await getProviderAudit();const auditSummary={total:audit.length,externalCalls:audit.filter(x=>x.externalCallMade).length,errors:audit.filter(x=>x.status==="ERROR").length,last:audit[0]?.createdAt??null};return NextResponse.json({ok:true,externalCallMade:false,paidUsageTriggered:false,realExecutionEnabled:process.env.FACTORY_REAL_EXECUTION_ENABLED==="true",providers,queue,audit:auditSummary});}
