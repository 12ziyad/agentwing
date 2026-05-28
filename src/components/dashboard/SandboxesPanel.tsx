"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Play, RefreshCw, Save, Trash2 } from "lucide-react";
import type { SandboxProviderConfig } from "@/lib/agentwingTypes";

const emptySandboxConfig: SandboxProviderConfig = {
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
  return value ? new Date(value).toLocaleString() : "Never";
}

function maskedSandboxKey(config: SandboxProviderConfig) {
  const last4 = config.keyLast4 ?? config.e2bKeyLast4;
  if (!last4) return "Saved server-side";
  return `${config.keyPrefix ?? "e2b_"}${"\u2022".repeat(6)}${last4}`;
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

export function SandboxesPanel() {
  const [e2bInput, setE2bInput] = useState("");
  const [config, setConfig] = useState<SandboxProviderConfig>(emptySandboxConfig);
  const [status, setStatus] = useState("");
  const [technicalDetails, setTechnicalDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isReplacing, setIsReplacing] = useState(false);
  const [secretMissing, setSecretMissing] = useState(false);
  const [sandboxRunCount, setSandboxRunCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/v1/sandbox/config")
      .then((r) => r.json())
      .then((data: { sandbox?: SandboxProviderConfig; secretMissing?: boolean }) => {
        if (data.sandbox) setConfig(data.sandbox);
        if (data.secretMissing) setSecretMissing(true);
        setStatus("");
      })
      .catch(() => setStatus("Unable to load sandbox configuration."))
      .finally(() => setLoading(false));

    fetch("/api/v1/action-runs?limit=200")
      .then((r) => r.json())
      .then((data: { runs?: { executionTarget?: string }[] }) => {
        setSandboxRunCount((data.runs ?? []).filter((run) => run.executionTarget === "sandbox").length);
      })
      .catch(() => setSandboxRunCount(null));
  }, []);

  async function testKey(nextConfig?: SandboxProviderConfig) {
    setBusy(true);
    setTechnicalDetails("");
    try {
      const response = await fetch("/api/v1/sandbox/test-e2b", { method: "POST" });
      const data = (await response.json()) as { ok?: boolean; message?: string; sandbox?: SandboxProviderConfig };
      if (data.sandbox) setConfig(data.sandbox);
      if (data.ok) {
        setStatus("E2B connection succeeded. Sandbox-required actions can run in isolation.");
        return true;
      }
      setStatus("E2B connection failed. Replace the key or test again.");
      setTechnicalDetails(data.message ?? "Connection test failed.");
      if (nextConfig) setConfig(nextConfig);
      return false;
    } catch (error) {
      setStatus("E2B connection failed. Replace the key or test again.");
      setTechnicalDetails(error instanceof Error ? error.message : "Unable to test E2B connection.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveKey() {
    if (!e2bInput.trim()) {
      setStatus("Paste an E2B API key before saving.");
      return;
    }
    setBusy(true);
    setTechnicalDetails("");
    try {
      const response = await fetch("/api/v1/sandbox/save-e2b", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: e2bInput }),
      });
      const data = (await response.json()) as { ok?: boolean; sandbox?: SandboxProviderConfig; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Unable to save E2B key.");
      setE2bInput("");
      if (data.sandbox) setConfig(data.sandbox);
      setIsReplacing(false);
      setStatus("E2B key saved. Testing connection now.");
      await testKey(data.sandbox);
    } catch (error) {
      setStatus("Unable to save E2B key. Check the key format and try again.");
      setTechnicalDetails(error instanceof Error ? error.message : "Unable to save E2B key.");
      setBusy(false);
    }
  }

  async function removeKey() {
    if (!confirm("Disconnect E2B BYOK sandbox? Sandbox-required actions will wait until another runner is connected.")) return;
    setBusy(true);
    setTechnicalDetails("");
    try {
      const response = await fetch("/api/v1/sandbox/config", { method: "DELETE" });
      const data = (await response.json()) as { ok?: boolean; sandbox?: SandboxProviderConfig; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Unable to disconnect E2B key.");
      setConfig(data.sandbox ?? emptySandboxConfig);
      setE2bInput("");
      setIsReplacing(false);
      setStatus("E2B sandbox disconnected. Sandbox-required actions will wait for a sandbox runner.");
    } catch (error) {
      setStatus("Unable to disconnect E2B key.");
      setTechnicalDetails(error instanceof Error ? error.message : "Unable to disconnect E2B key.");
    } finally {
      setBusy(false);
    }
  }

  const connected = config.connected || config.e2bKeySaved;
  const invalid = connected && config.lastTestStatus === "failed";
  const showSetup = !connected || isReplacing;
  const lastTestKind = config.lastTestStatus === "success" ? "success" : config.lastTestStatus === "failed" ? "failed" : "empty";
  const sandboxStatus = invalid ? "Invalid key" : connected ? "Connected" : "Not connected";
  const sandboxStatusKind = invalid ? "failed" : connected ? "connected" : "empty";

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">AgentWing</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Sandboxes</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Route risky agent actions to isolated execution environments before they touch your real workspace.
        </p>
      </div>

      {secretMissing && (
        <div className="flex items-start gap-3 rounded-md border border-amber-300/25 bg-amber-300/[0.06] px-4 py-3">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-300" />
          <p className="text-sm text-amber-100">
            Sandbox encryption secret is not configured. Ask an admin to set <code className="font-mono text-amber-200">AGENTWING_SANDBOX_SECRET</code>.
          </p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <StatusCard label="Sandbox status" value={loading ? "Loading" : sandboxStatus} kind={sandboxStatusKind} copy={connected ? "Risky actions can route to E2B." : "Connect E2B before sandbox-required actions continue."} />
        <StatusCard label="Provider" value="E2B BYOK" copy="Customer-owned credentials stored server-side." />
        <StatusCard label="Last test" value={config.lastTestStatus === "success" ? "Success" : config.lastTestStatus === "failed" ? "Failed" : "Never tested"} kind={lastTestKind} copy={formatDate(config.lastTestedAt)} />
        <StatusCard label="Risky actions routed" value={sandboxRunCount === null ? "-" : String(sandboxRunCount)} copy="Runs marked for sandbox execution." />
      </div>

      <section className={cardClass()}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">E2B BYOK Sandbox</p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              {connected
                ? "Your E2B sandbox is connected for sandbox_required action runs."
                : "Connect your E2B API key so sandbox_required actions can run in isolation."}
            </p>
          </div>
          {loading ? (
            <span className={statusPillClass("empty")}>Loading</span>
          ) : connected && !invalid ? (
            <span className={statusPillClass("connected")}>
              <CheckCircle2 className="size-3.5" />
              Connected
            </span>
          ) : invalid ? (
            <span className={statusPillClass("failed")}>Invalid key</span>
          ) : (
            <span className={statusPillClass("empty")}>Not connected</span>
          )}
        </div>

        {connected && !loading && (
          <div className="mt-5 grid gap-x-6 gap-y-4 border-t border-white/[0.08] pt-5 md:grid-cols-2">
            <ProviderDetail label="Key" value={maskedSandboxKey(config)} mono />
            <ProviderDetail label="Connected" value={formatDate(config.createdAt)} />
          </div>
        )}

        {invalid && (
          <div className="mt-5 rounded-md border border-amber-300/20 bg-amber-300/[0.05] p-4">
            <p className="text-sm font-semibold text-amber-100">E2B connection failed. Replace the key or test again.</p>
            {(technicalDetails || config.lastError) && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-semibold text-slate-300">Technical details</summary>
                <pre className="mt-2 max-h-40 overflow-auto rounded border border-white/[0.08] bg-[#05070d] p-3 text-xs leading-5 text-slate-400">
                  {(technicalDetails || config.lastError)?.slice(0, 2000)}
                </pre>
              </details>
            )}
          </div>
        )}

        {showSetup && !secretMissing && (
          <div className={connected ? "mt-5 border-t border-white/[0.08] pt-5" : "mt-5"}>
            <label htmlFor="e2b-key" className="text-sm font-semibold text-white">
              {isReplacing ? "Replace E2B API key" : "E2B API key"}
            </label>
            <p className="mt-1 text-sm text-slate-400">
              Your key is stored server-side and never shown again.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                id="e2b-key"
                type="password"
                value={e2bInput}
                onChange={(event) => setE2bInput(event.target.value)}
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
                Save & Test Connection
              </button>
            </div>
            <a href="https://e2b.dev" target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-xs font-semibold text-cyan-200 transition hover:text-cyan-100">
              Get E2B API key
            </a>
          </div>
        )}

        {connected && !showSetup && (
          <div className="mt-5 flex flex-wrap gap-3 border-t border-white/[0.08] pt-5">
            <button
              type="button"
              disabled={busy}
              onClick={() => void testKey()}
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
              Disconnect
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

      <div className="grid gap-3 md:grid-cols-3">
        <FutureProvider title="External Runner" />
        <FutureProvider title="Enterprise Runner" />
        <FutureProvider title="Webhook Runner" />
      </div>
    </div>
  );
}

function StatusCard({
  label,
  value,
  copy,
  kind = "empty",
}: {
  label: string;
  value: string;
  copy?: string;
  kind?: "connected" | "empty" | "success" | "failed";
}) {
  return (
    <article className={cardClass()}>
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <span className={`mt-3 ${statusPillClass(kind)}`}>{value}</span>
      {copy && <p className="mt-3 text-xs text-slate-500">{copy}</p>}
    </article>
  );
}

function FutureProvider({ title }: { title: string }) {
  return (
    <article className={cardClass()}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">Configure later for custom execution environments.</p>
        </div>
        <span className="rounded border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[10px] font-semibold text-slate-400">
          Coming soon
        </span>
      </div>
    </article>
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
