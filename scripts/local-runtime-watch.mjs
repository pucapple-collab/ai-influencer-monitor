import { spawn } from "node:child_process";
import process from "node:process";

const ROOT = process.cwd();

function collect() {
  const child = spawn(
    process.execPath,
    ["scripts/local-runtime-monitor.mjs"],
    {
      cwd: ROOT,
      stdio: "inherit"
    }
  );

  child.on("error", error => {
    console.error("[local-monitor] collector error:", error.message);
  });
}

collect();

const timer = setInterval(collect, 10000);

function stop() {
  clearInterval(timer);
  process.exit(0);
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
