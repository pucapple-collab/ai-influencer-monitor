import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const file = path.join(process.cwd(), "runtime", "characters.json");

type Character = {
  id: string;
  name: string;
  concept: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

async function readCharacters(): Promise<Character[]> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return [];
  }
}

async function writeCharacters(data: Character[]) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2), {
    mode: 0o600,
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    characters: await readCharacters(),
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const name = String(body.name ?? "").trim();
  const concept = String(body.concept ?? "").trim();

  if (!name) {
    return NextResponse.json(
      { ok: false, error: "Character name is required." },
      { status: 400 }
    );
  }

  const characters = await readCharacters();
  const now = new Date().toISOString();

  const character: Character = {
    id: crypto.randomUUID(),
    name,
    concept,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };

  characters.unshift(character);
  await writeCharacters(characters);

  return NextResponse.json({ ok: true, character });
}


export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const characters = await readCharacters();
  const index = characters.findIndex((item) => item.id === body.id);

  if (index < 0)
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  characters[index] = {
    ...characters[index],
    name: String(body.name ?? characters[index].name).trim(),
    concept: String(body.concept ?? characters[index].concept).trim(),
    status: String(body.status ?? characters[index].status),
    updatedAt: new Date().toISOString(),
  };

  await writeCharacters(characters);
  return NextResponse.json({ ok: true, character: characters[index] });
}

export async function DELETE(request: NextRequest) {
  const id = new URL(request.url).searchParams.get("id");
  const characters = await readCharacters();
  const next = characters.filter((item) => item.id !== id);

  if (next.length === characters.length)
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  await writeCharacters(next);
  return NextResponse.json({ ok: true });
}
