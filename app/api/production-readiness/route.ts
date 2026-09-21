import { NextResponse } from "next/server";
import { getAIProviders } from "../../lib/ai/providers";

type Check = {
  id: string;
  status: "READY" | "BLOCKED";
  requiredForMinimalRealRun: boolean;
  message: string;
};

export async function GET() {
  const providers = getAIProviders();
  const configured = providers.filter((provider) => provider.keyConfigured);
  const realExecutionEnabled = process.env.FACTORY_REAL_EXECUTION_ENABLED === "true";
  const realPublishEnabled = process.env.FACTORY_REAL_PUBLISH_ENABLED === "true";

  const providerChecks: Check[] = providers.map((provider) => ({
    id: `provider:${provider.id}`,
    status: provider.keyConfigured ? "READY" : "BLOCKED",
    requiredForMinimalRealRun: false,
    message: provider.keyConfigured ? `${provider.name} credential detected.` : `${provider.name} credential is missing.`,
  }));

  const checks: Check[] = [
    ...providerChecks,
    {
      id: "at-least-one-provider",
      status: configured.length > 0 ? "READY" : "BLOCKED",
      requiredForMinimalRealRun: true,
      message: configured.length > 0 ? `Minimal test provider ready: ${configured.map((provider) => provider.name).join(", ")}.` : "At least one provider credential is required for a minimal real test.",
    },
    {
      id: "generation-confirmation-gate",
      status: "READY",
      requiredForMinimalRealRun: true,
      message: "Real generation requires confirmExternalCall=true.",
    },
    {
      id: "publishing-adapter",
      status: "BLOCKED",
      requiredForMinimalRealRun: false,
      message: "Publishing target is intentionally not selected yet.",
    },
  ];

  const blockers = checks.filter((check) => check.requiredForMinimalRealRun && check.status === "BLOCKED");

  return NextResponse.json({
    ok: true,
    phase: blockers.length === 0 ? "READY_FOR_EXPLICIT_REAL_TEST" : "SAFE_SETUP",
    externalCallMade: false,
    paidUsageTriggered: false,
    realExecutionEnabled,
    realPublishEnabled,
    configuredProviders: configured.map((provider) => provider.id),
    blockers,
    checks,
    nextAction: blockers.length
      ? "Configure one provider credential server-side for a minimal real test. Do not expose it as NEXT_PUBLIC."
      : !realExecutionEnabled
        ? "Review pricing/budgets, then temporarily enable FACTORY_REAL_EXECUTION_ENABLED for one explicit minimal test."
        : "Server real-execution switch is enabled. Keep per-request confirmation required.",
  });
}
