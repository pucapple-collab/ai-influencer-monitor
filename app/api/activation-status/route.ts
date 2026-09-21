import { NextResponse } from "next/server";
import { getAIProviders } from "../../lib/ai/providers";

export async function GET() {
  const providers = getAIProviders();
  const missing = providers.filter((provider) => !provider.keyConfigured).map((provider) => provider.name);
  const realExecutionEnabled = process.env.FACTORY_REAL_EXECUTION_ENABLED === "true";
  const realPublishEnabled = process.env.FACTORY_REAL_PUBLISH_ENABLED === "true";

  const steps = [
    { id: "remote-code", label: "Remote code + CI", status: "DONE" },
    { id: "local-preflight", label: "Mac local preflight", status: "DONE" },
    { id: "provider-credentials", label: "Provider credentials", status: missing.length ? "BLOCKED" : "READY", detail: missing.length ? `Missing: ${missing.join(", ")}` : "Server credentials detected" },
    { id: "real-generation", label: "Minimal real generation", status: realExecutionEnabled ? "READY" : "LOCKED", detail: "Requires explicit per-request confirmation" },
    { id: "publishing", label: "External publishing", status: realPublishEnabled ? "READY" : "LOCKED", detail: "Target adapter is still intentionally disconnected" },
  ];

  return NextResponse.json({
    ok: true,
    mode: "CONTROL_CENTER",
    externalCallMade: false,
    paidUsageTriggered: false,
    realExecutionEnabled,
    realPublishEnabled,
    missingProviders: missing,
    progress: {
      completed: steps.filter((step) => step.status === "DONE").length,
      total: steps.length,
    },
    steps,
    nextAction: missing.length
      ? "Add provider credentials server-side after reviewing current pricing and spend controls."
      : !realExecutionEnabled
        ? "Approve one minimal real-generation test, then temporarily enable the real-execution switch."
        : "Run one explicitly confirmed real-generation test.",
  });
}
