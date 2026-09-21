import { NextResponse } from "next/server";
import { getAIProviders } from "../../lib/ai/providers";

export async function GET() {
  const providers = getAIProviders().map((provider) => ({
    id: provider.id,
    name: provider.name,
    role: provider.role,
    credentialConfigured: provider.keyConfigured,
    executionImplemented: provider.executionImplemented,
    executableNow: provider.keyConfigured && provider.executionImplemented,
    defaultModel: provider.defaultModel ?? null,
    missing: [
      ...(!provider.keyConfigured ? ["SERVER_CREDENTIAL"] : []),
      ...(!provider.executionImplemented ? ["REAL_EXECUTION_ADAPTER"] : []),
    ],
  }));

  return NextResponse.json({
    ok: true,
    externalCallMade: false,
    paidUsageTriggered: false,
    providers,
    executableProviders: providers.filter((provider) => provider.executableNow).map((provider) => provider.id),
    nextAction: providers.some((provider) => provider.executableNow)
      ? "One or more providers are technically ready. Keep the real-execution switch and per-request confirmation gate in control."
      : "Configure Gemini or Claude server credentials. Higgsfield still requires an official real-execution adapter before it can be treated as executable.",
  });
}
