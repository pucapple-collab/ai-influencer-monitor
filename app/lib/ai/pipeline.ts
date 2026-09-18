
export type ContentPipelineStatus =
  | "IDEA"
  | "READY"
  | "GENERATING"
  | "REVIEW"
  | "PUBLISHED"
  | "BLOCKED"
  | "ERROR";

export function canStartGeneration(
  approval: string,
  status: string
): boolean {
  return approval.toLowerCase() === "approved" &&
    ["READY", "GENERATING"].includes(status.toUpperCase());
}

export function generationStarted() {
  return {
    status: "GENERATING" as ContentPipelineStatus,
    startedAt: new Date().toISOString(),
  };
}

export function generationCompleted() {
  return {
    status: "REVIEW" as ContentPipelineStatus,
    completedAt: new Date().toISOString(),
  };
}
