import type { AIProviderId } from "./providers";

export type FactoryStage = {
  id: "script" | "visual" | "video";
  provider: AIProviderId;
  input: string;
  status: "SIMULATED";
  output: string;
  externalCallMade: false;
  actualCost: 0;
};

export type FactoryDryRun = {
  mode: "DRY_RUN";
  stages: FactoryStage[];
  externalCallMade: false;
  actualCost: 0;
};

export function simulateFactoryPipeline(prompt: string): FactoryDryRun {
  const clean = prompt.trim();
  if (!clean) throw new Error("Prompt required.");

  const stages: FactoryStage[] = [
    {
      id: "script",
      provider: "claude",
      input: clean,
      status: "SIMULATED",
      output: `[DRY_RUN:claude] Script plan for: ${clean}`,
      externalCallMade: false,
      actualCost: 0,
    },
    {
      id: "visual",
      provider: "gemini",
      input: clean,
      status: "SIMULATED",
      output: `[DRY_RUN:gemini] Visual brief for: ${clean}`,
      externalCallMade: false,
      actualCost: 0,
    },
    {
      id: "video",
      provider: "higgsfield",
      input: clean,
      status: "SIMULATED",
      output: `[DRY_RUN:higgsfield] Video generation handoff for: ${clean}`,
      externalCallMade: false,
      actualCost: 0,
    },
  ];

  return { mode: "DRY_RUN", stages, externalCallMade: false, actualCost: 0 };
}
