/* eslint-disable @typescript-eslint/no-require-imports -- This CommonJS harness loads TypeScript modules without starting Next.js. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: filename }).outputText, filename);
};
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "factory-provider-safety-"));
const originalCwd = process.cwd();
const originalFetch = global.fetch;
const originalSwitch = process.env.FACTORY_REAL_EXECUTION_ENABLED;
const originalGemini = process.env.GEMINI_API_KEY;
const originalClaude = process.env.ANTHROPIC_API_KEY;
const originalVercel = process.env.VERCEL;
const originalRemoteOverride = process.env.FACTORY_ALLOW_REMOTE_MUTATIONS;
async function main() {
  process.chdir(temp);
  process.env.FACTORY_REAL_EXECUTION_ENABLED = "false";
  process.env.GEMINI_API_KEY = "test-only-key";
  process.env.ANTHROPIC_API_KEY = "test-only-key";
  let calls = 0;
  global.fetch = async () => { calls++; throw new Error("Provider network call attempted"); };
  const { planProviderWork, getProviderWorkQueue, claimProviderWork, recoverStaleProviderWork } = require("../app/lib/ai/work-queue.ts");
  const { dispatchFactoryTask } = require("../app/lib/ai/dispatcher.ts");
  const { getProviderAudit } = require("../app/lib/ai/dispatch-audit.ts");
  const { NextRequest } = require("next/server");
  const { blockRemoteMutation } = require("../app/lib/local-api-guard.ts");
  assert.equal(blockRemoteMutation(new NextRequest("http://localhost:3000/api/ai-run")), null);
  assert.equal(blockRemoteMutation(new NextRequest("https://example.com/api/ai-run")).status, 403);
  process.env.VERCEL = "1";
  assert.equal(blockRemoteMutation(new NextRequest("http://localhost:3000/api/ai-run")).status, 403);
  process.env.FACTORY_ALLOW_REMOTE_MUTATIONS = "true";
  assert.equal(blockRemoteMutation(new NextRequest("http://localhost:3000/api/ai-run")).status, 403);
  delete process.env.FACTORY_ALLOW_REMOTE_MUTATIONS;
  for (const route of ["ai-run", "factory-dry-run", "local-characters", "local-content-jobs", "provider-work", "provider-queue-run", "provider-dispatch", "provider-dispatch-batch", "publish-gate"]) {
    const handlers = require(`../app/api/${route}/route.ts`);
    for (const method of ["POST", "PATCH", "DELETE"]) {
      if (!handlers[method]) continue;
      const request = new NextRequest(`http://localhost:3000/api/${route}`, { method, headers: { "content-type": "application/json" }, body: method === "DELETE" ? undefined : "{}" });
      assert.equal((await handlers[method](request)).status, 403, `${method} ${route} must reject hosted mutations`);
    }
  }
  delete process.env.VERCEL;
  for (const task of ["architecture", "coding", "research", "bulk", "image", "video"]) {
    const result = await dispatchFactoryTask({ task, prompt: "safety test", mode: "dry_run", confirmExternalCall: true });
    assert.equal(result.status, "DRY_RUN");
    assert.equal(result.externalCallMade, false);
    assert.equal(result.paidUsageTriggered, false);
  }
  const blocked = await dispatchFactoryTask({ task: "coding", prompt: "safety test", mode: "real", confirmExternalCall: true });
  assert.equal(blocked.status, "BLOCKED");
  assert.equal(blocked.externalCallMade, false);
  assert.equal(calls, 0);
  const item = await planProviderWork("coding", "claim test");
  const claims = await Promise.all(Array.from({ length: 12 }, () => claimProviderWork(item.id)));
  assert.equal(claims.filter(Boolean).length, 1, "Only one runner may claim a planned item");
  assert.equal((await getProviderWorkQueue()).find((row) => row.id === item.id).attempts, 1);
  assert.equal((await recoverStaleProviderWork()).length, 0, "Fresh RUNNING must remain active");
  const queueFile = path.join(temp, "runtime", "provider-work.json");
  const queue = JSON.parse(fs.readFileSync(queueFile, "utf8"));
  queue[0].updatedAt = new Date(Date.now() - 6 * 60 * 1000).toISOString();
  fs.writeFileSync(queueFile, JSON.stringify(queue));
  const { POST: runQueue } = require("../app/api/provider-queue-run/route.ts");
  const recoveryResponse = await runQueue(new NextRequest("http://localhost:3000/api/provider-queue-run", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }));
  assert.equal(recoveryResponse.status, 200);
  const recovered = (await getProviderWorkQueue()).find((row) => row.id === item.id);
  assert.equal(recovered.status, "ERROR");
  assert.equal((await recoverStaleProviderWork()).length, 0, "Recovery must be idempotent");
  assert.equal(await claimProviderWork(item.id), null, "Recovered work must not retry automatically");
  assert.equal((await getProviderAudit())[0].status, "STALE_RUNNING_RECOVERED");
  assert.equal((await getProviderAudit())[0].externalCallUncertain, false, "A stale dry-run cannot have an uncertain paid call");
  const realItem = await planProviderWork("coding", "uncertain real recovery test");
  assert.equal((await claimProviderWork(realItem.id, "real")).lastMode, "real");
  const realQueue = JSON.parse(fs.readFileSync(queueFile, "utf8"));
  realQueue.find((row) => row.id === realItem.id).updatedAt = new Date(Date.now() - 6 * 60 * 1000).toISOString();
  fs.writeFileSync(queueFile, JSON.stringify(realQueue));
  await runQueue(new NextRequest("http://localhost:3000/api/provider-queue-run", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }));
  assert.equal((await getProviderAudit())[0].externalCallUncertain, true, "A stale real run must flag uncertain external usage");
  assert.equal(await claimProviderWork(realItem.id, "real"), null);
  assert.equal(calls, 0);
  console.log("PROVIDER SAFETY PASS: dry-run, zero network calls, single claim, stale recovery, audit");
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => {
  global.fetch = originalFetch;
  process.chdir(originalCwd);
  if (originalSwitch === undefined) delete process.env.FACTORY_REAL_EXECUTION_ENABLED; else process.env.FACTORY_REAL_EXECUTION_ENABLED = originalSwitch;
  if (originalGemini === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalGemini;
  if (originalClaude === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = originalClaude;
  if (originalVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = originalVercel;
  if (originalRemoteOverride === undefined) delete process.env.FACTORY_ALLOW_REMOTE_MUTATIONS; else process.env.FACTORY_ALLOW_REMOTE_MUTATIONS = originalRemoteOverride;
  fs.rmSync(temp, { recursive: true, force: true });
});
