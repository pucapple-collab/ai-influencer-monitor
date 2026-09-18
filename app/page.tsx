"use client";

import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import ProjectStatusCard from "./components/project-status";

const setupDescriptions: Record<string, string> = {
  Project: "AI Influencer Factory project",
  "Next.js": "Monitoring application",
  Dashboard: "System monitoring interface",
  Characters: "Factory Guide and AI characters",
  "Data Model": "Influencers, jobs and content",
  Database: "Persistent data storage",
  "Image AI": "AI image generation",
  "Video AI": "AI video generation",
  Publishing: "Automated content publishing",
};

const setupSteps = [
  { name: "Project", description: setupDescriptions["Project"], status: "ready" },
  { name: "Next.js", description: setupDescriptions["Next.js"], status: "ready" },
  { name: "Dashboard", description: setupDescriptions["Dashboard"], status: "ready" },
  { name: "Characters", description: setupDescriptions["Characters"], status: "ready" },
  { name: "Data Model", description: setupDescriptions["Data Model"], status: "ready" },
  { name: "Database", description: setupDescriptions["Database"], status: "ready" },
  { name: "Image AI", description: setupDescriptions["Image AI"], status: "waiting" },
  { name: "Video AI", description: setupDescriptions["Video AI"], status: "waiting" },
  { name: "Publishing", description: setupDescriptions["Publishing"], status: "waiting" },
];

const systemLayers = [
  {
    number: "01",
    name: "Control Center",
    description: "Monitor the entire factory",
    status: "online",
  },
  {
    number: "02",
    name: "AI Influencers",
    description: "Manage virtual creators",
    status: "online",
  },
  {
    number: "03",
    name: "Content Pipeline",
    description: "Idea → Script → Image → Video",
    status: "online",
  },
  {
    number: "04",
    name: "AI Generation",
    description: "External AI services",
    status: "not-connected",
  },
  {
    number: "05",
    name: "Automation",
    description: "Scheduled generation and publishing",
    status: "not-connected",
  },
];

const nextTasks = [
  "Connect persistent database",
  "Create influencer management screen",
  "Create content management screen",
  "Connect image generation",
  "Connect video generation",
];

function StatusBadge({ status }: { status: string }) {
  if (status === "ready" || status === "online") {
    return (
      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400">
        READY
      </span>
    );
  }

  if (status === "next") {
    return (
      <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs text-blue-400">
        NEXT
      </span>
    );
  }

  if (status === "not-connected") {
    return (
      <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs text-amber-400">
        NOT CONNECTED
      </span>
    );
  }

  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-500">
      WAITING
    </span>
  );
}

type AIProvider = {
  id: string;
  name: string;
  role: string;
  status: string;
  keyConfigured: boolean;
};

type MonitorSummary = {
  status: string;
  message: string;
  factoryProgress: number;
  nextMission: string;
  coreReadyCount: number;
  coreStepCount: number;
  completedTaskCount: number;
  actionableTaskCount: number;
  waitingTaskCount: number;
  serviceCount: number;
  activeServiceCount: number;
  serviceProgress: number;
  localInfluencerCount: number;
  localContentJobCount: number;
  approvedContentCount: number;
  aiExecutionCost: number;
  paidServiceRequired: boolean;
  aiConnectedCount: number;
  aiNotConnectedCount: number;
};

type MonitorOperations = Record<
  "characters" | "workflows" | "approvals" | "usage" | "errors",
  { status: string; count: number | null }
>;

type ContentJob = {
  id: string;
  title: string;
  characterId: string | null;
  type: string;
  status: string;
  createdAt: string;
  script?: string;
  prompt?: string;
  approval?: string;
};

