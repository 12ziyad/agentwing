"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, Database, KeyRound, Play, Plus, Save, Shield, ToggleLeft, ToggleRight } from "lucide-react";
import type {
  ActionReceipt,
  AgentWingApiKeyRecord,
  AgentWingProject,
  ApiKeyUsage,
  ReceiptStats,
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

type SandboxConfig = {
  mode: "none" | "e2b_byok" | "custom_http" | "managed_soon";
  e2bKeySaved: boolean;
  e2bKeyLast4?: string;
  e2bKeyUpdatedAt?: string;
};

function cardClass() {
  return "rounded-md border border-white/[0.08] bg-[#080b12] p-5";
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
  const [config, setConfig] = useState<SandboxConfig>({ mode: "none", e2bKeySaved: false });
  const [status, setStatus] = useState("Sandbox configuration is loaded from server-side storage.");
  const [lastTest, setLastTest] = useState<{ ok: boolean; at: string; message: string } | undefined>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/v1/sandbox/config")
      .then((response) => response.json())
      .then((data: { sandbox?: SandboxConfig }) => {
        if (data.sandbox) setConfig(data.sandbox);
      })
      .catch(() => setStatus("Unable to load sandbox configuration."));
  }, []);

  async function saveKey() {
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
      setStatus(data.sandbox?.e2bKeySaved ? "Connected. E2B BYOK key is stored server-side only." : "Not connected.");
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
      const data = (await response.json()) as { message?: string; sandbox?: SandboxConfig };
      if (data.sandbox) setConfig(data.sandbox);
      const message = data.message ?? (response.ok ? "E2B configuration is present." : "E2B test failed.");
      setLastTest({ ok: response.ok, at: new Date().toISOString(), message });
      setStatus(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeading
        title="Sandboxes"
        copy="Configure where AgentWing routes actions that require isolated execution. Secrets stay server-side only."
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {["None", "E2B BYOK", "Custom HTTP Sandbox", "AgentWing Managed Sandbox: coming soon"].map((mode) => (
          <div key={mode} className={cardClass()}>
            <p className="text-sm font-semibold text-white">{mode}</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              {mode === "E2B BYOK" ? "Use your own E2B key from server-side storage." : "Selectable routing mode for project policy."}
            </p>
          </div>
        ))}
      </div>
      <section className={cardClass()}>
        <div className="mb-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-md border border-white/[0.08] bg-[#05070d] p-3">
            <p className="text-xs text-slate-500">Provider</p>
            <p className="mt-2 text-sm font-semibold text-white">E2B BYOK</p>
          </div>
          <div className="rounded-md border border-white/[0.08] bg-[#05070d] p-3">
            <p className="text-xs text-slate-500">Status</p>
            <p className={config.e2bKeySaved ? "mt-2 text-sm font-semibold text-emerald-100" : "mt-2 text-sm font-semibold text-slate-300"}>
              {config.e2bKeySaved ? "Connected" : "Not connected"}
            </p>
          </div>
          <div className="rounded-md border border-white/[0.08] bg-[#05070d] p-3">
            <p className="text-xs text-slate-500">Key status</p>
            <p className="mt-2 text-sm font-semibold text-white">
              {config.e2bKeySaved ? `Saved server-side${config.e2bKeyLast4 ? `, last 4 ${config.e2bKeyLast4}` : ""}` : "No key saved"}
            </p>
          </div>
          <div className="rounded-md border border-white/[0.08] bg-[#05070d] p-3">
            <p className="text-xs text-slate-500">Updated</p>
            <p className="mt-2 text-sm font-semibold text-white">
              {config.e2bKeyUpdatedAt ? new Date(config.e2bKeyUpdatedAt).toLocaleString() : "No update yet"}
            </p>
          </div>
        </div>
        <label htmlFor="e2b-key" className="text-sm font-semibold text-white">
          E2B API key
        </label>
        <p className="mt-1 text-sm text-slate-400">
          Stored server-side for AgentWing sandbox routing. The raw key is never returned after save.
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
            className="inline-flex items-center justify-center gap-2 rounded-md border border-cyan-300/25 bg-cyan-300 px-4 py-2 text-sm font-semibold text-[#031018] disabled:opacity-60"
          >
            <Save className="size-4" />
            {config.e2bKeySaved ? "Replace key" : "Save"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={testKey}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-100 disabled:opacity-60"
          >
            <Play className="size-4" />
            Test
          </button>
        </div>
        <p className="mt-3 rounded-md border border-white/[0.08] bg-[#05070d] px-3 py-2 text-sm text-slate-300">{status}</p>
        {lastTest && (
          <p className={lastTest.ok ? "mt-3 text-xs text-emerald-100" : "mt-3 text-xs text-amber-100"}>
            Last test {new Date(lastTest.at).toLocaleString()}: {lastTest.message}
          </p>
        )}
      </section>
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
