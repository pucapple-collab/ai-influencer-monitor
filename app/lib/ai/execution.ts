export type AIExecutionStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "BLOCKED" | "ERROR";
export type AIExecutionMode = "DRY_RUN" | "REAL";

export type AIExecutionRecord = {
  jobId: string;
  provider: string;
  mode: AIExecutionMode;
  status: AIExecutionStatus;
  executed: boolean;
  externalCallMade: boolean;
  estimatedCost: number;
  actualCost: number;
  createdAt: string;
  completedAt?: string;
  requestId?: string;
  idempotencyKey?: string;
  error?: string;
};

export function createExecutionRecord(jobId: string, provider: string, mode: AIExecutionMode = "REAL"): AIExecutionRecord {
  return {
    jobId,
    provider,
    mode,
    status: "QUEUED",
    executed: false,
    externalCallMade: false,
    estimatedCost: 0,
    actualCost: 0,
    createdAt: new Date().toISOString(),
  };
}
