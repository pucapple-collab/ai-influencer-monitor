import { NextRequest, NextResponse } from "next/server";
import { getAIProviders } from "../../lib/ai/providers";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const providerId = String(body.provider ?? "").trim();

  if (!providerId) {
    return NextResponse.json(
      { ok: false, error: "AI provider is required." },
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
    ok: false,
    executed: false,
    paidRequired: false,
    status: "ADAPTER_READY",
    provider: provider.name,
    message:
      "Provider 연결은 확인됐지만 실제 생성 어댑터는 아직 실행하지 않습니다.",
  });
}
