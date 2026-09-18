import type { AIProviderId } from "./providers";

export type DryRunResult = {
  provider: AIProviderId;
  status: "COMPLETED" | "ERROR";
  output?: string;
  error?: string;
  estimatedCost: number;
  actualCost: number;
  externalCallMade: false;
};

export async function runDrySimulation(
  provider: AIProviderId,
  prompt: string,
  simulateFailure = false
): Promise<DryRunResult> {
  await Promise.resolve();
  if (simulateFailure) {
    return {
      provider,
      status: "ERROR",
      error: "Simulated provider failure.",
      estimatedCost: 0,
      actualCost: 0,
      externalCallMade: false,
    };
  }
  return {
    provider,
    status: "COMPLETED",
    output: `[DRY_RUN:${provider}] ${prompt}`,
    estimatedCost: 0,
    actualCost: 0,
    externalCallMade: false,
  };
}
