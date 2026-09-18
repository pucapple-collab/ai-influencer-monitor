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

let jobId;
try {
  const unknown = await request("/api/ai-run", {
    method: "POST",
    body: JSON.stringify({ provider: "unknown", jobId: "x", prompt: "x", mode: "dry_run" }),
  });
  assert(unknown.status === 400, "unknown provider must be 400");

  const created = await request("/api/local-content-jobs", {
    method: "POST",
    body: JSON.stringify({ title: "__factory_simulation__" }),
  });
  assert(created.status === 200 && created.body.job?.id, "job creation failed");
  jobId = created.body.job.id;

  const blocked = await request("/api/ai-run", {
    method: "POST",
    body: JSON.stringify({ provider: "gemini", jobId, prompt: "test", mode: "dry_run" }),
  });
  assert(blocked.status === 409 && blocked.body.status === "BLOCKED", "approval gate failed");

  const ready = await request("/api/local-content-jobs", {
    method: "PATCH",
    body: JSON.stringify({ id: jobId, approval: "approved", status: "ready", prompt: "test" }),
  });
  assert(ready.status === 200, "job ready transition failed");

  const dry = await request("/api/ai-run", {
    method: "POST",
    body: JSON.stringify({ provider: "gemini", jobId, mode: "dry_run" }),
  });
  assert(dry.status === 200 && dry.body.status === "COMPLETED", "dry run failed");
  assert(dry.body.externalCallMade === false, "dry run made external call");
  assert(dry.body.execution?.actualCost === 0, "dry run cost must be zero");

  const jobs = await request("/api/local-content-jobs");
  const job = jobs.body.jobs.find((x) => x.id === jobId);
  assert(job?.status === "review", "job did not reach review");

  const executions = await request("/api/ai-executions");
  assert(executions.body.summary.completed >= 1, "execution was not recorded");

  const monitor = await request("/api/monitor");
  assert(monitor.status === 200, "monitor failed");
  assert(monitor.body.localOperations.review >= 1, "monitor review metric failed");

  console.log("FACTORY SIMULATION PASS");
} finally {
  if (jobId) {
    await request("/api/local-content-jobs?id=" + encodeURIComponent(jobId), { method: "DELETE" }).catch(() => {});
  }
}
