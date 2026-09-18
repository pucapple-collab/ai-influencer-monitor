import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const RUNTIME_DIR = path.join(ROOT, "runtime");
const OUTPUT = path.join(RUNTIME_DIR, "local-status.json");
const TEMP = OUTPUT + ".tmp";

async function command(file, args = []) {
  try {
    const { stdout } = await execFileAsync(file, args, {
      cwd: ROOT,
      timeout: 3000
    });
    return stdout.trim();
  } catch {
    return "";
  }
}

async function nextOnline() {
  try {
    const response = await fetch("http://localhost:3000/api/monitor", {
      signal: AbortSignal.timeout(2000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function collect() {
  const [branch, changes, processes, online] = await Promise.all([
    command("git", ["branch", "--show-current"]),
    command("git", ["status", "--porcelain"]),
    command("/bin/ps", ["-axo", "pid=,command="]),
    nextOnline()
  ]);

  const relevantProcesses = processes
    .split("\n")
    .filter(line =>
      /next-server|next dev|electron\/main\.cjs|Electron.*main\.cjs/.test(line)
    )
    .slice(0, 12)
    .map(line => line.trim());

  return {
    source: "mac-local",
    project: "AI-Influencer-Factory/monitor-app",
    status: online ? "online" : "degraded",
    nextServer: online,
    gitBranch: branch || null,
    gitDirty: Boolean(changes),
    relevantProcesses,
    checkedAt: new Date().toISOString()
  };
}

async function save() {
  await mkdir(RUNTIME_DIR, { recursive: true });
  const status = await collect();

  await writeFile(TEMP, JSON.stringify(status, null, 2) + "\n", {
    mode: 0o600
  });

  await rename(TEMP, OUTPUT);

  console.log(
    `[local-monitor] ${status.status} | Next=${status.nextServer ? "ONLINE" : "OFFLINE"} | Git=${status.gitDirty ? "CHANGED" : "CLEAN"}`
  );
}

await save();
