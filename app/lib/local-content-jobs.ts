import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

const file = path.join(process.cwd(), "runtime", "content-jobs.json");
let mutationQueue: Promise<void> = Promise.resolve();

export type LocalContentJob = {
  id: string;
  title: string;
  characterId: string | null;
  type: string;
  status: string;
  createdAt: string;
  script?: string;
  prompt?: string;
  approval?: string;
  generationResult?: string;
  generationError?: string;
  reviewDecision?: "pending" | "approved" | "rejected";
  reviewNote?: string;
  reviewedAt?: string;
  publishedAt?: string;
};

async function readUnlocked(): Promise<LocalContentJob[]> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeUnlocked(data: LocalContentJob[]) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temp, JSON.stringify(data, null, 2) + "\\n", { mode: 0o600 });
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

export async function readContentJobs(): Promise<LocalContentJob[]> {
  await mutationQueue;
  return readUnlocked();
}

export async function writeContentJobs(data: LocalContentJob[]) {
  return withMutationLock(() => writeUnlocked(data));
}

export async function mutateContentJobs<T>(mutation: (jobs: LocalContentJob[]) => T | Promise<T>): Promise<T> {
  return withMutationLock(async () => {
    const jobs = await readUnlocked();
    const result = await mutation(jobs);
    await writeUnlocked(jobs);
    return result;
  });
}

export async function getContentJob(id: string) {
  return (await readContentJobs()).find((job) => job.id === id) ?? null;
}

export async function deleteContentJobsForCharacter(characterId: string): Promise<number> {
  return mutateContentJobs((jobs) => {
    let removed = 0;
    for (let index = jobs.length - 1; index >= 0; index -= 1) {
      if (jobs[index].characterId === characterId) {
        jobs.splice(index, 1);
        removed += 1;
      }
    }
    return removed;
  });
}

export async function patchContentJob(id: string, patch: Partial<LocalContentJob>): Promise<LocalContentJob | null> {
  return mutateContentJobs((jobs) => {
    const index = jobs.findIndex((job) => job.id === id);
    if (index < 0) return null;
    jobs[index] = { ...jobs[index], ...patch, id: jobs[index].id };
    return jobs[index];
  });
}
