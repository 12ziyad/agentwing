"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Database,
  KeyRound,
  Play,
  Plus,
  RefreshCw,
  Save,
  Shield,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import type {
  ActionReceipt,
  AgentWingApiKeyRecord,
  AgentWingProject,
  ApiKeyUsage,
  ReceiptStats,
  SandboxProviderConfig,
} from "@/lib/agentwingTypes";

const defaultStats: ReceiptStats = {
  total: 0,
  blocked: 0,
  approvalRequired: 0,
  sandboxRequired: 0,
  receiptsCreated: 0,
};

const defaultUsage: ApiKeyUsage = {
  apiKey: "aw_live_demo_key",
  actionChecksUsed: 0,
  sandboxRunsUsed: 0,
  receiptsCreated: 0,
  planName: "Beta",
  actionCheckLimit: 1000,
  sandboxRunLimit: 20,
};

const policies = [
  ["block-secret-file-access", "Block .env and secret file access", "block"],
  ["block-force-push", "Block git push --force", "block"],
  ["approval-external-message", "Require approval for external messages", "approval_required"],
  ["approval-payment-action", "Require approval for payment actions", "approval_required"],
  ["approval-destructive-database-query", "Gate destructive database queries", "approval_required"],
  ["sandbox-node-command", "Route npm test and npm install to sandbox", "sandbox_required"],
  ["restore-point-file-write", "Require restore points before file writes", "restore_point_required"],
  ["allow-read-only", "Allow safe read-only actions", "allow"],
] as const;

const decisionClass: Record<string, string> = {
  allow: "border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-100",
  block: "border-red-300/25 bg-red-400/[0.08] text-red-100",
  approval_required: "border-amber-300/25 bg-amber-300/[0.08] text-amber-100",
  sandbox_required: "border-cyan-300/25 bg-cyan-300/[0.08] text-cyan-100",
  restore_point_required: "border-violet-300/25 bg-violet-300/[0.08] text-violet-100",
};

type SandboxConfig = SandboxProviderConfig;

const emptySandboxConfig: SandboxConfig = {
  provider: "e2b-byok",
  connected: false,
  mode: "none",
  byok: true,
  sandboxMode: "none",
  runtimeExecutionEnabled: false,
  e2bKeySaved: false,
};

function cardClass() {
  return "rounded-md border border-white/[0.08] bg-[#080b12] p-5";
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString() : "Not available";
}

function maskedSandboxKey(config: SandboxConfig) {
  const last4 = config.keyLast4 ?? config.e2bKeyLast4;
  if (!last4) return "Saved server-side";
  return `${config.keyPrefix ?? ""}••••${last4}`;
}

function statusPillClass(kind: "connected" | "empty" | "success" | "failed") {
  const classes = {
    connected: "border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-100",
    empty: "border-slate-300/15 bg-slate-300/[0.06] text-slate-300",
    success: "border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-100",
    failed: "border-amber-300/25 bg-amber-300/[0.08] text-amber-100",
  };
  return `inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-semibold ${classes[kind]}`;
}

