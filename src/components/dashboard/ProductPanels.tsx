"use client";

import Link from "next/link";
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
  ShieldOff,
  Trash2,
  ToggleLeft,
  ToggleRight,
  X,
} from "lucide-react";
import type {
  ActionReceipt,
  AgentWingApiKeyRecord,
  AgentWingProject,
  ApiKeyUsage,
  CustomPolicy,
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
  apiKey: "",
  actionChecksUsed: 0,
  sandboxRunsUsed: 0,
  receiptsCreated: 0,
  planName: "Beta",
  actionCheckLimit: 1000,
  sandboxRunLimit: 20,
};

const decisionClass: Record<string, string> = {
  allow: "border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-100",
  block: "border-red-300/25 bg-red-400/[0.08] text-red-100",
  approval_required: "border-amber-300/25 bg-amber-300/[0.08] text-amber-100",
  sandbox_required: "border-cyan-300/25 bg-cyan-300/[0.08] text-cyan-100",
  restore_point_required: "border-violet-300/25 bg-violet-300/[0.08] text-violet-100",
};

const riskClass: Record<string, string> = {
  low: "text-emerald-100",
  medium: "text-amber-100",
  high: "text-red-100",
  critical: "text-red-300",
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
  return value ? new Date(value).toLocaleString() : "—";
}

function maskedSandboxKey(config: SandboxConfig) {
  const last4 = config.keyLast4 ?? config.e2bKeyLast4;
  if (!last4) return "Saved server-side";
  return `${config.keyPrefix ?? "e2b_"}••••${last4}`;
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

// ─── Copy button with success/error feedback ──────────────────────────────────

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const el = document.createElement("textarea");
        el.value = text;
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.focus();
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setState("copied");
    } catch {
      setState("error");
    }
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={className ?? "inline-flex items-center gap-2 rounded border border-white/[0.1] px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:text-white"}
    >
      {state === "copied" ? (
        <>
          <CheckCircle2 className="size-3.5 text-emerald-300" />
          Copied
        </>
      ) : state === "error" ? (
        <>
          <AlertCircle className="size-3.5 text-red-300" />
          Failed
        </>
      ) : (
        <>
          <Copy className="size-3.5" />
          Copy
        </>
      )}
    </button>
  );
}

// ─── API Keys Panel ───────────────────────────────────────────────────────────

