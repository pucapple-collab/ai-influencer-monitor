import { NextResponse } from "next/server";
import { getAIProviders } from "../../lib/ai/providers";

export async function GET() {
  const providers = getAIProviders();
  const connected = providers.filter((provider) => provider.keyConfigured).map((provider) => provider.id);
  const missing = providers.filter((provider) => !provider.keyConfigured).map((provider) => provider.id);

  return NextResponse.json({
    ok: true,
    phase: missing.length === 0 ? "PROVIDER_READY" : "AWAITING_CREDENTIALS",
    externalCallMade: false,
    paidUsageTriggered: false,
    pipeline: ["idea", "approval", "claude-script", "gemini-visual", "higgsfield-video", "review", "publish"],
    connectedProviders: connected,
    missingProviders: missing,
    gates: {
      generationRequiresApproval: true,
      realGenerationRequiresExplicitConfirmation: true,
      publishRequiresReview: true,
      realPublishRequiresExplicitConfirmation: true,
    },
  });
}
