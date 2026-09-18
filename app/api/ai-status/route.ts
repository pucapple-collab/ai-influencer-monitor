import { NextResponse } from "next/server";
import { getAIProviders } from "../../lib/ai/providers";

export async function GET() {
  const providers = getAIProviders();

  return NextResponse.json({
    ok: true,
    providers,
    paidRequired: false,
    message:
      "Provider 상태만 확인합니다. 실제 AI API 호출이나 과금 요청은 수행하지 않습니다.",
    timestamp: new Date().toISOString(),
  });
}