export function ApiKeysPanel() {
  const [projects, setProjects] = useState<AgentWingProject[]>([]);
  const [apiKeys, setApiKeys] = useState<AgentWingApiKeyRecord[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [newApiKey, setNewApiKey] = useState("");
  const [status, setStatus] = useState("");
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/projects")
      .then((r) => r.json())
      .then((data: { projects?: AgentWingProject[] }) => {
        const next = data.projects ?? [];
        setProjects(next);
        setSelectedProjectId((cur) => cur || next[0]?.projectId || "");
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const query = selectedProjectId ? `?projectId=${encodeURIComponent(selectedProjectId)}` : "";
    fetch(`/api/v1/api-keys${query}`)
      .then((r) => r.json())
      .then((data: { apiKeys?: AgentWingApiKeyRecord[] }) => setApiKeys(data.apiKeys ?? []))
      .catch(() => undefined);
  }, [selectedProjectId]);

  async function generateKey() {
    if (!selectedProjectId) {
      setStatus("Select a project before generating an API key.");
      return;
    }
    const response = await fetch("/api/v1/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: selectedProjectId }),
    });
    const data = (await response.json()) as { apiKey?: string; apiKeyRecord?: AgentWingApiKeyRecord; error?: string };
    if (!response.ok || !data.apiKey || !data.apiKeyRecord) {
      setStatus(data.error ?? "Unable to generate API key.");
      return;
    }
    setNewApiKey(data.apiKey);
    setApiKeys((cur) => [data.apiKeyRecord!, ...cur]);
    setStatus("New API key generated. Copy it now — the full key is only shown once.");
  }

  async function handleRevoke(keyId: string) {
    if (!confirm("Revoke this API key? It will stop working immediately.")) return;
    setRevoking(keyId);
    try {
      const r = await fetch(`/api/v1/api-keys/${keyId}`, { method: "DELETE" });
      const data = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !data.ok) {
        setStatus(data.error ?? "Unable to revoke API key.");
        return;
      }
      setApiKeys((cur) => cur.map((k) => (k.apiKeyId === keyId ? { ...k, revokedAt: new Date().toISOString() } : k)));
      setStatus("API key revoked.");
      if (newApiKey) setNewApiKey("");
    } finally {
      setRevoking(null);
    }
  }

  const activeKeys = apiKeys.filter((k) => !k.revokedAt);
  const revokedKeys = apiKeys.filter((k) => k.revokedAt);

  return (
    <div className="space-y-5">
      <PageHeading
        title="API Keys"
        copy="Generate project-scoped API keys. Keys are shown once and stored as a secure hash. Revoke keys at any time."
      />

      <section className={cardClass()}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">Generate API key</p>
            <p className="mt-1 text-sm text-slate-400">
              Select a project and generate a key. Copy it immediately — you cannot retrieve it later.
            </p>
          </div>
          <button
            type="button"
            onClick={generateKey}
            className="inline-flex items-center gap-2 rounded-md border border-cyan-300/25 bg-cyan-300 px-3 py-2 text-sm font-semibold text-[#031018] transition hover:bg-cyan-200"
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
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="mt-2 min-h-11 w-full rounded-md border border-white/[0.1] bg-[#05070d] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/35"
        >
          <option value="">Select a project</option>
          {projects.map((p) => (
            <option key={p.projectId} value={p.projectId}>{p.name}</option>
          ))}
        </select>

        {newApiKey && (
          <div className="mt-5 rounded-md border border-cyan-300/20 bg-cyan-300/[0.04] p-4">
            <p className="mb-2 text-xs font-semibold text-cyan-200">New key — copy now, shown once only</p>
            <div className="flex items-center gap-3">
              <code className="min-w-0 flex-1 overflow-x-auto break-all font-mono text-sm text-cyan-100">{newApiKey}</code>
              <CopyButton text={newApiKey} />
            </div>
          </div>
        )}

        {status && (
          <p className="mt-3 text-sm text-slate-400">{status}</p>
        )}
      </section>

      <section className="overflow-hidden rounded-md border border-white/[0.08] bg-[#080b12]">
        <div className="border-b border-white/[0.08] bg-[#0c1019] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Active keys ({activeKeys.length})
          </p>
        </div>
        <div className="grid grid-cols-[1fr_1fr_0.8fr_0.9fr_auto] border-b border-white/[0.05] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
          <span>Prefix</span>
          <span>Project</span>
          <span>Plan</span>
          <span>Last used</span>
          <span />
        </div>
        {activeKeys.length === 0 ? (
          <p className="px-4 py-8 text-sm text-slate-400">No active keys for this project.</p>
        ) : (
          activeKeys.map((key) => (
            <div
              key={key.apiKeyId}
              className="grid grid-cols-[1fr_1fr_0.8fr_0.9fr_auto] items-center gap-3 border-b border-white/[0.06] px-4 py-3 text-sm last:border-b-0"
            >
              <span className="font-mono text-xs text-cyan-100">{key.keyPrefix}</span>
              <span className="font-mono text-xs text-slate-400">{key.projectId}</span>
              <span className="text-slate-300">{key.planName}</span>
              <span className="text-xs text-slate-500">{key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "Never"}</span>
              <button
                type="button"
                disabled={revoking === key.apiKeyId}
                onClick={() => handleRevoke(key.apiKeyId)}
                className="inline-flex items-center gap-1.5 rounded border border-red-300/15 bg-red-400/[0.06] px-2 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-400/[0.12] disabled:opacity-50"
              >
                <ShieldOff className="size-3" />
                Revoke
              </button>
            </div>
          ))
        )}
      </section>

      {revokedKeys.length > 0 && (
        <section className="overflow-hidden rounded-md border border-white/[0.06] bg-[#080b12] opacity-60">
          <div className="border-b border-white/[0.06] bg-[#0c1019] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Revoked keys ({revokedKeys.length})
            </p>
          </div>
          {revokedKeys.map((key) => (
            <div
              key={key.apiKeyId}
              className="flex items-center gap-4 border-b border-white/[0.04] px-4 py-3 text-sm last:border-b-0"
            >
              <span className="font-mono text-xs text-slate-500 line-through">{key.keyPrefix}</span>
              <span className="text-xs text-slate-600">Revoked {formatDate(key.revokedAt)}</span>
            </div>
          ))}
        </section>
      )}

      <section className={cardClass()}>
        <p className="text-sm font-semibold text-white">API example</p>
        <p className="mt-2 text-xs text-slate-400">Replace AW_LIVE_KEY_HERE with your key. Never include real keys in docs or source code.</p>
        <div className="mt-4 space-y-3">
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-500">cURL</p>
            <pre className="overflow-x-auto rounded-md border border-white/[0.08] bg-[#05070d] p-3 text-xs leading-6 text-slate-300">{`curl -X POST https://agentwing.gpmai.dev/api/v1/check-action \\
  -H "Authorization: Bearer AW_LIVE_KEY_HERE" \\
  -H "Content-Type: application/json" \\
  -d '{"actionType":"file_access","tool":"filesystem","target":".env"}'`}</pre>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-500">JavaScript fetch</p>
            <pre className="overflow-x-auto rounded-md border border-white/[0.08] bg-[#05070d] p-3 text-xs leading-6 text-slate-300">{`const r = await fetch("https://agentwing.gpmai.dev/api/v1/check-action", {
  method: "POST",
  headers: {
    "Authorization": "Bearer " + process.env.AGENTWING_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ actionType: "file_access", target: ".env" }),
});
const { decision, risk, policy, receiptId } = await r.json();`}</pre>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Policies Panel ───────────────────────────────────────────────────────────

const DECISION_OPTIONS = ["allow", "block", "approval_required", "sandbox_required", "restore_point_required"];
const RISK_OPTIONS = ["low", "medium", "high", "critical"];
const ACTION_TYPES = ["", "file_access", "shell_command", "api_call", "browser_action", "database_query", "message_send", "payment_action", "deploy_action", "custom_action"];

const EXAMPLE_POLICIES = [
  { name: "Block .env access", actionType: "file_access", targetPattern: "*.env*", decision: "block", risk: "high", feedback: "Secret-bearing .env files are blocked.", priority: 10 },
  { name: "Require approval for npm install", actionType: "shell_command", commandPattern: "npm install*", decision: "approval_required", risk: "medium", feedback: "npm install requires human approval.", priority: 20 },
  { name: "Sandbox unknown shell commands", actionType: "shell_command", decision: "sandbox_required", risk: "medium", feedback: "Unknown shell commands run in sandbox first.", priority: 50 },
  { name: "Block rm -rf", actionType: "shell_command", commandPattern: "rm -rf*", decision: "block", risk: "critical", feedback: "rm -rf is blocked unconditionally.", priority: 5 },
  { name: "Restore point before package.json edit", actionType: "file_access", targetPattern: "*package.json*", decision: "restore_point_required", risk: "medium", feedback: "Create a restore point before editing package.json.", priority: 30 },
];

type PolicyFormData = {
  name: string;
  description: string;
  actionType: string;
  tool: string;
  targetPattern: string;
  commandPattern: string;
  decision: string;
  risk: string;
  priority: number;
  feedback: string;
};

const emptyForm: PolicyFormData = {
  name: "",
  description: "",
  actionType: "",
  tool: "",
  targetPattern: "",
  commandPattern: "",
  decision: "allow",
  risk: "low",
  priority: 100,
  feedback: "",
};

export function PoliciesPanel() {
  const [projects, setProjects] = useState<AgentWingProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [policies, setPolicies] = useState<CustomPolicy[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PolicyFormData>(emptyForm);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/v1/projects")
      .then((r) => r.json())
      .then((data: { projects?: AgentWingProject[] }) => {
        const next = data.projects ?? [];
        setProjects(next);
        setSelectedProjectId((cur) => cur || next[0]?.projectId || "");
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const q = selectedProjectId ? `?projectId=${encodeURIComponent(selectedProjectId)}` : "";
    fetch(`/api/v1/policies${q}`)
      .then((r) => r.json())
      .then((data: { policies?: CustomPolicy[] }) => setPolicies(data.policies ?? []))
      .catch(() => undefined);
  }, [selectedProjectId]);

  function openCreate(prefill?: Partial<PolicyFormData>) {
    setEditingId(null);
    setForm({ ...emptyForm, ...prefill });
    setShowForm(true);
  }

  function openEdit(policy: CustomPolicy) {
    setEditingId(policy.policyId);
    setForm({
      name: policy.name,
      description: policy.description ?? "",
      actionType: policy.actionType ?? "",
      tool: policy.tool ?? "",
      targetPattern: policy.targetPattern ?? "",
      commandPattern: policy.commandPattern ?? "",
      decision: policy.decision,
      risk: policy.risk,
      priority: policy.priority,
      feedback: policy.feedback ?? "",
    });
    setShowForm(true);
  }

  async function savePolicy() {
    if (!form.name.trim()) { setStatus("Policy name is required."); return; }
    setBusy(true);
    try {
      const payload = { ...form, projectId: selectedProjectId || undefined };
      if (editingId) {
        const r = await fetch(`/api/v1/policies/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!r.ok) throw new Error((await r.json() as { error?: string }).error ?? "Update failed.");
        const q = selectedProjectId ? `?projectId=${encodeURIComponent(selectedProjectId)}` : "";
        const refreshed = await fetch(`/api/v1/policies${q}`).then((r) => r.json()) as { policies?: CustomPolicy[] };
        setPolicies(refreshed.policies ?? []);
        setStatus("Policy updated.");
      } else {
        const r = await fetch("/api/v1/policies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await r.json()) as { policy?: CustomPolicy; error?: string };
        if (!r.ok || !data.policy) throw new Error(data.error ?? "Create failed.");
        setPolicies((cur) => [data.policy!, ...cur]);
        setStatus("Policy created.");
      }
      setShowForm(false);
      setEditingId(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Error saving policy.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleEnabled(policy: CustomPolicy) {
    await fetch(`/api/v1/policies/${policy.policyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !policy.enabled }),
    });
    setPolicies((cur) => cur.map((p) => (p.policyId === policy.policyId ? { ...p, enabled: !p.enabled } : p)));
  }

  async function deletePolicy(policyId: string) {
    if (!confirm("Delete this policy? This cannot be undone.")) return;
    await fetch(`/api/v1/policies/${policyId}`, { method: "DELETE" });
    setPolicies((cur) => cur.filter((p) => p.policyId !== policyId));
    setStatus("Policy deleted.");
  }

  return (
    <div className="space-y-5">
      <PageHeading
        title="Policies"
        copy="Critical default safety blocks run first. Custom policies then match before the remaining default AgentWing ruleset. Higher priority = matched first (lower number = higher priority)."
      />

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="min-h-10 rounded-md border border-white/[0.1] bg-[#05070d] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/35"
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.projectId} value={p.projectId}>{p.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => openCreate()}
          className="inline-flex items-center gap-2 rounded-md border border-cyan-300/25 bg-cyan-300 px-3 py-2 text-sm font-semibold text-[#031018] transition hover:bg-cyan-200"
        >
          <Plus className="size-4" />
          Add policy
        </button>
      </div>

      {showForm && (
        <section className={cardClass()}>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-white">{editingId ? "Edit policy" : "New policy"}</p>
            <button type="button" onClick={() => setShowForm(false)}>
              <X className="size-4 text-slate-400" />
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Block .env access"
                className="min-h-10 w-full rounded-md border border-white/[0.1] bg-[#05070d] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/35"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Action type (empty = any)</label>
              <select
                value={form.actionType}
                onChange={(e) => setForm((f) => ({ ...f, actionType: e.target.value }))}
                className="min-h-10 w-full rounded-md border border-white/[0.1] bg-[#05070d] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/35"
              >
                {ACTION_TYPES.map((t) => <option key={t} value={t}>{t || "Any"}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Target pattern (supports *)</label>
              <input
                value={form.targetPattern}
                onChange={(e) => setForm((f) => ({ ...f, targetPattern: e.target.value }))}
                placeholder="*.env* or /etc/passwd"
                className="min-h-10 w-full rounded-md border border-white/[0.1] bg-[#05070d] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/35"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Command pattern (supports *)</label>
              <input
                value={form.commandPattern}
                onChange={(e) => setForm((f) => ({ ...f, commandPattern: e.target.value }))}
                placeholder="rm -rf* or npm install*"
                className="min-h-10 w-full rounded-md border border-white/[0.1] bg-[#05070d] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/35"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Decision *</label>
              <select
                value={form.decision}
                onChange={(e) => setForm((f) => ({ ...f, decision: e.target.value }))}
                className="min-h-10 w-full rounded-md border border-white/[0.1] bg-[#05070d] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/35"
              >
                {DECISION_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Risk *</label>
              <select
                value={form.risk}
                onChange={(e) => setForm((f) => ({ ...f, risk: e.target.value }))}
                className="min-h-10 w-full rounded-md border border-white/[0.1] bg-[#05070d] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/35"
              >
                {RISK_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Priority (lower = matched first)</label>
              <input
                type="number"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: parseInt(e.target.value) || 100 }))}
                className="min-h-10 w-full rounded-md border border-white/[0.1] bg-[#05070d] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/35"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Tool (empty = any)</label>
              <input
                value={form.tool}
                onChange={(e) => setForm((f) => ({ ...f, tool: e.target.value }))}
                placeholder="filesystem"
                className="min-h-10 w-full rounded-md border border-white/[0.1] bg-[#05070d] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/35"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1">Feedback (shown to agent)</label>
              <input
                value={form.feedback}
                onChange={(e) => setForm((f) => ({ ...f, feedback: e.target.value }))}
                placeholder="Explain why this action is blocked or gated."
                className="min-h-10 w-full rounded-md border border-white/[0.1] bg-[#05070d] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/35"
              />
            </div>
          </div>
          {status && <p className="mt-3 text-sm text-slate-400">{status}</p>}
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={savePolicy}
              className="inline-flex items-center gap-2 rounded-md border border-cyan-300/25 bg-cyan-300 px-4 py-2 text-sm font-semibold text-[#031018] disabled:opacity-60"
            >
              <Save className="size-4" />
              {editingId ? "Save changes" : "Create policy"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-100"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      {policies.length === 0 ? (
        <div className={cardClass()}>
          <p className="text-sm font-semibold text-white">No custom policies</p>
          <p className="mt-2 text-sm text-slate-400">
            Default AgentWing policies apply. Add custom policies to override or extend them for your workspace.
          </p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Examples</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {EXAMPLE_POLICIES.map((ex) => (
              <button
                key={ex.name}
                type="button"
                onClick={() => openCreate(ex)}
                className="flex items-start gap-3 rounded-md border border-white/[0.08] bg-[#05070d] p-3 text-left transition hover:border-cyan-300/20"
              >
                <Plus className="mt-0.5 size-3.5 shrink-0 text-cyan-200" />
                <div>
                  <p className="text-xs font-semibold text-white">{ex.name}</p>
                  <span className={`mt-1 inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold ${decisionClass[ex.decision]}`}>
                    {ex.decision}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {policies.map((policy) => (
            <article
              key={policy.policyId}
              className={`rounded-md border bg-[#080b12] p-4 ${policy.enabled ? "border-white/[0.08]" : "border-white/[0.04] opacity-60"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-white">{policy.name}</p>
                    <span className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${decisionClass[policy.decision] ?? ""}`}>
                      {policy.decision}
                    </span>
                    <span className={`text-xs font-semibold ${riskClass[policy.risk] ?? "text-slate-300"}`}>
                      {policy.risk}
                    </span>
                    <span className="text-xs text-slate-500">priority: {policy.priority}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                    {policy.actionType && <span>type: {policy.actionType}</span>}
                    {policy.targetPattern && <span>target: {policy.targetPattern}</span>}
                    {policy.commandPattern && <span>command: {policy.commandPattern}</span>}
                    {policy.tool && <span>tool: {policy.tool}</span>}
                  </div>
                  {policy.feedback && (
                    <p className="mt-1 text-xs text-slate-400">{policy.feedback}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => toggleEnabled(policy)} title={policy.enabled ? "Disable" : "Enable"}>
                    {policy.enabled ? <ToggleRight className="size-5 text-cyan-200" /> : <ToggleLeft className="size-5 text-slate-500" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(policy)}
                    className="rounded border border-white/[0.08] px-2 py-1 text-xs text-slate-300 transition hover:border-white/20"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deletePolicy(policy.policyId)}
                    className="rounded border border-red-300/15 bg-red-400/[0.06] px-2 py-1 text-xs text-red-200 transition hover:bg-red-400/[0.12]"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sandboxes Panel ──────────────────────────────────────────────────────────

export function SandboxesPanel() {
  const [e2bInput, setE2bInput] = useState("");
  const [config, setConfig] = useState<SandboxConfig>(emptySandboxConfig);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isReplacing, setIsReplacing] = useState(false);
  const [secretMissing, setSecretMissing] = useState(false);

  useEffect(() => {
    fetch("/api/v1/sandbox/config")
      .then((r) => r.json())
      .then((data: { sandbox?: SandboxConfig; secretMissing?: boolean }) => {
        if (data.sandbox) setConfig(data.sandbox);
        if (data.secretMissing) setSecretMissing(true);
        setStatus("");
      })
      .catch(() => setStatus("Unable to load sandbox configuration."))
      .finally(() => setLoading(false));
  }, []);

  async function saveKey() {
    if (!e2bInput.trim()) { setStatus("Paste an E2B API key before saving."); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/v1/sandbox/save-e2b", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: e2bInput }),
      });
      const data = (await r.json()) as { ok?: boolean; sandbox?: SandboxConfig; error?: string };
      if (!r.ok || !data.ok) throw new Error(data.error ?? "Unable to save E2B key.");
      setE2bInput("");
      if (data.sandbox) setConfig(data.sandbox);
      setIsReplacing(false);
      setStatus("E2B key saved. The raw key is stored encrypted server-side and never returned.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save E2B key.");
    } finally {
      setBusy(false);
    }
  }

  async function testKey() {
    setBusy(true);
    try {
      const r = await fetch("/api/v1/sandbox/test-e2b", { method: "POST" });
      const data = (await r.json()) as { ok?: boolean; message?: string; sandbox?: SandboxConfig };
      if (data.sandbox) setConfig(data.sandbox);
      setStatus(data.message ?? (r.ok ? "Connection test passed." : "Connection test failed."));
    } catch {
      setStatus("Unable to test E2B connection.");
    } finally {
      setBusy(false);
    }
  }

  async function removeKey() {
    if (!confirm("Remove the saved E2B BYOK key?")) return;
    setBusy(true);
    try {
      const r = await fetch("/api/v1/sandbox/config", { method: "DELETE" });
      const data = (await r.json()) as { ok?: boolean; sandbox?: SandboxConfig; error?: string; message?: string };
      if (!r.ok || !data.ok) throw new Error(data.error ?? "Unable to remove E2B key.");
      setConfig(data.sandbox ?? emptySandboxConfig);
      setE2bInput("");
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
        copy="Configure where AgentWing routes sandbox-required actions. AgentWing decides when a sandbox is required; it does not replace sandbox providers."
      />

      {secretMissing && (
        <div className="flex items-start gap-3 rounded-md border border-amber-300/25 bg-amber-300/[0.06] px-4 py-3">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-300" />
          <p className="text-sm text-amber-100">
            Sandbox encryption secret is not configured. Ask admin to set <code className="font-mono text-amber-200">AGENTWING_SANDBOX_SECRET</code> in Cloudflare Worker secrets. E2B keys cannot be saved until this is set.
          </p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <article className={cardClass()}>
          <p className="text-xs font-medium text-slate-400">Connected sandbox providers</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{loading ? "—" : connected ? 1 : 0}</p>
          <p className="mt-2 text-xs text-slate-500">
            {connected ? "sandbox_required actions can route to E2B." : "sandbox_required actions must not execute locally."}
          </p>
        </article>
        <article className={cardClass()}>
          <p className="text-xs font-medium text-slate-400">Provider</p>
          <p className="mt-3 text-sm font-semibold text-white">E2B BYOK</p>
          <p className="mt-2 text-xs text-slate-500">Customer-owned E2B credentials stored server-side.</p>
        </article>
        <article className={cardClass()}>
          <p className="text-xs font-medium text-slate-400">Coming soon</p>
          <p className="mt-3 text-sm font-semibold text-white">Daytona, Cloudflare Sandbox, Custom HTTP</p>
          <p className="mt-2 text-xs text-slate-500">Additional providers follow the same safe key model.</p>
        </article>
      </div>

      <section className={cardClass()}>
        <p className="text-sm font-semibold text-white">Sandbox fallback behavior</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded border border-white/[0.06] bg-[#05070d] p-3">
            <p className="text-xs font-semibold text-cyan-100">BYOK E2B connected</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">sandbox_required actions can be routed to the connected E2B sandbox.</p>
          </div>
          <div className="rounded border border-white/[0.06] bg-[#05070d] p-3">
            <p className="text-xs font-semibold text-cyan-100">Agent-owned sandbox</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">Use the AgentWing decision to route action to your existing sandbox.</p>
          </div>
          <div className="rounded border border-white/[0.06] bg-[#05070d] p-3">
            <p className="text-xs font-semibold text-cyan-100">No sandbox connected</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">Do not execute sandbox_required actions locally. Connect E2B BYOK or use your own sandbox.</p>
          </div>
        </div>
      </section>

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

        {connected && !loading && (
          <div className="mt-5 grid gap-x-6 gap-y-4 md:grid-cols-2">
            <ProviderDetail label="Provider" value="E2B BYOK" />
            <ProviderDetail label="Key" value={maskedSandboxKey(config)} mono />
            <ProviderDetail label="Runtime execution" value={config.runtimeExecutionEnabled ? "Enabled" : "Disabled"} />
            <ProviderDetail label="Created" value={formatDate(config.createdAt)} />
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

        {showSetup && !secretMissing && (
          <div className={connected ? "mt-5 border-t border-white/[0.08] pt-5" : "mt-5"}>
            <label htmlFor="e2b-key" className="text-sm font-semibold text-white">
              {isReplacing ? "Replace E2B API key" : "E2B API key"}
            </label>
            <p className="mt-1 text-sm text-slate-400">
              Paste your E2B API key. It is stored encrypted server-side and never returned to the browser.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                id="e2b-key"
                type="password"
                value={e2bInput}
                onChange={(e) => setE2bInput(e.target.value)}
                placeholder="e2b_..."
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
                Test
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
              Test connection
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

        {status && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-white/[0.08] bg-[#05070d] px-3 py-2 text-sm text-slate-300">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-cyan-200" />
            <p>{busy ? "Working..." : status}</p>
          </div>
        )}
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

// ─── Receipts Panel ───────────────────────────────────────────────────────────

export function ReceiptsPanel() {
  const [receipts, setReceipts] = useState<ActionReceipt[]>([]);
  const [stats, setStats] = useState<ReceiptStats>(defaultStats);

  useEffect(() => {
    fetch("/api/v1/receipts")
      .then((r) => r.json())
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
        copy="Audit trail for every check made through /api/v1/check-action."
      />
      <StatsGrid stats={stats} />
      <ReceiptsTable receipts={receipts} />
    </div>
  );
}

// ─── Projects Panel ───────────────────────────────────────────────────────────

export function ProjectsPanel() {
  const [projects, setProjects] = useState<AgentWingProject[]>([]);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch("/api/v1/projects")
      .then((r) => r.json())
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
    setProjects((cur) => [data.project!, ...cur]);
    setName("");
    setStatus(`Created ${data.project.name}.`);
  }

  return (
    <div className="space-y-5">
      <PageHeading title="Projects" copy="Projects scope API keys, policies, receipts, and usage to a named context." />
      <section className={cardClass()}>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createNewProject()}
            placeholder="my-production-agent"
            className="min-h-11 flex-1 rounded-md border border-white/[0.1] bg-[#05070d] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/35"
          />
          <button
            type="button"
            onClick={createNewProject}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-cyan-300/25 bg-cyan-300 px-4 py-2 text-sm font-semibold text-[#031018] transition hover:bg-cyan-200"
          >
            <Plus className="size-4" />
            Create project
          </button>
        </div>
        {status && <p className="mt-3 text-sm text-slate-400">{status}</p>}
      </section>
      {projects.length === 0 ? (
        <div className="rounded-md border border-white/[0.08] bg-[#080b12] px-5 py-8 text-center">
          <p className="text-sm font-semibold text-white">No projects yet</p>
          <p className="mt-2 text-sm text-slate-400">Create your first project to generate API keys and track usage.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {projects.map((project) => (
            <article key={project.projectId} className={cardClass()}>
              <p className="text-sm font-semibold text-white">{project.name}</p>
              <p className="mt-2 font-mono text-xs text-cyan-100">{project.projectId}</p>
              <p className="mt-2 text-xs text-slate-400">
                Created {new Date(project.createdAt).toLocaleString()}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Usage Panel ──────────────────────────────────────────────────────────────

export function UsagePanel({ stats, usage = defaultUsage }: { stats: ReceiptStats; usage?: ApiKeyUsage }) {
  const actionCheckPercent = Math.min(100, Math.round((usage.actionChecksUsed / (usage.actionCheckLimit || 1)) * 100));
  const sandboxPercent = Math.min(100, Math.round((usage.sandboxRunsUsed / (usage.sandboxRunLimit || 1)) * 100));

  return (
    <div className="space-y-5">
      <PageHeading title="Usage" copy="Workspace-level usage counters scoped to your projects and API keys." />
      <StatsGrid stats={stats} />
      {(usage.actionChecksUsed > 0 || usage.sandboxRunsUsed > 0 || usage.receiptsCreated > 0) ? (
        <section className={cardClass()}>
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
            <div>
              <p className="text-sm font-semibold text-white">{usage.planName} plan</p>
              <p className="mt-1 text-xs text-slate-400">Workspace-level aggregate</p>
            </div>
            <span className="rounded border border-cyan-300/20 bg-cyan-300/[0.08] px-2 py-1 text-xs font-semibold text-cyan-100">
              Beta
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
              <p className="mt-2 text-xs text-slate-500">Audit receipts from all checks.</p>
            </div>
          </div>
        </section>
      ) : (
        <div className="rounded-md border border-white/[0.08] bg-[#080b12] px-5 py-8 text-center">
          <p className="text-sm font-semibold text-white">No usage yet</p>
          <p className="mt-2 text-sm text-slate-400">
            Generate an API key and call <code className="font-mono text-cyan-100">/api/v1/check-action</code> to start tracking usage.
          </p>
        </div>
      )}
    </div>
  );
}

function UsageMeter({ label, value, limit, percent }: { label: string; value: number; limit: number; percent: number }) {
  return (
    <div className="rounded-md border border-white/[0.08] bg-[#05070d] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-slate-400">{label}</p>
        <p className="font-mono text-xs text-slate-400">{value} / {limit}</p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full bg-cyan-300 transition-all" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-500">{percent}% used</p>
    </div>
  );
}

// ─── Stats Grid ───────────────────────────────────────────────────────────────

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

// ─── Receipts Table ───────────────────────────────────────────────────────────

export function ReceiptsTable({ receipts }: { receipts: ActionReceipt[] }) {
  const rows = useMemo(() => receipts.slice(0, 20), [receipts]);

  return (
    <section className="overflow-hidden rounded-md border border-white/[0.08] bg-[#080b12]">
      <div className="grid grid-cols-[0.9fr_0.7fr_0.8fr_1.4fr_1fr] border-b border-white/[0.08] bg-[#0c1019] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
        <span>Decision</span>
        <span>Risk</span>
        <span>Type</span>
        <span>Feedback</span>
        <span>Time</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-sm text-slate-400">No receipts yet. Call POST /api/v1/check-action with your API key.</p>
      ) : (
        rows.map((receipt) => (
          <Link
            key={receipt.receiptId}
            href={`/dashboard/receipts/${receipt.receiptId}`}
            className="grid grid-cols-[0.9fr_0.7fr_0.8fr_1.4fr_1fr] gap-3 border-b border-white/[0.06] px-4 py-3 text-sm last:border-b-0 transition hover:bg-white/[0.02]"
          >
            <span className={`w-fit rounded border px-2 py-1 text-[11px] font-semibold ${decisionClass[receipt.decision] ?? ""}`}>
              {receipt.decision}
            </span>
            <span className={`text-xs font-semibold ${riskClass[receipt.risk] ?? "text-slate-300"}`}>{receipt.risk}</span>
            <span className="font-mono text-xs text-cyan-100">{receipt.actionType}</span>
            <span className="min-w-0 truncate text-xs text-slate-300">{receipt.feedback}</span>
            <span className="text-xs text-slate-500">{new Date(receipt.createdAt).toLocaleString()}</span>
          </Link>
        ))
      )}
    </section>
  );
}

// ─── Page Heading ─────────────────────────────────────────────────────────────

export function PageHeading({ title, copy }: { title: string; copy: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">AgentWing</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">{title}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{copy}</p>
    </div>
  );
}
