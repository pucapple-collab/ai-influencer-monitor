
export type AIExecutionStatus =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "BLOCKED"
  | "ERROR";

export type AIExecutionRecord = {
  jobId: string;
  provider: string;
  status: AIExecutionStatus;
  executed: boolean;
  estimatedCost: number;
  actualCost: number;
  createdAt: string;
  completedAt?: string;
  error?: string;
};

export function createExecutionRecord(
  jobId: string,
  provider: string
): AIExecutionRecord {
  return {
    jobId,
    provider,
    status: "QUEUED",
    executed: false,
    estimatedCost: 0,
    actualCost: 0,
    createdAt: new Date().toISOString(),
  };
}
