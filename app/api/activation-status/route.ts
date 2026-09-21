import { NextResponse } from "next/server";
import { getAIProviders } from "../../lib/ai/providers";

export async function GET() {
  const providers = getAIProviders();
  const configured = providers.filter((provider) => provider.keyConfigured);
  const missing = providers.filter((provider) => !provider.keyConfigured);
  const realExecutionEnabled = process.env.FACTORY_REAL_EXECUTION_ENABLED === "true";
  const realPublishEnabled = process.env.FACTORY_REAL_PUBLISH_ENABLED === "true";
  const anyProviderReady = configured.length > 0;
  const fullFactoryProvidersReady = missing.length === 0;

  const steps = [
    { id: "remote-code", label: "Remote code + CI", status: "DONE" },
    { id: "local-preflight", label: "Mac local preflight", status: "DONE" },
    {
      id: "first-provider",
      label: "First provider credential",
      status: anyProviderReady ? "READY" : "BLOCKED",
      detail: anyProviderReady ? `Ready: ${configured.map((provider) => provider.name).join(", ")}` : "No server provider credential detected",
    },
    {
      id: "full-factory-providers",
      label: "Full factory provider set",
      status: fullFactoryProvidersReady ? "READY" : "BLOCKED",
      detail: fullFactoryProvidersReady ? "All provider credentials detected" : `Missing: ${missing.map((provider) => provider.name).join(", ")}`,
    },
    { id: "real-generation", label: "Minimal real generation", status: realExecutionEnabled ? "READY" : "LOCKED", detail: "Requires server switch plus explicit per-request confirmation" },
    { id: "publishing", label: "External publishing", status: realPublishEnabled ? "READY" : "LOCKED", detail: "Target adapter is still intentionally disconnected" },
  ];

  return NextResponse.json({
    ok: true,
    mode: "CONTROL_CENTER",
    externalCallMade: false,
    paidUsageTriggered: false,
    realExecutionEnabled,
    realPublishEnabled,
    anyProviderReady,
    fullFactoryProvidersReady,
    configuredProviders: configured.map((provider) => provider.id),
    missingProviders: missing.map((provider) => provider.id),
    progress: { completed: steps.filter((step) => ["DONE", "READY"].includes(step.status)).length, total: steps.length },
    steps,
    nextAction: !anyProviderReady
      ? "Review current pricing/spend controls, then add one provider credential server-side for a minimal test."
      : !realExecutionEnabled
        ? "One provider is ready. Keep the switch off until an explicit minimal paid test is approved."
        : "Run one explicitly confirmed real-generation test with a configured provider.",
  });
}
