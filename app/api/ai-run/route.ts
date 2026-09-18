
import { NextRequest, NextResponse } from "next/server";
import { adapters, AIProviderId } from "../../lib/ai/adapters";
import { canExecuteAI } from "../../lib/ai/providers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const provider = String(body.provider ?? "") as AIProviderId;
    const jobId = String(body.jobId ?? "");
    const prompt = String(body.prompt ?? "").trim();

    if (!provider || !jobId || !prompt) {
      return NextResponse.json(
        {
          ok: false,
          executed: false,
          error: "provider, jobId, prompt가 필요합니다.",
        },
        { status: 400 }
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
      paidRequired: result.executed,
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