export function ApiKeysPanel() {
  const [projects, setProjects] = useState<AgentWingProject[]>([]);
  const [apiKeys, setApiKeys] = useState<AgentWingApiKeyRecord[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [newApiKey, setNewApiKey] = useState("aw_live_demo_key");
  const [status, setStatus] = useState("Demo mode key remains available: aw_live_demo_key.");

  useEffect(() => {
    fetch("/api/v1/projects")
      .then((response) => response.json())
      .then((data: { projects?: AgentWingProject[] }) => {
        const nextProjects = data.projects ?? [];
        setProjects(nextProjects);
        setSelectedProjectId((current) => current || nextProjects[0]?.projectId || "");
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const query = selectedProjectId ? `?projectId=${encodeURIComponent(selectedProjectId)}` : "";
    fetch(`/api/v1/api-keys${query}`)
      .then((response) => response.json())
      .then((data: { apiKeys?: AgentWingApiKeyRecord[] }) => setApiKeys(data.apiKeys ?? []))
      .catch(() => undefined);
  }, [selectedProjectId]);

  async function generateKey() {
    if (!selectedProjectId) {
      setStatus("Create a project before generating an API key.");
      return;
    }

    const response = await fetch("/api/v1/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: selectedProjectId }),
    });
    const data = (await response.json()) as {
      apiKey?: string;
      apiKeyRecord?: AgentWingApiKeyRecord;
      error?: string;
    };

    if (!response.ok || !data.apiKey || !data.apiKeyRecord) {
      setStatus(data.error ?? "Unable to generate API key.");
      return;
    }

    setNewApiKey(data.apiKey);
    setApiKeys((current) => [data.apiKeyRecord!, ...current]);
    setStatus("New API key generated. Copy it now; only the prefix is shown later.");
  }

  return (
    <div className="space-y-5">
      <PageHeading
        title="API Keys"
        copy="Generate project-scoped API keys for SDK integration. Billing is intentionally out of scope for this V1 surface."
      />
      <section className={cardClass()}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">AgentWing API key</p>
            <p className="mt-1 text-sm text-slate-400">
              Use generated keys with @agentwing/sdk. The demo key aw_live_demo_key still works for Runtime Lab.
            </p>
          </div>
          <button
            type="button"
            onClick={generateKey}
            className="inline-flex items-center gap-2 rounded-md border border-cyan-300/25 bg-cyan-300 px-3 py-2 text-sm font-semibold text-[#031018]"
          >
            <KeyRound className="size-4" />
            Generate key
          </button>
        </div>
        <label htmlFor="api-key-project" className="mt-5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
          Project
        </label>
        <select
          id="api-key-project"
          value={selectedProjectId}
          onChange={(event) => setSelectedProjectId(event.target.value)}
          className="mt-2 min-h-11 w-full rounded-md border border-white/[0.1] bg-[#05070d] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/35"
        >
          <option value="">Select a project</option>
          {projects.map((project) => (
            <option key={project.projectId} value={project.projectId}>
              {project.name}
            </option>
          ))}
        </select>
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-md border border-white/[0.08] bg-[#05070d] p-3">
          <code className="min-w-0 flex-1 overflow-x-auto font-mono text-sm text-cyan-100">{newApiKey}</code>
          <button
            type="button"
            onClick={() => newApiKey && navigator.clipboard?.writeText(newApiKey)}
            className="inline-flex items-center gap-2 rounded border border-white/[0.1] px-2.5 py-1.5 text-xs font-semibold text-slate-200"
          >
            <Copy className="size-3.5" />
            Copy
          </button>
        </div>
        <p className="mt-3 text-sm text-slate-400">{status}</p>
      </section>
      <section className="overflow-hidden rounded-md border border-white/[0.08] bg-[#080b12]">
        <div className="grid grid-cols-[1fr_1fr_0.8fr_0.8fr] border-b border-white/[0.08] bg-[#0c1019] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          <span>Prefix</span>
          <span>Project</span>
          <span>Plan</span>
          <span>Last used</span>
        </div>
        {apiKeys.length === 0 ? (
          <p className="px-4 py-8 text-sm text-slate-400">No generated keys for this project yet.</p>
        ) : (
          apiKeys.map((key) => (
            <div
              key={key.apiKeyId}
              className="grid grid-cols-[1fr_1fr_0.8fr_0.8fr] gap-3 border-b border-white/[0.06] px-4 py-3 text-sm last:border-b-0"
            >
              <span className="font-mono text-xs text-cyan-100">{key.keyPrefix}</span>
              <span className="font-mono text-xs text-slate-300">{key.projectId}</span>
              <span className="text-slate-300">{key.planName}</span>
              <span className="text-xs text-slate-500">
                {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "Never"}
              </span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

export function PoliciesPanel() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(policies.map(([id]) => [id, true])),
  );

  return (
    <div className="space-y-5">
      <PageHeading
        title="Default Policies"
        copy="Visual policy controls for the default AgentWing V1 rules. The backend currently uses these defaults while project-level persistence is added."
      />
      <div className="grid gap-3">
        {policies.map(([id, label, decision]) => (
          <button
            key={id}
            type="button"
            onClick={() => setEnabled((current) => ({ ...current, [id]: !current[id] }))}
            className="flex items-center justify-between gap-4 rounded-md border border-white/[0.08] bg-[#080b12] p-4 text-left transition hover:border-cyan-300/20"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">{label}</p>
              <p className="mt-1 font-mono text-xs text-slate-500">{id}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`hidden rounded border px-2 py-1 text-[11px] font-semibold sm:inline ${decisionClass[decision]}`}>
                {decision}
              </span>
              {enabled[id] ? <ToggleRight className="size-6 text-cyan-200" /> : <ToggleLeft className="size-6 text-slate-500" />}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function SandboxesPanel() {
  const [apiKey, setApiKey] = useState("");
  const [config, setConfig] = useState<SandboxConfig>(emptySandboxConfig);
  const [status, setStatus] = useState("Loading sandbox provider configuration...");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isReplacing, setIsReplacing] = useState(false);

  useEffect(() => {
    fetch("/api/v1/sandbox/config")
      .then((response) => response.json())
      .then((data: { sandbox?: SandboxConfig }) => {
        if (data.sandbox) setConfig(data.sandbox);
        setStatus("Sandbox provider metadata loaded.");
      })
      .catch(() => setStatus("Unable to load sandbox configuration."))
      .finally(() => setLoading(false));
  }, []);

  async function saveKey() {
    if (!apiKey.trim()) {
      setStatus("Paste an E2B API key before saving.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/v1/sandbox/save-e2b", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const data = (await response.json()) as { ok?: boolean; sandbox?: SandboxConfig; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Unable to save E2B key.");
      setApiKey("");
      if (data.sandbox) setConfig(data.sandbox);
      setIsReplacing(false);
      setStatus("Connected. E2B BYOK key is stored server-side only.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save E2B key.");
    } finally {
      setBusy(false);
    }
  }

  async function testKey() {
    setBusy(true);
    try {
      const response = await fetch("/api/v1/sandbox/test-e2b", { method: "POST" });
      const data = (await response.json()) as { ok?: boolean; message?: string; sandbox?: SandboxConfig };
      if (data.sandbox) setConfig(data.sandbox);
      const message = data.message ?? (response.ok ? "E2B configuration is present." : "E2B test failed.");
      setStatus(message);
    } catch {
      setStatus("Unable to test E2B connection.");
    } finally {
      setBusy(false);
    }
  }

  async function removeKey() {
    if (!window.confirm("Remove the saved E2B BYOK key from server-side storage?")) return;

    setBusy(true);
    try {
      const response = await fetch("/api/v1/sandbox/config", { method: "DELETE" });
      const data = (await response.json()) as { ok?: boolean; sandbox?: SandboxConfig; error?: string; message?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Unable to remove E2B key.");
      setConfig(data.sandbox ?? emptySandboxConfig);
      setApiKey("");
      setIsReplacing(false);
      setStatus(data.message ?? "E2B BYOK key removed.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to remove E2B key.");
    } finally {
      setBusy(false);
    }
  }

  const connected = config.connected || config.e2bKeySaved;
  const showSetup = !connected || isReplacing;
  const lastTestKind = config.lastTestStatus === "success" ? "success" : config.lastTestStatus === "failed" ? "failed" : "empty";

  return (
    <div className="space-y-5">
      <PageHeading
        title="Sandboxes"
        copy="Configure where AgentWing routes actions that require isolated execution. Secrets stay server-side only."
      />

      <div className="grid gap-3 md:grid-cols-3">
        <article className={cardClass()}>
          <p className="text-xs font-medium text-slate-400">Connected sandbox providers</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{connected ? 1 : 0}</p>
          <p className="mt-2 text-xs text-slate-500">Runtime execution is {connected ? "enabled" : "waiting for a BYOK key"}.</p>
        </article>
        <article className={cardClass()}>
          <p className="text-xs font-medium text-slate-400">Available providers</p>
          <p className="mt-3 text-sm font-semibold text-white">E2B BYOK</p>
          <p className="mt-2 text-xs text-slate-500">Server-side customer-owned sandbox credentials.</p>
        </article>
        <article className={cardClass()}>
          <p className="text-xs font-medium text-slate-400">Coming soon</p>
          <p className="mt-3 text-sm font-semibold text-white">Daytona, Cloudflare Sandbox, Custom HTTP Sandbox, Browserbase</p>
          <p className="mt-2 text-xs text-slate-500">Additional providers will follow the same safe metadata model.</p>
        </article>
      </div>

      <section className={cardClass()}>
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.08] pb-5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">E2B BYOK Sandbox</p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Connect your own E2B API key. AgentWing uses this key server-side to run sandbox-required agent actions.
              Your key is never shown again after saving.
            </p>
          </div>
          {loading ? (
            <span className={statusPillClass("empty")}>Loading</span>
          ) : connected ? (
            <span className={statusPillClass("connected")}>
              <CheckCircle2 className="size-3.5" />
              Connected
            </span>
          ) : (
            <span className={statusPillClass("empty")}>Not connected</span>
          )}
        </div>

        {connected && (
          <div className="mt-5 grid gap-x-6 gap-y-4 md:grid-cols-2">
            <ProviderDetail label="Provider" value="E2B BYOK" />
            <ProviderDetail label="Key" value={maskedSandboxKey(config)} mono />
            <ProviderDetail label="Sandbox mode" value={config.sandboxMode === "BYOK" ? "BYOK" : "None"} />
            <ProviderDetail label="Runtime execution" value={config.runtimeExecutionEnabled ? "Enabled" : "Disabled"} />
            <ProviderDetail label="Created/updated" value={formatDate(config.updatedAt ?? config.e2bKeyUpdatedAt ?? config.createdAt)} />
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Last tested</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={statusPillClass(lastTestKind)}>
                  {config.lastTestStatus === "success" ? "Success" : config.lastTestStatus === "failed" ? "Failed" : "Not tested"}
                </span>
                {config.lastTestedAt && <span className="text-xs text-slate-500">{formatDate(config.lastTestedAt)}</span>}
              </div>
            </div>
          </div>
        )}

        {showSetup && (
          <div className={connected ? "mt-5 border-t border-white/[0.08] pt-5" : "mt-5"}>
            <label htmlFor="e2b-key" className="text-sm font-semibold text-white">
              E2B API key
            </label>
            <p className="mt-1 text-sm text-slate-400">
              Your API key is stored server-side and never returned to the browser.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                id="e2b-key"
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="Paste E2B BYOK key"
                className="min-h-11 flex-1 rounded-md border border-white/[0.1] bg-[#05070d] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/35"
              />
              <button
                type="button"
                disabled={busy}
                onClick={saveKey}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-cyan-300/25 bg-cyan-300 px-4 py-2 text-sm font-semibold text-[#031018] disabled:opacity-60"
              >
                <Save className="size-4" />
                Save key
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={testKey}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-100 disabled:opacity-60"
              >
                <Play className="size-4" />
                Test connection
              </button>
            </div>
          </div>
        )}

        {connected && !showSetup && (
          <div className="mt-5 flex flex-wrap gap-3 border-t border-white/[0.08] pt-5">
            <button
              type="button"
              disabled={busy}
              onClick={testKey}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-100 disabled:opacity-60"
            >
              <Play className="size-4" />
              Test
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setIsReplacing(true)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-4 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-60"
            >
              <RefreshCw className="size-4" />
              Replace key
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={removeKey}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-red-300/20 bg-red-400/[0.08] px-4 py-2 text-sm font-semibold text-red-100 disabled:opacity-60"
            >
              <Trash2 className="size-4" />
              Remove key
            </button>
          </div>
        )}

        <div className="mt-4 flex items-start gap-2 rounded-md border border-white/[0.08] bg-[#05070d] px-3 py-2 text-sm text-slate-300">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-cyan-200" />
          <p>{busy ? "Working..." : status}</p>
        </div>
      </section>
    </div>
  );
}

function ProviderDetail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 border-b border-white/[0.06] pb-3">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className={mono ? "mt-2 break-all font-mono text-sm text-cyan-100" : "mt-2 text-sm font-semibold text-white"}>
        {value}
      </p>
    </div>
  );
}

export function ReceiptsPanel() {
  const [receipts, setReceipts] = useState<ActionReceipt[]>([]);
  const [stats, setStats] = useState<ReceiptStats>(defaultStats);

  useEffect(() => {
    fetch("/api/v1/receipts")
      .then((response) => response.json())
      .then((data: { receipts?: ActionReceipt[]; stats?: ReceiptStats }) => {
        setReceipts(data.receipts ?? []);
        setStats(data.stats ?? defaultStats);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="space-y-5">
      <PageHeading
        title="Action Receipts"
        copy="Audit trail for checks made through /api/v1/check-action and sandbox routes."
      />
      <StatsGrid stats={stats} />
      <ReceiptsTable receipts={receipts} />
    </div>
  );
}

export function ProjectsPanel() {
  const [projects, setProjects] = useState<AgentWingProject[]>([]);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch("/api/v1/projects")
      .then((response) => response.json())
      .then((data: { projects?: AgentWingProject[] }) => setProjects(data.projects ?? []))
      .catch(() => setStatus("Unable to load projects."));
  }, []);

  async function createNewProject() {
    const response = await fetch("/api/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = (await response.json()) as { project?: AgentWingProject; error?: string };
    if (!response.ok || !data.project) {
      setStatus(data.error ?? "Unable to create project.");
      return;
    }

    setProjects((current) => [data.project!, ...current]);
    setName("");
    setStatus(`Created ${data.project.name}.`);
  }

  return (
    <div className="space-y-5">
      <PageHeading title="Projects" copy="Create projects for grouping sessions, generated API keys, policy decisions, and receipts." />
      <section className={cardClass()}>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="project-name"
            className="min-h-11 flex-1 rounded-md border border-white/[0.1] bg-[#05070d] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/35"
          />
          <button
            type="button"
            onClick={createNewProject}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-cyan-300/25 bg-cyan-300 px-4 py-2 text-sm font-semibold text-[#031018]"
          >
            <Plus className="size-4" />
            Create project
          </button>
        </div>
        {status && <p className="mt-3 text-sm text-slate-400">{status}</p>}
      </section>
      <div className="grid gap-3 md:grid-cols-2">
        {projects.map((project) => (
          <article key={project.projectId} className={cardClass()}>
            <p className="text-sm font-semibold text-white">{project.name}</p>
            <p className="mt-2 font-mono text-xs text-cyan-100">{project.projectId}</p>
            <p className="mt-2 text-xs text-slate-400">
              Created {new Date(project.createdAt).toLocaleString()}. Default policy pack and API key usage enabled.
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

export function UsagePanel({ stats, usage = defaultUsage }: { stats: ReceiptStats; usage?: ApiKeyUsage }) {
  const actionCheckPercent = Math.min(100, Math.round((usage.actionChecksUsed / usage.actionCheckLimit) * 100));
  const sandboxPercent = Math.min(100, Math.round((usage.sandboxRunsUsed / usage.sandboxRunLimit) * 100));

  return (
    <div className="space-y-5">
      <PageHeading title="Usage" copy="Development counters for the local demo API key and beta plan limits." />
      <StatsGrid stats={stats} />
      <section className={cardClass()}>
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
          <div>
            <p className="text-sm font-semibold text-white">{usage.planName} plan</p>
            <p className="mt-1 font-mono text-xs text-slate-400">{usage.apiKey}</p>
          </div>
          <span className="rounded border border-cyan-300/20 bg-cyan-300/[0.08] px-2 py-1 text-xs font-semibold text-cyan-100">
            Local/dev
          </span>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <UsageMeter
            label="Action checks"
            value={usage.actionChecksUsed}
            limit={usage.actionCheckLimit}
            percent={actionCheckPercent}
          />
          <UsageMeter
            label="Sandbox runs"
            value={usage.sandboxRunsUsed}
            limit={usage.sandboxRunLimit}
            percent={sandboxPercent}
          />
          <div className="rounded-md border border-white/[0.08] bg-[#05070d] p-4">
            <p className="text-xs font-medium text-slate-400">Receipts created</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{usage.receiptsCreated}</p>
            <p className="mt-2 text-xs text-slate-500">Incremented with successful checks and sandbox routes.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function UsageMeter({ label, value, limit, percent }: { label: string; value: number; limit: number; percent: number }) {
  return (
    <div className="rounded-md border border-white/[0.08] bg-[#05070d] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-slate-400">{label}</p>
        <p className="font-mono text-xs text-slate-400">
          {value} / {limit}
        </p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full bg-cyan-300" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-500">{percent}% used</p>
    </div>
  );
}

export function StatsGrid({ stats }: { stats: ReceiptStats }) {
  const items = [
    ["Total actions checked", stats.total, Shield],
    ["Blocked actions", stats.blocked, Shield],
    ["Approval required", stats.approvalRequired, CheckCircle2],
    ["Sandbox required", stats.sandboxRequired, Database],
    ["Receipts created", stats.receiptsCreated, KeyRound],
  ] as const;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {items.map(([label, value, Icon]) => (
        <article key={label} className={cardClass()}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-slate-400">{label}</p>
            <Icon className="size-4 text-cyan-200" />
          </div>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-white">{value}</p>
        </article>
      ))}
    </div>
  );
}

export function ReceiptsTable({ receipts }: { receipts: ActionReceipt[] }) {
  const rows = useMemo(() => receipts.slice(0, 20), [receipts]);

  return (
    <section className="overflow-hidden rounded-md border border-white/[0.08] bg-[#080b12]">
      <div className="grid grid-cols-[0.9fr_0.7fr_0.7fr_1.4fr_0.9fr] border-b border-white/[0.08] bg-[#0c1019] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
        <span>Decision</span>
        <span>Risk</span>
        <span>Type</span>
        <span>Feedback</span>
        <span>Timestamp</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-sm text-slate-400">No receipts yet. Create one with POST /api/v1/check-action.</p>
      ) : (
        rows.map((receipt) => (
          <div
            key={receipt.receiptId}
            className="grid grid-cols-[0.9fr_0.7fr_0.7fr_1.4fr_0.9fr] gap-3 border-b border-white/[0.06] px-4 py-3 text-sm last:border-b-0"
          >
            <span className={`w-fit rounded border px-2 py-1 text-[11px] font-semibold ${decisionClass[receipt.decision]}`}>
              {receipt.decision}
            </span>
            <span className="text-slate-300">{receipt.risk}</span>
            <span className="font-mono text-xs text-cyan-100">{receipt.actionType}</span>
            <span className="min-w-0 truncate text-slate-300">{receipt.feedback}</span>
            <span className="text-xs text-slate-500">{new Date(receipt.createdAt).toLocaleString()}</span>
          </div>
        ))
      )}
    </section>
  );
}

export function PageHeading({ title, copy }: { title: string; copy: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">AgentWing V1</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">{title}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{copy}</p>
    </div>
  );
}
