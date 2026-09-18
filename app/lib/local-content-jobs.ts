import { promises as fs } from "fs";
import path from "path";

const file = path.join(process.cwd(), "runtime", "content-jobs.json");

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
};

export async function readContentJobs(): Promise<LocalContentJob[]> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return [];
  }
}

export async function writeContentJobs(data: LocalContentJob[]) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
}

export async function getContentJob(id: string) {
  return (await readContentJobs()).find((job) => job.id === id) ?? null;
}

export async function patchContentJob(
  id: string,
  patch: Partial<LocalContentJob>
): Promise<LocalContentJob | null> {
  const jobs = await readContentJobs();
  const index = jobs.findIndex((job) => job.id === id);
  if (index < 0) return null;
  jobs[index] = { ...jobs[index], ...patch, id: jobs[index].id };
  await writeContentJobs(jobs);
  return jobs[index];
}
