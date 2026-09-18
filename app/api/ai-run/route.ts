import { NextRequest, NextResponse } from "next/server";
import { getAIProviders } from "../../lib/ai/providers";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const providerId = String(body.provider ?? "").trim();
  const jobId = String(body.jobId ?? "").trim();

  if (!providerId || !jobId) {
    return NextResponse.json(
      { ok: false, error: "AI provider and jobId are required." },
      { status: 400 }
    );
  }

  const provider = getAIProviders().find(
    (item) => item.id === providerId
  );

  if (!provider) {
    return NextResponse.json(
      { ok: false, error: `Unknown AI provider: ${providerId}` },
      { status: 404 }
    );
  }

  if (!provider.keyConfigured) {
    return NextResponse.json(
      {
        ok: false,
        executed: false,
        paidRequired: false,
        status: "NOT_CONNECTED",
        provider: provider.name,
        message: `${provider.name} API가 연결되지 않아 외부 호출을 실행하지 않았습니다.`,
      },
      { status: 409 }
    );
  }

  return NextResponse.json({
    ok: true,
    executed: false,
    dryRun: true,
    paidRequired: false,
    status: "READY_FOR_PROVIDER",
    provider: provider.name,
    jobId,
    estimatedCost: 0,
    message:
      "Provider 연결과 실행 게이트를 통과했습니다. 실제 AI 호출은 아직 실행하지 않았습니다.",
  });
}
