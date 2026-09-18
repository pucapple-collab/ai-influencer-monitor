export type JobStatus =
  | "queued"
  | "generating"
  | "rendering"
  | "uploading"
  | "completed";

export type Job = {
  id: string;
  influencerId: string;
  influencer: string;
  task: string;
  status: JobStatus;
  progress: number;
};

export const jobs: Job[] = [
  {
    id: "job-001",
    influencerId: "inf-001",
    influencer: "@model_01",
    task: "Video Generation",
    status: "rendering",
    progress: 72,
  },
  {
    id: "job-002",
    influencerId: "inf-002",
    influencer: "@model_02",
    task: "Image Generation",
    status: "generating",
    progress: 45,
  },
  {
    id: "job-003",
    influencerId: "inf-003",
    influencer: "@model_03",
    task: "Content Upload",
    status: "uploading",
    progress: 88,
  },
  {
    id: "job-004",
    influencerId: "inf-004",
    influencer: "@model_04",
    task: "Script Generation",
    status: "queued",
    progress: 0,
  },
];
