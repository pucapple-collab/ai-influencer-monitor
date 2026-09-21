import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { FactoryStage } from "./ai/factory-pipeline";

export type FactoryRun = {
  id: string;
  jobId: string;
  mode: "DRY_RUN";
  status: "COMPLETED";
  stages: FactoryStage[];
  externalCallMade: false;
  actualCost: 0;
  createdAt: string;
};

const file = path.join(process.cwd(), "runtime", "factory-runs.json");
const MAX_RECORDS = 300;
let mutationQueue: Promise<void> = Promise.resolve();

async function readUnlocked(): Promise<FactoryRun[]> {
  try { return JSON.parse(await fs.readFile(file, "utf8")); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeUnlocked(records: FactoryRun[]) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temp, JSON.stringify(records, null, 2) + "\n", { mode: 0o600 });
    await fs.rename(temp, file);
  } finally {
    await fs.rm(temp, { force: true }).catch(() => {});
  }
}

export async function saveFactoryRun(input: Omit<FactoryRun, "id" | "createdAt">) {
  let saved!: FactoryRun;
  const operation = mutationQueue.then(async () => {
    const records = await readUnlocked();
    saved = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
    records.unshift(saved);
    if (records.length > MAX_RECORDS) records.length = MAX_RECORDS;
    await writeUnlocked(records);
  });
  mutationQueue = operation.then(() => undefined, () => undefined);
  await operation;
  return saved;
}

export async function getFactoryRuns() {
  await mutationQueue;
  return readUnlocked();
}
