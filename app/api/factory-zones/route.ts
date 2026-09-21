import { NextResponse } from "next/server";
import { factoryZones } from "../../lib/ai/factory-zones";
import { getAIProviders } from "../../lib/ai/providers";
export async function GET(){const providers=getAIProviders();return NextResponse.json({ok:true,zones:factoryZones.map(z=>({...z,providers:providers.filter(p=>z.owns.includes(p.id as never)).map(p=>({id:p.id,configured:p.keyConfigured,executable:p.keyConfigured&&p.executionImplemented}))})),externalCallMade:false,paidUsageTriggered:false});}
