"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  PROJECT_STATUS_ID,
  PROJECT_STATUS_COLUMNS,
  type ProjectStatus,
} from "../lib/project-status";

export default function ProjectStatusCard() {
  const [snapshot, setSnapshot] = useState<ProjectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data, error } = await supabase
          .from("setup_tasks")
          .select(PROJECT_STATUS_COLUMNS)
          .eq("task_id", PROJECT_STATUS_ID)
          .maybeSingle();
        if (!active) return;
        setFailed(Boolean(error));
        setSnapshot(error ? null : data);
      } catch {
        if (active) {
          setFailed(true);
          setSnapshot(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [refresh]);

  return (
    <section className="my-6 rounded-xl border border-white/10 bg-white/5 p-5" aria-label="공유 개발 상태">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-semibold">공유 개발 상태</h2>
        <button className="rounded border border-white/20 px-3 py-1 text-sm disabled:opacity-50" disabled={loading} onClick={() => {
          setLoading(true);
          setRefresh((value) => value + 1);
        }}>새로고침</button>
      </div>
      <div className="mt-3 text-sm text-zinc-300" aria-live="polite">
        {loading ? <p>불러오는 중…</p> : failed ? <p role="alert">공유 상태를 불러오지 못했습니다. 새로고침으로 다시 확인하세요.</p> : !snapshot ? <p>아직 기록된 개발 상태가 없습니다.</p> : (
          <div className="space-y-2 break-words">
            <p><strong>현재 작업:</strong> {snapshot.title}</p>
            <p><strong>상태:</strong> {({ running: "진행 중", completed: "완료", blocked: "중단", failed: "실패" } as Record<string, string>)[snapshot.status] ?? snapshot.status}</p>
            <p><strong>마지막 변경:</strong> {snapshot.required_input || "기록 없음"}</p>
            <p><strong>기록 시각:</strong> <time dateTime={snapshot.updated_at}>{new Date(snapshot.updated_at).toLocaleString("ko-KR")}</time></p>
            {snapshot.status === "failed" && snapshot.blocked_reason && <pre className="whitespace-pre-wrap text-red-300">{snapshot.blocked_reason}</pre>}
            <p className="text-xs text-zinc-500">마지막 저장 상태입니다. 실시간 실행 여부를 의미하지 않습니다.</p>
          </div>
        )}
      </div>
    </section>
  );
}
