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
  const activation = await request("/api/activation-status");
  assert(activation.status === 200 && activation.body.ok, "activation status failed");
  assert(activation.body.externalCallMade === false && activation.body.paidUsageTriggered === false, "activation status must be zero-cost");
  assert(activation.body.realExecutionEnabled === false && activation.body.realPublishEnabled === false, "activation safety switches must stay disabled during validation");

  const readiness = await request("/api/production-readiness");
  assert(readiness.status === 200 && readiness.body.ok, "production readiness failed");
  assert(readiness.body.externalCallMade === false && readiness.body.paidUsageTriggered === false, "production readiness must be zero-cost");
  assert(readiness.body.realExecutionEnabled === false, "real execution must stay disabled during validation");
  assert(readiness.body.realPublishEnabled === false, "real publishing must stay disabled during validation");

  const plan = await request("/api/factory-plan");
  assert(plan.status === 200 && plan.body.ok, "factory plan failed");
  assert(plan.body.externalCallMade === false && plan.body.paidUsageTriggered === false, "factory plan must be zero-cost");

  const preflight = await request("/api/ai-preflight");
  assert(preflight.status === 200 && preflight.body.ok, "AI preflight failed");
  assert(preflight.body.externalCallMade === false, "preflight must not call providers");
  assert(preflight.body.paidUsageTriggered === false, "preflight must not trigger paid usage");

  const realDisabledId = await request("/api/local-content-jobs", {
    method: "POST",
    body: JSON.stringify({ title: "__sim_real_disabled__" }),
  });
  assert(realDisabledId.status === 200 && realDisabledId.body.job?.id, "real-disabled job creation failed");
  createdIds.push(realDisabledId.body.job.id);
  await request("/api/local-content-jobs", {
    method: "PATCH",
    body: JSON.stringify({ id: realDisabledId.body.job.id, approval: "approved", status: "ready", prompt: "must-not-call" }),
  });
  const realDisabled = await request("/api/ai-run", {
    method: "POST",
    body: JSON.stringify({ provider: "gemini", jobId: realDisabledId.body.job.id, mode: "real", confirmExternalCall: true }),
  });
  assert(realDisabled.status === 409 && realDisabled.body.status === "REAL_EXECUTION_DISABLED", "server real-execution safety switch failed");
  assert(realDisabled.body.externalCallMade === false, "disabled real execution made external call");

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

  const concurrentIds = await Promise.all(
    Array.from({ length: 8 }, (_, index) => create(`__sim_concurrent_${index}__`))
  );
  const concurrentList = await request("/api/local-content-jobs");
  for (const id of concurrentIds) {
    assert(concurrentList.body.jobs.some((job) => job.id === id), "concurrent content mutation was lost");
  }

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

  const factory = await request("/api/factory-dry-run", {
    method: "POST",
    body: JSON.stringify({ jobId: successId }),
  });
  assert(factory.status === 200 && factory.body.mode === "DRY_RUN", "factory orchestration dry-run failed");
  assert(factory.body.stages?.length === 3, "factory orchestration must contain 3 stages");
  assert(factory.body.externalCallMade === false && factory.body.actualCost === 0, "factory orchestration must be zero-cost");

  const dry = await request("/api/ai-run", {
    method: "POST",
    body: JSON.stringify({ provider: "gemini", jobId: successId, mode: "dry_run" }),
  });
  assert(dry.status === 200 && dry.body.status === "COMPLETED", "dry run failed");
  assert(dry.body.externalCallMade === false, "dry run made external call");
  assert(dry.body.execution?.actualCost === 0, "dry run cost must be zero");

  const replay = await request("/api/ai-run", {
    method: "POST",
    body: JSON.stringify({ provider: "gemini", jobId: successId, mode: "dry_run" }),
  });
  assert(replay.status === 409 && replay.body.status === "BLOCKED", "completed job replay must be blocked");
  assert(replay.body.externalCallMade === false, "blocked replay made external call");

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

  const publishDry = await request("/api/publish-gate", {
    method: "POST",
    body: JSON.stringify({ jobId: successId }),
  });
  assert(publishDry.status === 200 && publishDry.body.status === "PUBLISH_READY", "publish dry-run gate failed");
  assert(publishDry.body.externalCallMade === false && publishDry.body.actualCost === 0, "publish dry-run must be zero-cost");

  const publishRealBlocked = await request("/api/publish-gate", {
    method: "POST",
    body: JSON.stringify({ jobId: successId, mode: "real" }),
  });
  assert(publishRealBlocked.status === 409 && publishRealBlocked.body.status === "REAL_PUBLISH_DISABLED", "server real-publish safety switch failed");
  assert(publishRealBlocked.body.externalCallMade === false, "disabled real publishing made external call");
  assert(failedJob?.status === "ready" && failedJob?.generationError, "failed job did not recover to ready");

  const executions = await request("/api/ai-executions");
  assert(executions.body.summary.completed >= 1, "completed execution was not recorded");
  assert(executions.body.summary.errors >= 1, "failed execution was not recorded");

  if (process.env.FACTORY_SKIP_MONITOR !== "1") {
    const monitor = await request("/api/monitor");
    assert(monitor.status === 200, "monitor failed");
    assert(monitor.body.localOperations.review >= 1, "monitor review metric failed");
  }

  console.log("FACTORY SIMULATION PASS");
} finally {
  for (const id of createdIds) {
    await request("/api/local-content-jobs?id=" + encodeURIComponent(id), { method: "DELETE" }).catch(() => {});
  }
}
