import { NextResponse } from "next/server";
import { getAIProviders } from "../../lib/ai/providers";

type Check = {
  id: string;
  status: "READY" | "BLOCKED";
  requiredForRealRun: boolean;
  message: string;
};

export async function GET() {
  const providers = getAIProviders();
  const providerChecks: Check[] = providers.map((provider) => ({
    id: `provider:${provider.id}`,
    status: provider.keyConfigured ? "READY" : "BLOCKED",
    requiredForRealRun: true,
    message: provider.keyConfigured
      ? `${provider.name} credential detected.`
      : `${provider.name} credential is missing.`,
  }));

  const checks: Check[] = [
    ...providerChecks,
    {
      id: "generation-confirmation-gate",
      status: "READY",
      requiredForRealRun: true,
      message: "Real generation requires confirmExternalCall=true.",
    },
    {
      id: "publish-confirmation-gate",
      status: "READY",
      requiredForRealRun: true,
      message: "Real publishing requires confirmExternalPublish=true.",
    },
    {
      id: "publishing-adapter",
      status: "BLOCKED",
      requiredForRealRun: false,
      message: "Publishing target is intentionally not selected yet.",
    },
  ];

  const blockers = checks.filter((check) => check.requiredForRealRun && check.status === "BLOCKED");

  return NextResponse.json({
    ok: true,
    phase: blockers.length === 0 ? "READY_FOR_EXPLICIT_REAL_TEST" : "SAFE_SETUP",
    externalCallMade: false,
    paidUsageTriggered: false,
    realExecutionEnabled: false,
    blockers,
    checks,
    nextAction: blockers.length
      ? "Configure missing provider credentials server-side. Do not expose them as NEXT_PUBLIC variables."
      : "Review pricing/budgets, then explicitly approve one minimal real provider test.",
  });
}
