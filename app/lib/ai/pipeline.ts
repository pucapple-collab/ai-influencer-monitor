
export type ContentPipelineStatus =
  | "idea"
  | "ready"
  | "generating"
  | "review"
  | "published"
  | "blocked"
  | "error";

export function canStartGeneration(
  approval: string,
  status: string
): boolean {
  return approval.toLowerCase() === "approved" &&
    status.toLowerCase() === "ready";
}

export function generationStarted() {
  return {
    status: "generating" as ContentPipelineStatus,
    startedAt: new Date().toISOString(),
  };
}

export function generationCompleted() {
  return {
    status: "review" as ContentPipelineStatus,
    completedAt: new Date().toISOString(),
  };
}
