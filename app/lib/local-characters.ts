import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

export type LocalCharacter = {
  id: string;
  name: string;
  concept: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

const file = path.join(process.cwd(), "runtime", "characters.json");
let mutationQueue: Promise<void> = Promise.resolve();

async function readUnlocked(): Promise<LocalCharacter[]> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    if (error instanceof SyntaxError) { await fs.rename(file, file + ".corrupt." + Date.now()).catch(() => {}); return []; }
    throw error;
  }
}

async function writeUnlocked(data: LocalCharacter[]) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temp, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
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

export async function readCharacters() {
  await mutationQueue;
  return readUnlocked();
}

export async function createCharacter(input: { name: string; concept: string }) {
  return withMutationLock(async () => {
    const characters = await readUnlocked();
    const now = new Date().toISOString();
    const character: LocalCharacter = { id: randomUUID(), name: input.name, concept: input.concept, status: "draft", createdAt: now, updatedAt: now };
    characters.unshift(character);
    await writeUnlocked(characters);
    return character;
  });
}

export async function patchCharacter(id: string, patch: Partial<Pick<LocalCharacter, "name" | "concept" | "status">>) {
  return withMutationLock(async () => {
    const characters = await readUnlocked();
    const index = characters.findIndex((item) => item.id === id);
    if (index < 0) return null;
    characters[index] = { ...characters[index], ...patch, id, updatedAt: new Date().toISOString() };
    await writeUnlocked(characters);
    return characters[index];
  });
}

export async function deleteCharacter(id: string) {
  return withMutationLock(async () => {
    const characters = await readUnlocked();
    const index = characters.findIndex((item) => item.id === id);
    if (index < 0) return false;
    characters.splice(index, 1);
    await writeUnlocked(characters);
    return true;
  });
}
