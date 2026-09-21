import { NextRequest, NextResponse } from "next/server";
import { adapters, type AIProviderId } from "../../lib/ai/adapters";
import { canExecuteAI, isAIProviderId } from "../../lib/ai/providers";
import { createExecutionRecord } from "../../lib/ai/execution";
import { canStartGeneration } from "../../lib/ai/pipeline";
import { saveExecution } from "../../lib/ai/execution-store";
import { getContentJob, patchContentJob } from "../../lib/local-content-jobs";
import { runDrySimulation } from "../../lib/ai/simulation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const providerValue = String(body.provider ?? "").trim();
    const jobId = String(body.jobId ?? "").trim();
    const mode = String(body.mode ?? "dry_run").toLowerCase();

    if (!providerValue || !jobId)
      return NextResponse.json({ ok: false, executed: false, error: "provider, jobId가 필요합니다." }, { status: 400 });
    if (!isAIProviderId(providerValue))
      return NextResponse.json({ ok: false, executed: false, status: "BLOCKED", paidRequired: false, jobId, provider: providerValue, message: "지원하지 않는 AI Provider입니다." }, { status: 400 });
    if (!["dry_run", "real"].includes(mode))
      return NextResponse.json({ ok: false, executed: false, error: "mode must be dry_run or real" }, { status: 400 });

    const provider = providerValue as AIProviderId;
    const job = await getContentJob(jobId);
    if (!job)
      return NextResponse.json({ ok: false, executed: false, status: "BLOCKED", error: "Content job not found." }, { status: 404 });

    const approval = String(job.approval ?? "pending").toLowerCase();
    const jobStatus = String(job.status ?? "draft").toLowerCase();
    const execution = createExecutionRecord(jobId, provider, mode === "dry_run" ? "DRY_RUN" : "REAL");

    if (!canStartGeneration(approval, jobStatus)) {
      const saved = await saveExecution({ ...execution, status: "BLOCKED", error: "Stored content job is not approved/ready." });
      return NextResponse.json({ ok: false, executed: false, externalCallMade: false, status: "BLOCKED", paidRequired: false, jobId, provider, execution: saved, message: "저장된 콘텐츠 상태가 생성 조건을 만족하지 않습니다." }, { status: 409 });
    }

    const prompt = String(body.prompt ?? job.prompt ?? "").trim();
    if (!prompt)
      return NextResponse.json({ ok: false, executed: false, status: "BLOCKED", error: "Prompt required." }, { status: 400 });

    await patchContentJob(jobId, { status: "generating", generationError: "" });

    if (mode === "dry_run") {
      const result = await runDrySimulation(provider, prompt, Boolean(body.simulateFailure));
      if (result.status === "ERROR") {
        const saved = await saveExecution({ ...execution, status: "ERROR", error: result.error, completedAt: new Date().toISOString() });
        await patchContentJob(jobId, { status: "ready", generationError: result.error ?? "Simulation failed." });
        return NextResponse.json({ ok: false, executed: false, paidRequired: false, execution: saved, ...result }, { status: 500 });
      }
      const saved = await saveExecution({ ...execution, status: "COMPLETED", executed: false, externalCallMade: false, completedAt: new Date().toISOString() });
      await patchContentJob(jobId, { status: "review", generationResult: result.output, generationError: "" });
      return NextResponse.json({ ok: true, jobId, paidRequired: false, execution: saved, ...result });
    }

    if (process.env.FACTORY_REAL_EXECUTION_ENABLED !== "true") {
      await patchContentJob(jobId, { status: "ready" });
      return NextResponse.json({ ok: false, executed: false, externalCallMade: false, status: "REAL_EXECUTION_DISABLED", paidRequired: false, jobId, provider, message: "실제 AI 호출은 서버 안전 스위치가 비활성화되어 있습니다." }, { status: 409 });
    }

    if (body.confirmExternalCall !== true) {
      await patchContentJob(jobId, { status: "ready" });
      return NextResponse.json({ ok: false, executed: false, externalCallMade: false, status: "CONFIRMATION_REQUIRED", paidRequired: true, jobId, provider, message: "실제 외부 API 호출은 명시적 확인이 필요합니다." }, { status: 409 });
    }

    if (!canExecuteAI(provider)) {
      const saved = await saveExecution({ ...execution, status: "BLOCKED", error: "Provider is not connected." });
      await patchContentJob(jobId, { status: "ready" });
      return NextResponse.json({ ok: false, executed: false, externalCallMade: false, paidRequired: false, status: "NOT_CONNECTED", jobId, provider, estimatedCost: 0, execution: saved, message: "Provider 연결이 없어 외부 API를 호출하지 않았습니다." }, { status: 409 });
    }

    const result = await adapters[provider].execute({ prompt, model: body.model });
    const status = result.status === "COMPLETED" ? "COMPLETED" : result.status === "READY" ? "QUEUED" : "ERROR";
    const saved = await saveExecution({
      ...execution,
      status,
      executed: result.executed,
      externalCallMade: result.executed,
      estimatedCost: result.estimatedCost,
      actualCost: 0,
      completedAt: status === "COMPLETED" || status === "ERROR" ? new Date().toISOString() : undefined,
      error: result.error,
    });
    await patchContentJob(jobId, status === "COMPLETED"
      ? { status: "review", generationResult: result.output, generationError: "" }
      : status === "ERROR"
        ? { status: "ready", generationError: result.error ?? "AI execution failed." }
        : { status: "generating" });

    return NextResponse.json({ ok: status !== "ERROR", jobId, paidRequired: result.executed, externalCallMade: result.executed, execution: saved, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, executed: false, externalCallMade: false, estimatedCost: 0, error: error instanceof Error ? error.message : "AI execution failed." }, { status: 500 });
  }
}
