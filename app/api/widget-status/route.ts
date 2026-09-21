import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getAIProviders } from "../../lib/ai/providers";
import { readContentJobs } from "../../lib/local-content-jobs";
import { getExecutions } from "../../lib/ai/execution-store";
import { readCharacters } from "../../lib/local-characters";
import { getPublishAudit } from "../../lib/publish-audit";
import { getFactoryRuns } from "../../lib/factory-run-store";

async function readRuntime<T>(name: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(process.cwd(), "runtime", name), "utf8")) as T;
  } catch {
    return null;
  }
}

export async function GET() {
  const [jobs, executions, characters, publishAudit, factoryRuns, validation] = await Promise.all([
    readContentJobs(),
    getExecutions(),
    readCharacters(),
    getPublishAudit(),
    getFactoryRuns(),
    readRuntime<{ ok?: boolean; validatedAt?: string; factorySimulation?: boolean }>("validation-status.json"),
  ]);
  const providers = getAIProviders();
  const configured = providers.filter((provider) => provider.keyConfigured);
  const realExecutionEnabled = process.env.FACTORY_REAL_EXECUTION_ENABLED === "true";
  const realPublishEnabled = process.env.FACTORY_REAL_PUBLISH_ENABLED === "true";
  const errors = executions.filter((item) => item.status === "ERROR");
  const recentErrors = errors.filter((item) => Date.now() - Date.parse(item.createdAt) < 24 * 60 * 60 * 1000);
  const publishBlocked = publishAudit.filter((item) => item.status !== "PUBLISH_READY");
  const retentionAttention = executions.length >= 500 || publishAudit.length >= 500;
  const review = jobs.filter((item) => String(item.status).toLowerCase() === "review");
  const ready = jobs.filter((item) => String(item.status).toLowerCase() === "ready" && String(item.approval).toLowerCase() === "approved");

  const messages: Array<{ kind: "error" | "progress" | "guide" | "next"; text: string }> = [];
  if (recentErrors.length) messages.push({ kind: "error", text: `최근 24시간 생성 오류 ${recentErrors.length}건 있어. 패널에서 확인해.` });
  else if (errors.length) messages.push({ kind: "guide", text: `과거 생성 오류 기록 ${errors.length}건 보관 중이야. 현재 장애는 아니야.` });
  if (retentionAttention) messages.push({ kind: "guide", text: "로컬 감사기록이 보관 한도에 닿아서 오래된 기록부터 자동 정리 중이야." });
  if (validation?.ok && validation.factorySimulation) messages.push({ kind: "progress", text: "마지막 로컬 검증이랑 전체 시뮬레이션 통과했어." });
  messages.push({ kind: "progress", text: `캐릭터 ${characters.length}명, 콘텐츠 작업 ${jobs.length}건 관리 중이야.` });
  if (factoryRuns.length) messages.push({ kind: "progress", text: `전체 Factory 시뮬레이션 기록 ${factoryRuns.length}건 쌓였어.` });
  if (review.length) messages.push({ kind: "guide", text: `리뷰 기다리는 콘텐츠 ${review.length}건 있어.` });
  if (publishBlocked.length) messages.push({ kind: "guide", text: `게시 게이트에서 막힌 기록 ${publishBlocked.length}건 있어. 아직 외부 게시 호출은 안 나갔어.` });
  if (ready.length) messages.push({ kind: "guide", text: `승인 끝나고 생성 대기 중인 작업 ${ready.length}건 있어.` });
  messages.push({ kind: "guide", text: realExecutionEnabled ? "실제 AI 실행 스위치가 켜져 있어. 호출 전 확인이 필요해." : "실제 AI 호출은 아직 잠가뒀어." });
  messages.push({ kind: "guide", text: realPublishEnabled ? "실제 게시 스위치가 켜져 있어. 게시 전 확인이 필요해." : "외부 게시도 아직 잠가뒀어." });
  messages.push(configured.length
    ? { kind: "next", text: `연결 감지된 AI는 ${configured.map((item) => item.name).join(", ")}야. 최소 테스트 전 비용 확인하면 돼.` }
    : { kind: "next", text: "다음은 AI 하나만 골라 비용 한도 확인하고 키 연결하면 돼." });

  return NextResponse.json({
    ok: true,
    updatedAt: new Date().toISOString(),
    externalCallMade: false,
    paidUsageTriggered: false,
    priority: recentErrors.length ? "ERROR" : "NORMAL",
    summary: {
      characters: characters.length,
      jobs: jobs.length,
      ready: ready.length,
      review: review.length,
      errors: errors.length,
      recentErrors: recentErrors.length,
      publishAudit: publishAudit.length,
      factoryRuns: factoryRuns.length,
      publishBlocked: publishBlocked.length,
      retentionAttention,
      configuredProviders: configured.map((item) => item.id),
      realExecutionEnabled,
      realPublishEnabled,
      lastValidatedAt: validation?.validatedAt ?? null,
    },
    messages,
  });
}
