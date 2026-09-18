export type MonitorSummary = {
  status: string; message: string; factoryProgress: number; nextMission: string;
  coreReadyCount: number; coreStepCount: number; completedTaskCount: number;
  actionableTaskCount: number; waitingTaskCount: number; serviceCount: number;
  activeServiceCount: number; serviceProgress: number; localInfluencerCount: number;
  localContentJobCount: number; approvedContentCount: number; aiExecutionCost: number;
  paidServiceRequired: boolean; aiConnectedCount: number; aiNotConnectedCount: number;
  aiExecutionCount?: number; aiCompletedCount?: number; aiBlockedCount?: number;
  aiErrorCount?: number; aiQueuedCount?: number; aiEstimatedCost?: number; aiActualCost?: number;
};

export type MonitorResponse<TCharacter = unknown, TContentJob = unknown> = {
  ok: boolean; timestamp: string; summary: MonitorSummary; projectStatus: unknown;
  latestTask: unknown; latestError?: unknown; services: unknown[]; characters?: TCharacter[];
  tasks: unknown[]; errors?: unknown[]; runningWorkflows?: unknown[];
  coreSteps: Array<{ id: string; title: string; ready: boolean }>;
  contentJobs?: TContentJob[];
  localOperations: { influencers: number; contentJobs: number; approvedContent: number; pendingApproval: number; generating: number; review: number; published: number };
  ai: { providers: unknown[]; connectedCount: number; notConnectedCount: number; paidRequired: boolean; executions?: { total: number; completed: number; blocked: number; errors: number; queued: number; estimatedCost: number; actualCost: number } };
};