type LocalCharacter = {
  id: string;
  name: string;
  concept: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type Service = {
  service_id: string;
  name: string;
  role: string | null;
  status: string;
  progress: number;
  current_job: string | null;
  next_action: string | null;
  usage_today: number;
  usage_month: number;
  quota: number | null;
};

export default function Home() {
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [serviceError, setServiceError] = useState("");
  const [characters, setCharacters] = useState<LocalCharacter[]>([]);
  const [characterName, setCharacterName] = useState("");
  const [characterConcept, setCharacterConcept] = useState("");
  const [savingCharacter, setSavingCharacter] = useState(false);
  const [contentJobs, setContentJobs] = useState<ContentJob[]>([]);
  const [jobTitle, setJobTitle] = useState("");
  const [jobCharacterId, setJobCharacterId] = useState("");
  const [pipelineError, setPipelineError] = useState("");
  const [aiRunningJob, setAIRunningJob] = useState<string | null>(null);
  const [selectedAIProvider, setSelectedAIProvider] = useState("higgsfield");





  const [monitorSummary, setMonitorSummary] = useState<MonitorSummary | null>(null);
  const [aiProviders, setAIProviders] = useState<AIProvider[]>([]);

  const [operations, setOperations] = useState<MonitorOperations | null>(null);

  useEffect(() => {
    async function loadCharacters() {
      try {
        const response = await fetch("/api/local-characters", {
          cache: "no-store",
        });
        const data = await response.json();
        if (data.ok) setCharacters(data.characters ?? []);
      } catch (error) {
        console.error("Character load failed:", error);
      }
    }

    async function loadJobs() {
      try {
        const response = await fetch("/api/local-content-jobs", { cache: "no-store" });
        const data = await response.json();
        if (data.ok) setContentJobs(data.jobs ?? []);
      } catch (error) {
        console.error("Content jobs load failed:", error);
      }
    }

    loadCharacters();
    loadJobs();
  }, []);

  async function deleteCharacter(id: string) {
    const response = await fetch(`/api/local-characters?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (response.ok)
      setCharacters((current) => current.filter((item) => item.id !== id));
  }

  async function createContentJob() {
    if (!jobTitle.trim()) return;

    const response = await fetch("/api/local-content-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: jobTitle,
        characterId: jobCharacterId || null,
        type: "post",
      }),
    });

    const data = await response.json();
    if (data.ok) {
      setContentJobs((current) => [data.job, ...current]);
      setJobTitle("");
    }
  }

  async function deleteContentJob(id: string) {
    const response = await fetch(
      `/api/local-content-jobs?id=${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );

    if (response.ok) {
      setContentJobs((current) =>
        current.filter((job) => job.id !== id)
      );
    }
  }

  async function runAIForJob(job: ContentJob) {
    setPipelineError("");

    const provider = aiProviders.find(
      (item) => item.id === selectedAIProvider
    );

    if (!provider || provider.status !== "CONFIGURED") {
      setPipelineError(
        `${provider?.name ?? selectedAIProvider} 연결이 필요합니다. 외부 API 호출은 실행하지 않았습니다.`
      );
      return;
    }

    if (job.approval !== "approved") {
      setPipelineError("승인된 콘텐츠만 AI 생성을 실행할 수 있습니다.");
      return;
    }

    setAIRunningJob(job.id);

    try {
      const response = await fetch("/api/ai-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedAIProvider,
          jobId: job.id,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setPipelineError(
          data.message || data.error || "AI 실행이 차단되었습니다."
        );
        return;
      }

      await updateContentJob(job.id, { status: "generating" });
    } catch (error) {
      setPipelineError(
        error instanceof Error ? error.message : "AI execution failed."
      );
    } finally {
      setAIRunningJob(null);
    }
  }

  async function updateContentJob(
    id: string,
    patch: Partial<ContentJob>
  ) {
    const response = await fetch("/api/local-content-jobs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });

    const data = await response.json();

    if (data.ok) {
      setContentJobs((current) =>
        current.map((job) => job.id === id ? data.job : job)
      );
    }
  }

  async function updateJobStatus(id: string, status: string) {
    setPipelineError("");

    const job = contentJobs.find((item) => item.id === id);

    if (
      ["generating", "review", "published"].includes(status) &&
      job?.approval !== "approved"
    ) {
      setPipelineError("승인되지 않은 콘텐츠는 생성 단계로 이동할 수 없습니다.");
      return;
    }

    const response = await fetch("/api/local-content-jobs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });

    const data = await response.json();

    if (!data.ok) {
      setPipelineError(data.error ?? "Pipeline update failed.");
      return;
    }

    setContentJobs((current) =>
      current.map((item) => item.id === id ? data.job : item)
    );
  }

  async function createCharacter() {
    if (!characterName.trim() || savingCharacter) return;

    setSavingCharacter(true);

    try {
      const response = await fetch("/api/local-characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: characterName,
          concept: characterConcept,
        }),
      });

      const data = await response.json();

      if (data.ok) {
        setCharacters((current) => [data.character, ...current]);
        setCharacterName("");
        setCharacterConcept("");
      }
    } finally {
      setSavingCharacter(false);
    }
  }

  useEffect(() => {
    async function loadAIStatus() {
      try {
        const response = await fetch("/api/ai-status", { cache: "no-store" });
        const data = await response.json();
        if (data.ok) {
          const providers = data.providers ?? [];
          setAIProviders(providers);

          const configured = providers.find(
            (provider: AIProvider) => provider.status === "CONFIGURED"
          );

          if (configured) {
            setSelectedAIProvider((current) =>
              providers.some(
                (provider: AIProvider) =>
                  provider.id === current && provider.status === "CONFIGURED"
              )
                ? current
                : configured.id
            );
          }
        }
      } catch (error) {
        console.error("AI provider status load failed:", error);
      }
    }

    loadAIStatus();
    const timer = window.setInterval(loadAIStatus, 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    async function loadMonitor() {
      try {
        const response = await fetch("/api/monitor", { cache: "no-store" });
        const data = await response.json();

        if (data.ok) {
          setMonitorSummary(data.summary);
          setOperations(data.operations);
        }
      } catch (error) {
        console.error("Monitor summary load failed:", error);
      }
    }

    loadMonitor();
    const timer = window.setInterval(loadMonitor, 10000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    async function loadServices() {
      const { data, error } = await supabase
        .from("services")
        .select(
          "service_id,name,role,status,progress,current_job,next_action,usage_today,usage_month,quota"
        )
        .order("service_id");

      if (error) {
        console.error("Supabase services load failed:", error);
        setServiceError(error.message);
      } else {
        setServices(data ?? []);
      }

      setLoadingServices(false);
    }

    loadServices();

    const channel = supabase
      .channel("monitor-services")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "services",
        },
        () => {
          loadServices();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  const liveReadyCount = services.filter(
    (service) =>
      service.status === "ready" ||
      service.status === "running" ||
      service.status === "completed"
  ).length;

  const liveProgress =
    services.length > 0
      ? Math.round(
          services.reduce(
            (total, service) => total + (service.progress || 0),
            0
          ) / services.length
        )
      : 0;

  const readyCount = setupSteps.filter(
    (step) => step.status === "ready"
  ).length;

  const setupProgress =
    monitorSummary?.factoryProgress ??
    Math.round((readyCount / setupSteps.length) * 100);

  const completedSetupCount =
    monitorSummary?.completedTaskCount ?? readyCount;

  const actionableSetupCount =
    monitorSummary?.actionableTaskCount ?? setupSteps.length;

  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">

        <ProjectStatusCard />

        {/* HEADER */}
        <header className="border-b border-white/10 pb-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="text-xs font-medium uppercase tracking-[0.25em] text-emerald-400">
                  Factory Control Center
                </span>
              </div>

              <h1 className="text-4xl font-semibold tracking-tight">
                AI Influencer Factory
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
                현재 AI Influencer Factory 시스템의 구축 상태와
                다음 작업을 한눈에 확인하는 모니터링 센터입니다.
              </p>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4">
              <p className="text-xs uppercase tracking-wider text-zinc-500">
                System Status
              </p>

              <div className="mt-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="font-medium text-emerald-400">
                  ONLINE
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* PROGRESS */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-center gap-6">
            <div className="w-40 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/characters/factory-guide.png"
                alt="Factory Guide"
                className="w-full drop-shadow-2xl"
              />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
                Factory Guide
              </div>
              <h2 className="mt-2 text-2xl font-bold text-white">
                시스템 구축 상황을 안내하고 있어요
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                현재 기본 대시보드는 READY 상태입니다.
                다음 단계는 데이터베이스 연결입니다.
              </p>
              <div className="mt-4 flex gap-2">
                <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs text-emerald-400">
                  SYSTEM READY
                </span>
                <span className="rounded-full bg-blue-400/10 px-3 py-1 text-xs text-blue-400">
                  {monitorSummary?.nextMission
              ? `NEXT: ${monitorSummary.nextMission.toUpperCase()}`
              : "LOADING STATUS"}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">
                Factory Setup
              </p>

              <h2 className="mt-2 text-2xl font-semibold">
                System Construction Progress
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                현재까지 구축된 시스템의 진행 상황입니다.
              </p>
            </div>

            <div className="md:text-right">
              <p className="text-4xl font-semibold">
                {setupProgress}%
              </p>

              <p className="mt-1 text-xs text-zinc-600">
                {completedSetupCount} / {actionableSetupCount} core tasks complete
              </p>
            </div>
          </div>

          <div className="mt-6 h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all"
              style={{ width: `${setupProgress}%` }}
            />
          </div>
        </section>

        {/* SETUP STEPS */}
        <section className="mt-8">
          <div className="mb-5">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">
              Setup Monitor
            </p>

            <h2 className="mt-2 text-2xl font-semibold">
              System Setup Status
            </h2>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {setupSteps.map((step, index) => (
              <div
                key={step.name}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 font-mono text-xs text-zinc-500">
                      {String(index + 1).padStart(2, "0")}
                    </div>

                    <div>
                      <h3 className="font-medium">
                        {step.name}
                      </h3>

                      <p className="mt-1 text-sm text-zinc-600">
                        {step.description}
                      </p>
                    </div>
                  </div>

                  <StatusBadge status={step.status} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* LIVE SERVICES */}
        <section className="mt-10">
          <div className="mb-5">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">
              Supabase Live Data
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              Connected Services
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              실제 Supabase services 테이블에서 현재 상태를 읽고 있습니다.
            </p>
          </div>

          <div className="mb-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs text-zinc-600">REGISTERED SERVICES</p>
              <p className="mt-2 text-3xl font-semibold">
                {loadingServices ? "..." : services.length}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs text-zinc-600">READY / RUNNING</p>
              <p className="mt-2 text-3xl font-semibold text-emerald-400">
                {loadingServices ? "..." : liveReadyCount}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs text-zinc-600">SERVICE INTEGRATION</p>
              <p className="mt-2 text-3xl font-semibold">
                {loadingServices ? "..." : `${liveProgress}%`}
              </p>
            </div>
          </div>

          {serviceError ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-400">
              Supabase 연결 오류: {serviceError}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {loadingServices ? (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm text-zinc-500">
                  Supabase 데이터를 불러오는 중...
                </div>
              ) : (
                services.map((service) => (
                  <div
                    key={service.service_id}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-medium">{service.name}</h3>
                        <p className="mt-1 text-xs text-zinc-600">
                          {service.role || service.service_id}
                        </p>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase text-zinc-400">
                        {service.status}
                      </span>
                    </div>

                    <div className="mt-5">
                      <div className="flex justify-between text-xs text-zinc-500">
                        <span>Progress</span>
                        <span>{service.progress || 0}%</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-emerald-400"
                          style={{ width: `${Math.max(0, Math.min(100, service.progress || 0))}%` }}
                        />
                      </div>
                    </div>

                    {service.current_job && (
                      <p className="mt-4 text-xs text-zinc-500">
                        Job: {service.current_job}
                      </p>
                    )}

                    {service.next_action && (
                      <p className="mt-2 text-xs text-blue-400">
                        Next: {service.next_action}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </section>

        {/* AI INFLUENCER MANAGER */}
        <section className="mt-10">
          <div className="mb-5">
            <p className="text-xs uppercase tracking-[0.2em] text-fuchsia-400">
              AI Influencer Manager
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              Influencers
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              캐릭터 설계 데이터를 로컬에서 안전하게 관리합니다.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-sm font-medium">New Influencer</p>

              <input
                value={characterName}
                onChange={(event) => setCharacterName(event.target.value)}
                placeholder="Name"
                className="mt-4 w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-fuchsia-400/50"
              />

              <textarea
                value={characterConcept}
                onChange={(event) => setCharacterConcept(event.target.value)}
                placeholder="Concept / personality / visual direction"
                rows={5}
                className="mt-3 w-full resize-none rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-fuchsia-400/50"
              />

              <button
                type="button"
                onClick={createCharacter}
                disabled={!characterName.trim() || savingCharacter}
                className="mt-3 w-full rounded-lg bg-fuchsia-500 px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
              >
                {savingCharacter ? "Saving..." : "Create Influencer"}
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {characters.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-8 text-sm text-zinc-600">
                  아직 등록된 AI 인플루언서가 없습니다.
                </div>
              ) : (
                characters.map((character) => (
                  <div
                    key={character.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-medium">{character.name}</h3>
                      <span className="rounded-full bg-fuchsia-400/10 px-2.5 py-1 text-[10px] uppercase text-fuchsia-400">
                        {character.status}
                      </span>
                    </div>

                    <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-500">
                      {character.concept || "No concept yet."}
                    </p>
                    <button
                      type="button"
                      onClick={() => deleteCharacter(character.id)}
                      className="mt-4 text-xs text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* AI PROVIDER STATUS */}
        <section className="mt-10">
          <div className="mb-5">
            <p className="text-xs uppercase tracking-[0.2em] text-violet-400">
              AI Providers
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              Connection Status
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              상태만 확인하며 연결되지 않은 서비스에는 API 호출을 하지 않습니다.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {aiProviders.map((provider) => (
              <div
                key={provider.id}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{provider.name}</p>
                  <span
                    className={
                      provider.status === "CONFIGURED"
                        ? "text-emerald-400"
                        : "text-zinc-500"
                    }
                  >
                    {provider.status}
                  </span>
                </div>

                <p className="mt-3 text-xs uppercase tracking-wider text-zinc-600">
                  {provider.role}
                </p>

                <p className="mt-2 text-xs text-zinc-600">
                  {provider.keyConfigured
                    ? "API configuration detected"
                    : "Waiting for connection"}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* FACTORY CORE STATUS */}
        <section className="mt-10 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">
                Factory Core
              </p>
              <h2 className="mt-2 text-2xl font-semibold">
                Production System Ready
              </h2>
              <p className="mt-2 text-sm text-zinc-500">
                인플루언서 관리 → 콘텐츠 설계 → 승인 → 생성 대기까지 연결됨
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-black/20 px-5 py-3">
                <p className="text-2xl font-semibold">{characters.length}</p>
                <p className="text-[10px] text-zinc-600">INFLUENCERS</p>
              </div>

              <div className="rounded-xl bg-black/20 px-5 py-3">
                <p className="text-2xl font-semibold">{contentJobs.length}</p>
                <p className="text-[10px] text-zinc-600">JOBS</p>
              </div>

              <div className="rounded-xl bg-black/20 px-5 py-3">
                <p className="text-2xl font-semibold text-emerald-400">
                  {contentJobs.filter((job) => job.approval === "approved").length}
                </p>
                <p className="text-[10px] text-zinc-600">APPROVED</p>
              </div>
            </div>
          </div>
        </section>

        {/* PRODUCTION CONTROL */}
        <section className="mt-10">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs text-zinc-600">CONTENT JOBS</p>
              <p className="mt-2 text-3xl font-semibold">{contentJobs.length}</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs text-zinc-600">APPROVED</p>
              <p className="mt-2 text-3xl font-semibold text-emerald-400">
                {contentJobs.filter((job) => job.approval === "approved").length}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs text-zinc-600">WAITING APPROVAL</p>
              <p className="mt-2 text-3xl font-semibold text-amber-400">
                {contentJobs.filter(
                  (job) => !job.approval || job.approval === "pending"
                ).length}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs text-zinc-600">GENERATION COST</p>
              <p className="mt-2 text-3xl font-semibold">$0</p>
              <p className="mt-1 text-xs text-zinc-600">External AI deferred</p>
            </div>
          </div>

          {pipelineError && (
            <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
              {pipelineError}
            </div>
          )}
        </section>

        {/* AI EXECUTION PROVIDER */}
        <section className="mt-6 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-violet-400">
                AI Execution
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                승인된 콘텐츠만 선택한 연결 Provider로 실행됩니다.
              </p>
            </div>

            <select
              value={selectedAIProvider}
              onChange={(event) => setSelectedAIProvider(event.target.value)}
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
            >
              {aiProviders.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name} · {provider.status}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* CONTENT JOB MANAGER */}
        <section className="mt-10">
          <div className="mb-5">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">
              Content Pipeline
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Content Jobs</h2>
          </div>

          <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <input
                value={jobTitle}
                onChange={(event) => setJobTitle(event.target.value)}
                placeholder="Content title"
                className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none"
              />

              <select
                value={jobCharacterId}
                onChange={(event) => setJobCharacterId(event.target.value)}
                className="mt-3 w-full rounded-lg border border-white/10 bg-black px-4 py-3 text-sm"
              >
                <option value="">No influencer</option>
                {characters.map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={createContentJob}
                disabled={!jobTitle.trim()}
                className="mt-3 w-full rounded-lg bg-cyan-500 px-4 py-3 text-sm font-medium disabled:opacity-40"
              >
                Create Content Job
              </button>
            </div>

            <div className="space-y-3">
              {contentJobs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 p-8 text-sm text-zinc-600">
                  콘텐츠 작업이 없습니다.
                </div>
              ) : contentJobs.map((job) => (
                <div key={job.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-medium">{job.title}</h3>
                      <p className="mt-1 text-xs text-zinc-600">{job.type}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={job.status}
                        onChange={(event) =>
                          updateJobStatus(job.id, event.target.value)
                        }
                        className="rounded-lg border border-white/10 bg-black px-3 py-2 text-xs"
                      >
                        <option value="draft">01 IDEA</option>
                        <option value="ready">02 READY</option>
                        <option value="generating">03 GENERATING</option>
                        <option value="review">04 REVIEW</option>
                        <option value="published">05 PUBLISHED</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => deleteContentJob(job.id)}
                        className="rounded-lg border border-red-500/20 px-3 py-2 text-xs text-red-400"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3">
                    <textarea
                      value={job.script ?? ""}
                      onChange={(event) =>
                        setContentJobs((current) =>
                          current.map((item) =>
                            item.id === job.id
                              ? { ...item, script: event.target.value }
                              : item
                          )
                        )
                      }
                      onBlur={() =>
                        updateContentJob(job.id, { script: job.script ?? "" })
                      }
                      placeholder="Script / caption"
                      rows={4}
                      className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none"
                    />

                    <textarea
                      value={job.prompt ?? ""}
                      onChange={(event) =>
                        setContentJobs((current) =>
                          current.map((item) =>
                            item.id === job.id
                              ? { ...item, prompt: event.target.value }
                              : item
                          )
                        )
                      }
                      onBlur={() =>
                        updateContentJob(job.id, { prompt: job.prompt ?? "" })
                      }
                      placeholder="Generation prompt"
                      rows={3}
                      className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none"
                    />

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-600">
                        Approval:
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          updateContentJob(job.id, { approval: "approved" })
                        }
                        className="rounded-lg border border-emerald-500/20 px-3 py-2 text-xs text-emerald-400"
                      >
                        Approve
                      </button>

                      {job.approval === "approved" && (
                        <button
                          type="button"
                          onClick={() => runAIForJob(job)}
                          disabled={aiRunningJob === job.id}
                          className="rounded-lg border border-violet-500/20 px-3 py-2 text-xs text-violet-400 disabled:opacity-40"
                        >
                          {aiRunningJob === job.id
                            ? "Checking..."
                            : "Run AI"}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          updateContentJob(job.id, { approval: "rejected" })
                        }
                        className="rounded-lg border border-red-500/20 px-3 py-2 text-xs text-red-400"
                      >
                        Reject
                      </button>

                      <span className="ml-auto text-xs uppercase text-zinc-500">
                        {job.approval ?? "pending"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PIPELINE OVERVIEW */}
        <section className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">
            Production Pipeline
          </p>
          <h2 className="mt-2 text-2xl font-semibold">
            Idea → Ready → Generate → Review → Publish
          </h2>

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              ["IDEA", "draft"],
              ["READY", "ready"],
              ["GENERATING", "generating"],
              ["REVIEW", "review"],
              ["PUBLISHED", "published"],
            ].map(([label, status]) => (
              <div
                key={status}
                className="rounded-xl border border-white/10 bg-black/20 p-4"
              >
                <p className="text-xs text-zinc-600">{label}</p>
                <p className="mt-2 text-3xl font-semibold">
                  {contentJobs.filter((job) => job.status === status).length}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* FACTORY OPERATIONS */}
        <section className="mt-10">
          <div className="mb-5">
            <p className="text-xs uppercase tracking-[0.2em] text-blue-400">
              Factory Operations
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              Internal Operations
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              민감한 운영 데이터는 공개 Monitor에서 노출하지 않습니다.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Characters", operations?.characters],
              ["Workflows", operations?.workflows],
              ["Approvals", operations?.approvals],
              ["Usage / Cost", operations?.usage],
              ["Errors", operations?.errors],
            ].map(([name, value]) => {
              const item = value as
                | { status: string; count: number | null }
                | undefined;

              return (
                <div
                  key={name as string}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
                >
                  <p className="text-xs text-zinc-600">{name as string}</p>
                  <p className="mt-3 text-xl font-semibold text-amber-400">
                    {item?.count ?? item?.status ?? "..."}
                  </p>
                  <p className="mt-2 text-xs text-zinc-600">
                    PRIVATE DATA
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ARCHITECTURE */}
        <section className="mt-10">
          <div className="mb-5">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">
              Factory Architecture
            </p>

            <h2 className="mt-2 text-2xl font-semibold">
              System Layers
            </h2>
          </div>

          <div className="grid gap-3">
            {systemLayers.map((layer, index) => (
              <div key={layer.number}>
                <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-5 md:flex-row md:items-center">
                  <div className="font-mono text-sm text-zinc-700">
                    {layer.number}
                  </div>

                  <div className="flex-1">
                    <h3 className="font-medium">
                      {layer.name}
                    </h3>

                    <p className="mt-1 text-sm text-zinc-600">
                      {layer.description}
                    </p>
                  </div>

                  <StatusBadge status={layer.status} />
                </div>

                {index < systemLayers.length - 1 && (
                  <div className="py-1 text-center text-zinc-800">
                    ↓
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* NEXT TASKS */}
        <section className="mt-10 grid gap-8 lg:grid-cols-2">

          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-blue-400">
              Next Mission
            </p>

            <h2 className="mt-2 text-2xl font-semibold">
              What We Build Next
            </h2>

            <p className="mt-3 text-sm leading-6 text-zinc-500">
              지금 시스템에서 다음으로 구축할 기능들입니다.
            </p>

            <div className="mt-6 space-y-3">
              {nextTasks.map((task, index) => (
                <div
                  key={task}
                  className="flex items-center gap-3 rounded-lg border border-white/5 bg-black/20 p-3"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5 font-mono text-xs text-zinc-500">
                    {index + 1}
                  </span>

                  <span className="text-sm text-zinc-300">
                    {task}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">
              Cost Monitor
            </p>

            <h2 className="mt-2 text-2xl font-semibold">
              Current Cost
            </h2>

            <div className="mt-8">
              <p className="text-5xl font-semibold">
                $0
              </p>

              <p className="mt-2 text-sm text-zinc-500">
                현재 외부 AI API를 사용하지 않고 있습니다.
              </p>
            </div>

            <div className="mt-6 border-t border-white/10 pt-5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-sm text-emerald-400">
                  No paid service required
                </span>
              </div>

              <p className="mt-2 text-xs leading-5 text-zinc-600">
                실제 AI 생성 API를 연결하기 전까지는
                로컬 개발 환경에서 계속 진행할 수 있습니다.
              </p>
            </div>
          </div>

        </section>

        {/* FOOTER */}
        <footer className="mt-12 border-t border-white/10 py-6 text-center text-xs text-zinc-700">
          AI Influencer Factory · System Monitoring Console
        </footer>

      </div>
    </main>
  );
}
