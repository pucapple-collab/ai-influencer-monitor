import { NextResponse } from "next/server";
import { getAIProviders } from "../../lib/ai/providers";

export async function GET() {
  const providers = getAIProviders();
  const connected = providers.filter((provider) => provider.keyConfigured).map((provider) => provider.id);
  const executable = providers.filter((provider) => provider.keyConfigured && provider.executionImplemented).map((provider) => provider.id);
  const missing = providers.filter((provider) => !provider.keyConfigured).map((provider) => provider.id);
  const realExecutionEnabled = process.env.FACTORY_REAL_EXECUTION_ENABLED === "true";
  const realPublishEnabled = process.env.FACTORY_REAL_PUBLISH_ENABLED === "true";
  const anyProviderReady = executable.length > 0;
  const fullFactoryProvidersReady = providers.every((provider) => provider.keyConfigured && provider.executionImplemented);

  const milestones = [
    { id: "control-center", label: "Control Center", status: "DONE" },
    { id: "characters", label: "Influencer management", status: "DONE" },
    { id: "content", label: "Content pipeline", status: "DONE" },
    { id: "dry-run", label: "Zero-cost generation simulation", status: "DONE" },
    { id: "first-provider", label: "First real AI provider", status: anyProviderReady ? "READY" : "BLOCKED" },
    { id: "full-factory", label: "Claude + Gemini + Higgsfield", status: fullFactoryProvidersReady ? "READY" : "BLOCKED" },
    { id: "publishing", label: "External publishing adapter", status: realPublishEnabled ? "READY" : "LOCKED" },
  ];

  return NextResponse.json({
    ok: true,
    phase: !anyProviderReady ? "AWAITING_FIRST_PROVIDER" : !realExecutionEnabled ? "READY_FOR_CONTROLLED_ACTIVATION" : "CONTROLLED_REAL_TEST",
    externalCallMade: false,
    paidUsageTriggered: false,
    pipeline: ["idea", "approval", "claude-script", "gemini-visual", "higgsfield-video", "review", "publish"],
    connectedProviders: connected,
    executableProviders: executable,
    missingProviders: missing,
    anyProviderReady,
    fullFactoryProvidersReady,
    realExecutionEnabled,
    realPublishEnabled,
    milestones,
    progress: {
      completedOrReady: milestones.filter((item) => ["DONE", "READY"].includes(item.status)).length,
      total: milestones.length,
    },
    gates: {
      generationRequiresApproval: true,
      realGenerationRequiresServerSwitch: true,
      realGenerationRequiresExplicitConfirmation: true,
      publishRequiresReview: true,
      realPublishRequiresServerSwitch: true,
      realPublishRequiresExplicitConfirmation: true,
    },
    nextAction: !anyProviderReady
      ? "Review provider pricing and spend limits, then configure one server-side credential."
      : !realExecutionEnabled
        ? "Executable provider detected. Keep REAL locked until one minimal test is explicitly approved."
        : "Run only an explicitly confirmed minimal real-generation test.",
  });
}
