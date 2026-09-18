
import { promises as fs } from "fs";
import path from "path";
import type { AIExecutionRecord } from "./execution";

const file = path.join(process.cwd(), "runtime", "ai-executions.json");

async function readRecords(): Promise<AIExecutionRecord[]> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return [];
  }
}

export async function saveExecution(
  record: AIExecutionRecord
): Promise<AIExecutionRecord> {
  const records = await readRecords();
  records.unshift(record);

  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(
    file,
    JSON.stringify(records, null, 2) + "\n",
    { mode: 0o600 }
  );

  return record;
}

export async function getExecutions(): Promise<AIExecutionRecord[]> {
  return readRecords();
}
