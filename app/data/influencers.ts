export type InfluencerStatus =
  | "active"
  | "generating"
  | "paused";

export type Influencer = {
  id: string;
  name: string;
  handle: string;
  status: InfluencerStatus;
  totalContents: number;
  todayContents: number;
};

export const influencers: Influencer[] = [
  {
    id: "inf-001",
    name: "Model 01",
    handle: "@model_01",
    status: "generating",
    totalContents: 128,
    todayContents: 6,
  },
  {
    id: "inf-002",
    name: "Model 02",
    handle: "@model_02",
    status: "active",
    totalContents: 94,
    todayContents: 4,
  },
  {
    id: "inf-003",
    name: "Model 03",
    handle: "@model_03",
    status: "active",
    totalContents: 76,
    todayContents: 3,
  },
  {
    id: "inf-004",
    name: "Model 04",
    handle: "@model_04",
    status: "paused",
    totalContents: 51,
    todayContents: 0,
  },
];
