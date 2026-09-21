"use client";

import { useEffect, useState } from "react";

type FactoryPlan = {
  phase: string;
  nextAction: string;
  progress: { completedOrReady: number; total: number };
  milestones: Array<{ id: string; label: string; status: string }>;
};

type RuntimeHealth = {
  status: string;
  counts: { characters: number; jobs: number; executions: number; publishAudit: number };
  storage: { totalBytes: number };
  warnings: string[];
};

type Integrity = {
  status: string;
  counts: { issues: number };
  issues: Array<{ type: string; id: string; message: string }>;
};

type ProviderOps = { realExecutionEnabled:boolean; providers:Array<{id:string;name:string;configured:boolean;executionImplemented:boolean;executableNow:boolean}>; queue:{total:number;planned:number;running:number;blocked:number;completed:number;errors:number;byProvider:Record<string,number>}; audit:{total:number;externalCalls:number;uncertainCalls:number;errors:number;last:string|null} };
type WidgetStatus = {
  priority: string;
  summary: {
    factoryRuns: number;
    review: number;
    configuredProviders: string[];
    realExecutionEnabled: boolean;
    realPublishEnabled: boolean;
    lastValidatedAt: string | null;
  };
};

export default function LiveControlCenter() {
  const [plan, setPlan] = useState<FactoryPlan | null>(null);
  const [health, setHealth] = useState<RuntimeHealth | null>(null);
  const [integrity, setIntegrity] = useState<Integrity | null>(null);
  const [widget, setWidget] = useState<WidgetStatus | null>(null);
  const [providerOps, setProviderOps] = useState<ProviderOps | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const [planResponse, healthResponse, integrityResponse, widgetResponse, providerOpsResponse] = await Promise.all([
          fetch("/api/factory-plan", { cache: "no-store" }),
          fetch("/api/runtime-health", { cache: "no-store" }),
          fetch("/api/data-integrity", { cache: "no-store" }),
          fetch("/api/widget-status", { cache: "no-store" }),
          fetch("/api/provider-ops", { cache: "no-store" }),
        ]);
        const [nextPlan, nextHealth, nextIntegrity, nextWidget, nextProviderOps] = await Promise.all([
          planResponse.json(), healthResponse.json(), integrityResponse.json(), widgetResponse.json(), providerOpsResponse.json(),
        ]);
        if (!active) return;
        setPlan(nextPlan);
        setHealth(nextHealth);
        setIntegrity(nextIntegrity);
        setWidget(nextWidget);
        setProviderOps(nextProviderOps);
        setError("");
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Live control status failed.");
      }
    }
    refresh();
    const timer = window.setInterval(refresh, 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const progress = plan?.progress.total ? Math.round((plan.progress.completedOrReady / plan.progress.total) * 100) : 0;

  return (
    <section className="mt-8 rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.04] p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">Live Control Plane</p>
          <h2 className="mt-2 text-2xl font-semibold">실제 상태 기반 운영판</h2>
          <p className="mt-2 text-sm text-zinc-500">{plan?.nextAction ?? "상태 읽는 중..."}</p>
        </div>
        <div className="text-left lg:text-right">
          <p className="text-3xl font-semibold">{progress}%</p>
          <p className="text-xs text-zinc-500">{plan?.phase ?? "LOADING"}</p>
        </div>
      </div>

      {error && <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Runtime", health?.status ?? "..."],
          ["Integrity", integrity?.status ?? "..."],
          ["Factory Runs", String(widget?.summary.factoryRuns ?? 0)],
          ["Review Queue", String(widget?.summary.review ?? 0)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs text-zinc-600">{label}</p>
            <p className="mt-2 text-lg font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Milestones</p>
          <div className="mt-3 space-y-2">
            {(plan?.milestones ?? []).map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-zinc-300">{item.label}</span>
                <span className="text-xs text-zinc-500">{item.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Safety + Data</p>
          <div className="mt-3 space-y-2 text-sm text-zinc-400">
            <p>Provider: {widget?.summary.configuredProviders.length ? widget.summary.configuredProviders.join(", ") : "미연결"}</p>
            <p>Real generation: {widget?.summary.realExecutionEnabled ? "ENABLED" : "LOCKED"}</p>
            <p>Real publishing: {widget?.summary.realPublishEnabled ? "ENABLED" : "LOCKED"}</p>
            <p>Integrity issues: {integrity?.counts.issues ?? 0}</p>
            <p>Runtime data: {health ? `${Math.round(health.storage.totalBytes / 1024)} KB` : "..."}</p>
            <p>Last local validation: {widget?.summary.lastValidatedAt ?? "아직 기록 없음"}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
        <div className="flex items-center justify-between"><p className="text-xs uppercase tracking-wider text-zinc-500">AI Work Distribution</p><span className="text-xs text-zinc-500">{providerOps?.realExecutionEnabled ? "REAL ENABLED" : "DRY-RUN LOCK"}</span></div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">{(providerOps?.providers ?? []).map((p)=><div key={p.id} className="rounded-lg border border-white/10 p-3 text-sm"><div className="flex justify-between"><span>{p.name}</span><span className={p.executableNow?"text-emerald-400":"text-amber-400"}>{p.executableNow?"READY":p.configured?"ADAPTER WAIT":"NO KEY"}</span></div><p className="mt-1 text-xs text-zinc-600">assigned {providerOps?.queue.byProvider?.[p.id] ?? 0}</p></div>)}</div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-500"><span>Queue {providerOps?.queue.total ?? 0}</span><span>Planned {providerOps?.queue.planned ?? 0}</span><span>Running {providerOps?.queue.running ?? 0}</span><span>Blocked {providerOps?.queue.blocked ?? 0}</span><span>Done {providerOps?.queue.completed ?? 0}</span><span>Errors {providerOps?.queue.errors ?? 0}</span></div>
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-zinc-500"><span>Dispatch audit {providerOps?.audit.total ?? 0}</span><span>External calls {providerOps?.audit.externalCalls ?? 0}</span><span>Uncertain calls {providerOps?.audit.uncertainCalls ?? 0}</span><span>Audit errors {providerOps?.audit.errors ?? 0}</span><span>Last dispatch {providerOps?.audit.last ?? "none"}</span></div>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <a href="/api/local-backup" className="rounded-lg border border-cyan-500/30 px-4 py-2 text-sm text-cyan-300">Backup JSON</a>
        <a href="/api/factory-runs" target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300">Factory Runs</a>
        <a href="/api/data-integrity" target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300">Integrity Detail</a>
      </div>
    </section>
  );
}
