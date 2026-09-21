import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

export type AgentId = "chatgpt" | "claude" | "gemini" | "higgsfield" | "work";
export type AgentLogStatus = "STARTED" | "PROGRESS" | "SUCCESS" | "ERROR" | "REVIEW" | "IMPROVEMENT";

export type AgentLogEntry = {
  id: string;
  agent: AgentId;
  task: string;
  status: AgentLogStatus;
  summary: string;
  error?: string;
  improvement?: string;
  relatedAgent?: AgentId;
  createdAt: string;
};

const file = path.join(process.cwd(), "runtime", "ai-development-log.json");
const MAX = 1000;
let writes: Promise<void> = Promise.resolve();

async function readRaw(): Promise<AgentLogEntry[]> {
  try {
    const parsed = JSON.parse(await fs.readFile(file, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function getAgentDevelopmentLog() {
  await writes;
  return readRaw();
}

export async function appendAgentDevelopmentLog(input: Omit<AgentLogEntry, "id" | "createdAt">) {
  const entry: AgentLogEntry = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
  const run = writes.then(async () => {
    const items = await readRaw();
    items.unshift(entry);
    if (items.length > MAX) items.length = MAX;
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temp = file + "." + process.pid + "." + randomUUID() + ".tmp";
    try {
      await fs.writeFile(temp, JSON.stringify(items, null, 2) + "\n", { mode: 0o600 });
      await fs.rename(temp, file);
    } finally {
      await fs.unlink(temp).catch(() => {});
    }
  });
  writes = run.then(() => undefined, () => undefined);
  await run;
  return entry;
}
