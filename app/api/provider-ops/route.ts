import { NextResponse } from "next/server";
import { getAIProviders } from "../../lib/ai/providers";
import { getProviderWorkSummary } from "../../lib/ai/work-queue";
export async function GET(){const providers=getAIProviders().map(p=>({id:p.id,name:p.name,role:p.role,configured:p.keyConfigured,executionImplemented:p.executionImplemented,executableNow:p.keyConfigured&&p.executionImplemented}));const queue=await getProviderWorkSummary();return NextResponse.json({ok:true,externalCallMade:false,paidUsageTriggered:false,realExecutionEnabled:process.env.FACTORY_REAL_EXECUTION_ENABLED==="true",providers,queue});}
