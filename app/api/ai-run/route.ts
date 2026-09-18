
import { NextRequest, NextResponse } from "next/server";
import { adapters, AIProviderId } from "../../lib/ai/adapters";
import {
  canExecuteAI,
  isAIProviderId,
} from "../../lib/ai/providers";
import { createExecutionRecord } from "../../lib/ai/execution";
import { canStartGeneration } from "../../lib/ai/pipeline";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const providerValue = String(body.provider ?? "").trim();
    const jobId = String(body.jobId ?? "").trim();
    const prompt = String(body.prompt ?? "").trim();
    const approval = String(body.approval ?? "").toLowerCase();

    if (!providerValue || !jobId || !prompt) {
      return NextResponse.json(
        {
          ok: false,
          executed: false,
          error: "provider, jobId, prompt가 필요합니다.",
        },
        { status: 400 }
      );
    }

    if (!isAIProviderId(providerValue)) {
      return NextResponse.json(
        {
          ok: false,
          executed: false,
          status: "BLOCKED",
          paidRequired: false,
          jobId,
          provider: providerValue,
          message: "지원하지 않는 AI Provider입니다.",
        },
        { status: 400 }
      );
    }

    const provider = providerValue as AIProviderId;
    const execution = createExecutionRecord(jobId, provider);

    if (approval !== "approved") {
      return NextResponse.json(
        {
          ok: false,
          executed: false,
          status: "BLOCKED",
          paidRequired: false,
          jobId,
          provider,
          execution: {
            ...execution,
            status: "BLOCKED",
          },
          message: "콘텐츠 승인이 완료되지 않아 AI 실행을 차단했습니다.",
        },
        { status: 409 }
      );
    }

    const jobStatus = String(body.jobStatus ?? "ready");

    if (!canStartGeneration(approval, jobStatus)) {
      return NextResponse.json(
        {
          ok: false,
          executed: false,
          status: "BLOCKED",
          paidRequired: false,
          jobId,
          provider,
          execution: {
            ...execution,
            status: "BLOCKED",
          },
          message:
            "콘텐츠가 승인되지 않았거나 생성 가능한 상태가 아니어서 실행을 차단했습니다.",
        },
        { status: 409 }
      );
    }

    if (!canExecuteAI(provider)) {
      return NextResponse.json(
        {
          ok: false,
          executed: false,
          paidRequired: false,
          status: "NOT_CONNECTED",
          jobId,
          provider,
          estimatedCost: 0,
          execution: {
            ...execution,
            status: "BLOCKED",
          },
          message: "Provider 연결이 없어 외부 API를 호출하지 않았습니다.",
        },
        { status: 409 }
      );
    }

    const adapter = adapters[provider];

    if (!adapter) {
      return NextResponse.json(
        {
          ok: false,
          executed: false,
          error: `Adapter가 없습니다: ${provider}`,
        },
        { status: 404 }
      );
    }

    const result = await adapter.execute({
      prompt,
      model: body.model,
    });

    return NextResponse.json({
      ok: result.status === "COMPLETED" || result.status === "READY",
      jobId,
      paidRequired: false,
      execution: {
        ...execution,
        status:
          result.status === "COMPLETED"
            ? "COMPLETED"
            : result.status === "READY"
              ? "QUEUED"
              : "ERROR",
        executed: result.executed,
        estimatedCost: result.estimatedCost,
        actualCost: 0,
        completedAt:
          result.status === "COMPLETED"
            ? new Date().toISOString()
            : undefined,
        error: result.error,
      },
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        executed: false,
        estimatedCost: 0,
        error:
          error instanceof Error ? error.message : "AI execution failed.",
      },
      { status: 500 }
    );
  }
}
