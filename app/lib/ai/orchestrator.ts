import { getAIProviders, type AIProviderId } from "./providers";

export type FactoryTaskKind =
  | "architecture"
  | "coding"
  | "research"
  | "bulk"
  | "image"
  | "video";

export type RouteDecision = {
  task: FactoryTaskKind;
  primary: AIProviderId;
  fallback?: AIProviderId;
  reason: string;
  executableNow: boolean;
};

export function routeFactoryTask(task: FactoryTaskKind): RouteDecision {
  const providers = getAIProviders();
  const ready = new Set(
    providers.filter((provider) => provider.keyConfigured && provider.executionImplemented).map((provider) => provider.id)
  );

  const desired: Record<FactoryTaskKind, [AIProviderId, AIProviderId?]> = {
    architecture: ["claude", "gemini"],
    coding: ["claude", "gemini"],
    research: ["gemini", "claude"],
    bulk: ["gemini", "claude"],
    image: ["higgsfield"],
    video: ["higgsfield"],
  };

  const [preferred, fallback] = desired[task];
  const primary = ready.has(preferred) ? preferred : fallback && ready.has(fallback) ? fallback : preferred;

  const reasons: Record<FactoryTaskKind, string> = {
    architecture: "Claude handles long-horizon architecture and code review; Gemini is the fallback.",
    coding: "Claude owns complex implementation and verification; Gemini absorbs parallel coding/research load.",
    research: "Gemini owns search-heavy and multimodal research; Claude verifies complex conclusions.",
    bulk: "Gemini handles high-throughput structured sub-tasks; Claude is fallback.",
    image: "Higgsfield owns image generation and character/marketing visual workflows.",
    video: "Higgsfield owns asynchronous video generation and media workflows.",
  };

  return { task, primary, fallback, reason: reasons[task], executableNow: ready.has(primary) };
}
