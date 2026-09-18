import { NextResponse } from "next/server";
import { getAIProviders } from "../../lib/ai/providers";

export async function GET() {
  const providers = getAIProviders().map((provider) => ({
    id: provider.id,
    name: provider.name,
    role: provider.role,
    status: provider.status,
    keyConfigured: provider.keyConfigured,
    defaultModel: provider.defaultModel ?? null,
    credentialEnvNames: provider.envNames,
    realExecutionRequiresConfirmation: true,
    paidUsagePossible: true,
  }));

  return NextResponse.json({
    ok: true,
    externalCallMade: false,
    paidUsageTriggered: false,
    mode: "PREFLIGHT_ONLY",
    providers,
    readyCount: providers.filter((item) => item.keyConfigured).length,
    missingCount: providers.filter((item) => !item.keyConfigured).length,
    message: "Credential presence only. No provider request was sent.",
  });
}
