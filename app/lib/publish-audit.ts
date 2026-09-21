import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

export type PublishAuditRecord = {
  id: string;
  jobId: string;
  mode: "DRY_RUN" | "REAL";
  status: "PUBLISH_READY" | "BLOCKED" | "REAL_PUBLISH_DISABLED" | "CONFIRMATION_REQUIRED" | "NOT_CONNECTED" | "PUBLISH_PLATFORM_REQUIRED" | "PUBLISH_CREDENTIALS_REQUIRED" | "PUBLISH_ADAPTER_REQUIRED" | "PUBLISHED" | "ERROR";
  externalCallMade: boolean;
  platform?: string;
  requestId?: string;
  postId?: string;
  actualCost: 0;
  message: string;
  createdAt: string;
};

const file = path.join(process.cwd(), "runtime", "publish-audit.json");
const MAX_RECORDS = 500;
let mutationQueue: Promise<void> = Promise.resolve();

async function readUnlocked(): Promise<PublishAuditRecord[]> {
  try { return JSON.parse(await fs.readFile(file, "utf8")); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    if (error instanceof SyntaxError) {
      await fs.rename(file, file + ".corrupt." + Date.now()).catch(() => {});
      return [];
    }
    throw error;
  }
}

async function writeUnlocked(records: PublishAuditRecord[]) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temp, JSON.stringify(records, null, 2) + "\n", { mode: 0o600 });
    await fs.rename(temp, file);
  } finally {
    await fs.rm(temp, { force: true }).catch(() => {});
  }
}

export async function savePublishAudit(record: Omit<PublishAuditRecord, "id" | "createdAt">) {
  let saved!: PublishAuditRecord;
  const operation = mutationQueue.then(async () => {
    const records = await readUnlocked();
    saved = { ...record, id: randomUUID(), createdAt: new Date().toISOString() };
    records.unshift(saved);
    if (records.length > MAX_RECORDS) records.length = MAX_RECORDS;
    await writeUnlocked(records);
  });
  mutationQueue = operation.then(() => undefined, () => undefined);
  await operation;
  return saved;
}

export async function getPublishAudit() {
  await mutationQueue;
  return readUnlocked();
}
