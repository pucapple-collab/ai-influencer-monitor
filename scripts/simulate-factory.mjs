const base = process.env.FACTORY_BASE_URL || "http://localhost:3000";

async function request(path, init) {
  const response = await fetch(base + path, {
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  const body = await response.json();
  return { status: response.status, body };
}

function assert(value, message) {
  if (!value) throw new Error(message);
}

const createdIds = [];
try {
  const unknown = await request("/api/ai-run", {
    method: "POST",
    body: JSON.stringify({ provider: "unknown", jobId: "x", mode: "dry_run" }),
  });
  assert(unknown.status === 400, "unknown provider must be 400");

  const create = async (title) => {
    const r = await request("/api/local-content-jobs", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
    assert(r.status === 200 && r.body.job?.id, "job creation failed");
    createdIds.push(r.body.job.id);
    return r.body.job.id;
  };

  const blockedId = await create("__sim_blocked__");
  const blocked = await request("/api/ai-run", {
    method: "POST",
    body: JSON.stringify({ provider: "gemini", jobId: blockedId, prompt: "test", mode: "dry_run" }),
  });
  assert(blocked.status === 409 && blocked.body.status === "BLOCKED", "approval gate failed");

  const successId = await create("__sim_success__");
  const ready = await request("/api/local-content-jobs", {
    method: "PATCH",
    body: JSON.stringify({ id: successId, approval: "approved", status: "ready", prompt: "test" }),
  });
  assert(ready.status === 200, "job ready transition failed");

  const dry = await request("/api/ai-run", {
    method: "POST",
    body: JSON.stringify({ provider: "gemini", jobId: successId, mode: "dry_run" }),
  });
  assert(dry.status === 200 && dry.body.status === "COMPLETED", "dry run failed");
  assert(dry.body.externalCallMade === false, "dry run made external call");
  assert(dry.body.execution?.actualCost === 0, "dry run cost must be zero");

  const failureId = await create("__sim_failure__");
  await request("/api/local-content-jobs", {
    method: "PATCH",
    body: JSON.stringify({ id: failureId, approval: "approved", status: "ready", prompt: "fail-test" }),
  });
  const failed = await request("/api/ai-run", {
    method: "POST",
    body: JSON.stringify({ provider: "claude", jobId: failureId, mode: "dry_run", simulateFailure: true }),
  });
  assert(failed.status === 500 && failed.body.status === "ERROR", "simulated failure path failed");

  const jobs = await request("/api/local-content-jobs");
  const successJob = jobs.body.jobs.find((x) => x.id === successId);
  const failedJob = jobs.body.jobs.find((x) => x.id === failureId);
  assert(successJob?.status === "review", "success job did not reach review");
  assert(failedJob?.status === "ready" && failedJob?.generationError, "failed job did not recover to ready");

  const executions = await request("/api/ai-executions");
  assert(executions.body.summary.completed >= 1, "completed execution was not recorded");
  assert(executions.body.summary.errors >= 1, "failed execution was not recorded");

  const monitor = await request("/api/monitor");
  assert(monitor.status === 200, "monitor failed");
  assert(monitor.body.localOperations.review >= 1, "monitor review metric failed");

  console.log("FACTORY SIMULATION PASS");
} finally {
  for (const id of createdIds) {
    await request("/api/local-content-jobs?id=" + encodeURIComponent(id), { method: "DELETE" }).catch(() => {});
  }
}
