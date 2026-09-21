import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { AIExecutionRecord } from "./execution";

const file = path.join(process.cwd(), "runtime", "ai-executions.json");
const MAX_RECORDS = 500;
let mutationQueue: Promise<void> = Promise.resolve();

async function readUnlocked(): Promise<AIExecutionRecord[]> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    if (error instanceof SyntaxError) {
      await fs.rename(file, file + ".corrupt." + Date.now()).catch(() => {});
      return [];
    }
    throw error;
  }
}

async function writeUnlocked(records: AIExecutionRecord[]) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temp, JSON.stringify(records, null, 2) + "\n", { mode: 0o600 });
    await fs.rename(temp, file);
  } finally {
    await fs.rm(temp, { force: true }).catch(() => {});
  }
}

function withMutationLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = mutationQueue.then(operation, operation);
  mutationQueue = result.then(() => undefined, () => undefined);
  return result;
}

export async function saveExecution(record: AIExecutionRecord): Promise<AIExecutionRecord> {
  return withMutationLock(async () => {
    const records = await readUnlocked();
    records.unshift(record);
    if (records.length > MAX_RECORDS) records.length = MAX_RECORDS;
    await writeUnlocked(records);
    return record;
  });
}

export async function getExecutions(): Promise<AIExecutionRecord[]> {
  await mutationQueue;
  return readUnlocked();
}
