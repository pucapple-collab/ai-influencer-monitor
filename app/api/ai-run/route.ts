import { NextRequest, NextResponse } from "next/server";
import { canExecuteAI, getAIProvider } from "../../lib/ai/providers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const providerId = String(body.provider ?? "").trim();
    const jobId = String(body.jobId ?? "").trim();

    if (!providerId || !jobId) {
      return NextResponse.json(
        {
          ok: false,
          executed: false,
          error: "provider와 jobId가 필요합니다.",
        },
        { status: 400 }
      );
    }

    const provider = getAIProvider(providerId);

    if (!provider) {
      return NextResponse.json(
        {
          ok: false,
          executed: false,
          error: `지원하지 않는 Provider입니다: ${providerId}`,
        },
        { status: 404 }
      );
    }

    if (!canExecuteAI(providerId)) {
      return NextResponse.json(
        {
          ok: false,
          executed: false,
          paidRequired: false,
          status: "NOT_CONNECTED",
          provider: provider.name,
          jobId,
          estimatedCost: 0,
          message: `${provider.name} API 키가 없어 외부 호출을 실행하지 않았습니다.`,
        },
        { status: 409 }
      );
    }

    // Provider adapter가 실제 API를 호출하기 전 마지막 안전 지점.
    // 현재는 연결만 확인하고 실제 과금 호출은 하지 않는다.
    return NextResponse.json({
      ok: true,
      executed: false,
      dryRun: true,
      paidRequired: false,
      status: "ADAPTER_READY",
      provider: provider.name,
      jobId,
      estimatedCost: 0,
      message:
        `${provider.name} 연결 확인 완료. 실제 생성 API 호출은 아직 실행하지 않았습니다.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        executed: false,
        error:
          error instanceof Error ? error.message : "AI 실행 요청 오류",
      },
      { status: 500 }
    );
  }
}
