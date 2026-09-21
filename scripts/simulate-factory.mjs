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
const createdCharacterIds = [];
try {
  const backup = await request("/api/local-backup");
  assert(backup.status === 200, "local backup export failed");
  assert(backup.body.schemaVersion === 1 && backup.body.secretsIncluded === false, "backup safety metadata missing");
  assert(backup.body.externalCallMade === false && backup.body.paidUsageTriggered === false, "backup export must stay zero-cost");
  assert(Array.isArray(backup.body.data?.characters) && Array.isArray(backup.body.data?.jobs), "backup core collections missing");

  const dataIntegrity = await request("/api/data-integrity");
  assert(dataIntegrity.status === 200 && dataIntegrity.body.ok, "data integrity check failed");
  assert(dataIntegrity.body.externalCallMade === false && dataIntegrity.body.paidUsageTriggered === false, "data integrity check must stay zero-cost");

  const runtimeHealth = await request("/api/runtime-health");
  assert(runtimeHealth.status === 200 && runtimeHealth.body.ok, "runtime health failed");
  assert(runtimeHealth.body.externalCallMade === false && runtimeHealth.body.paidUsageTriggered === false, "runtime health must stay zero-cost");
  assert(runtimeHealth.body.limits?.executionRecords === 500 && runtimeHealth.body.limits?.publishAuditRecords === 500, "runtime retention limits missing");

  const widgetStatus = await request("/api/widget-status");
  assert(widgetStatus.status === 200 && widgetStatus.body.ok, "widget status failed");
  assert(widgetStatus.body.externalCallMade === false && widgetStatus.body.paidUsageTriggered === false, "widget status must stay zero-cost");
  assert(Array.isArray(widgetStatus.body.messages) && widgetStatus.body.messages.length > 0, "widget status messages missing");
  assert(typeof widgetStatus.body.summary?.recentErrors === "number", "widget recent-error signal missing");

  const concurrentCharacters = await Promise.all(
    Array.from({ length: 6 }, (_, index) => request("/api/local-characters", {
      method: "POST",
      body: JSON.stringify({ name: `__sim_character_${index}__`, concept: "concurrency test" }),
    }))
  );
  const characterList = await request("/api/local-characters");
  for (const response of concurrentCharacters) {
    assert(response.status === 200 && response.body.character?.id, "concurrent character creation failed");
    createdCharacterIds.push(response.body.character.id);
    assert(characterList.body.characters.some((item) => item.id === response.body.character.id), "concurrent character mutation was lost");
  }

  const activation = await request("/api/activation-status");
  assert(activation.status === 200 && activation.body.ok, "activation status failed");
  assert(activation.body.externalCallMade === false && activation.body.paidUsageTriggered === false, "activation status must be zero-cost");
  assert(activation.body.realExecutionEnabled === false && activation.body.realPublishEnabled === false, "activation safety switches must stay disabled during validation");
  assert(activation.body.anyProviderReady === false, "CI must not pretend a paid provider is configured");
  assert(activation.body.fullFactoryProvidersReady === false, "CI must not pretend the full provider set is configured");

  const readiness = await request("/api/production-readiness");
  assert(readiness.status === 200 && readiness.body.ok, "production readiness failed");
  assert(readiness.body.externalCallMade === false && readiness.body.paidUsageTriggered === false, "production readiness must be zero-cost");
  assert(readiness.body.realExecutionEnabled === false, "real execution must stay disabled during validation");
  assert(readiness.body.realPublishEnabled === false, "real publishing must stay disabled during validation");

  const plan = await request("/api/factory-plan");
  assert(plan.status === 200 && plan.body.ok, "factory plan failed");
  assert(plan.body.externalCallMade === false && plan.body.paidUsageTriggered === false, "factory plan must be zero-cost");
  assert(plan.body.phase === "AWAITING_FIRST_PROVIDER", "CI factory plan must await first provider");
  assert(plan.body.progress?.total === 7, "factory plan milestones missing");
  assert(plan.body.realExecutionEnabled === false && plan.body.realPublishEnabled === false, "factory plan safety switches must stay disabled");

  const plannedWork = await request("/api/provider-work", {
    method: "POST",
    body: JSON.stringify({ task: "research", prompt: "__sim_provider_work__" }),
  });
  assert(plannedWork.status === 200 && plannedWork.body.item?.id, "provider work planning failed");
  assert(plannedWork.body.externalCallMade === false && plannedWork.body.paidUsageTriggered === false, "provider work planning must stay zero-cost");
  const workQueue = await request("/api/provider-work");
  assert(workQueue.status === 200 && workQueue.body.items.some((item) => item.id === plannedWork.body.item.id), "provider work queue did not persist planned item");

  const dispatchDry = await request("/api/provider-dispatch", {
    method: "POST",
    body: JSON.stringify({ task: "coding", prompt: "zero-cost dispatch test" }),
  });
  assert(dispatchDry.status === 200 && dispatchDry.body.status === "DRY_RUN", "provider dispatch dry-run failed");
  assert(dispatchDry.body.externalCallMade === false && dispatchDry.body.paidUsageTriggered === false, "provider dispatch dry-run must stay zero-cost");

  const dispatchRealBlocked = await request("/api/provider-dispatch", {
    method: "POST",
    body: JSON.stringify({ task: "coding", prompt: "must-not-call", mode: "real", confirmExternalCall: true }),
  });
  assert(dispatchRealBlocked.status === 409 && dispatchRealBlocked.body.status === "BLOCKED", "provider dispatcher real-call safety gate failed");
  assert(dispatchRealBlocked.body.externalCallMade === false, "blocked provider dispatch made external call");

  const providerOps = await request("/api/provider-ops");
  assert(providerOps.status === 200 && providerOps.body.ok, "provider ops summary failed");
  assert(providerOps.body.externalCallMade === false && providerOps.body.paidUsageTriggered === false, "provider ops summary must stay zero-cost");

  const dispatchBatch = await request("/api/provider-dispatch-batch", {
    method: "POST",
    body: JSON.stringify({ jobs: [
      { task: "coding", prompt: "batch-code-test" },
      { task: "research", prompt: "batch-research-test" },
      { task: "bulk", prompt: "batch-bulk-test" }
    ] }),
  });
  assert(dispatchBatch.status === 200 && dispatchBatch.body.count === 3, "provider batch dispatch failed");
  assert(dispatchBatch.body.externalCallMade === false && dispatchBatch.body.paidUsageTriggered === false, "provider batch dispatch must stay zero-cost");
  assert(dispatchBatch.body.results.every((item) => item.status === "DRY_RUN"), "provider batch must default to dry-run");

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

  const factoryId = await create("__sim_factory__");
  const factoryReady = await request("/api/local-content-jobs", {
    method: "PATCH",
    body: JSON.stringify({ id: factoryId, approval: "approved", status: "ready", prompt: "factory-test" }),
  });
  assert(factoryReady.status === 200, "factory job ready transition failed");

  const factory = await request("/api/factory-dry-run", {
    method: "POST",
    body: JSON.stringify({ jobId: factoryId }),
  });
  assert(factory.status === 200 && factory.body.mode === "DRY_RUN", "factory orchestration dry-run failed");
  assert(factory.body.stages?.length === 3, "factory orchestration must contain 3 stages");
  assert(factory.body.externalCallMade === false && factory.body.actualCost === 0, "factory orchestration must be zero-cost");
  assert(factory.body.runId && factory.body.jobStatus === "review", "factory dry-run must persist history and move job to review");

  const factoryRuns = await request("/api/factory-runs");
  assert(factoryRuns.status === 200 && factoryRuns.body.ok, "factory run history failed");
  assert(factoryRuns.body.externalCallMade === false && factoryRuns.body.paidUsageTriggered === false, "factory history must stay zero-cost");
  assert(factoryRuns.body.runs.some((run) => run.id === factory.body.runId && run.jobId === factoryId), "factory run missing from history");

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
  assert(publishRealBlocked.body.audit?.status === "REAL_PUBLISH_DISABLED", "disabled real publishing must be audited");

  const publishAudit = await request("/api/publish-audit");
  assert(publishAudit.status === 200 && publishAudit.body.ok, "publish audit fetch failed");
  assert(publishAudit.body.externalCallMade === false && publishAudit.body.paidUsageTriggered === false, "publish audit endpoint must stay zero-cost");
  assert(publishAudit.body.records.some((item) => item.jobId === successId && item.status === "REAL_PUBLISH_DISABLED"), "publish safety decision missing from audit trail");
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
  for (const id of createdCharacterIds) {
    await request("/api/local-characters?id=" + encodeURIComponent(id), { method: "DELETE" }).catch(() => {});
  }
}
