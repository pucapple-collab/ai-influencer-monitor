import { randomUUID } from "crypto";
import type { FactoryTaskKind } from "./orchestrator";
import { routeFactoryTask } from "./orchestrator";

export type ProviderWorkItem = {
  id: string;
  task: FactoryTaskKind;
  prompt: string;
  primary: string;
  fallback?: string;
  status: "PLANNED" | "BLOCKED";
  executableNow: boolean;
  createdAt: string;
};

const queue: ProviderWorkItem[] = [];
const MAX = 200;

export function planProviderWork(task: FactoryTaskKind, prompt: string): ProviderWorkItem {
  const clean = prompt.trim();
  if (!clean) throw new Error("Prompt required.");
  const route = routeFactoryTask(task);
  const item: ProviderWorkItem = {
    id: randomUUID(), task, prompt: clean, primary: route.primary, fallback: route.fallback,
    status: route.executableNow ? "PLANNED" : "BLOCKED",
    executableNow: route.executableNow, createdAt: new Date().toISOString(),
  };
  queue.unshift(item);
  if (queue.length > MAX) queue.length = MAX;
  return item;
}
export function getProviderWorkQueue() { return [...queue]; }
