"use client";

import Link from "next/link";
import { useState } from "react";

const CONFIRMATION_TEXT = "DELETE MY ACCOUNT";

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded border border-white/[0.1] px-2 py-0.5 text-[10px] text-slate-500 transition hover:text-white"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function DangerZoneControls({ deletionRequestedAt }: { deletionRequestedAt?: string }) {
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(
    deletionRequestedAt
      ? `Account deletion requested on ${new Date(deletionRequestedAt).toLocaleString()}.`
      : "",
  );
  const [requested, setRequested] = useState(Boolean(deletionRequestedAt));
  const confirmed = confirmation === CONFIRMATION_TEXT;

  async function requestDeletion() {
    if (!confirmed || busy || requested) return;
    setBusy(true);
    setStatus("");

    try {
      const response = await fetch("/api/v1/account/delete-request", { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to record deletion request.");
      }

      setRequested(true);
      setStatus(`${data.message ?? "Your account deletion request has been recorded."} Signing you out...`);
      window.setTimeout(() => {
        void fetch("/api/auth/signout", { method: "POST" }).finally(() => {
          window.location.href = "/";
        });
      }, 1200);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to record deletion request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <DangerLink
          href="/dashboard/api-keys"
          label="Revoke individual API keys"
          description="Use the API Keys page to revoke active keys safely."
        />
        <DangerLink
          href="/dashboard/sandboxes"
          label="Remove sandbox credentials"
          description="Use the Sandboxes page to remove encrypted BYOK credentials."
        />
        <DangerLink
          href="mailto:founder@gpmai.dev?subject=Workspace deletion request"
          label="Request workspace deletion"
          description="During beta, workspace deletion is completed after team review."
          external
        />
        <DangerLink
          href="mailto:founder@gpmai.dev?subject=Data export request"
          label="Request data export"
          description="Email the AgentWing team to request an export."
          external
        />
      </div>

      <div className="rounded-md border border-red-300/20 bg-red-400/[0.04] p-4">
        <p className="text-sm font-semibold text-red-100">Request account deletion</p>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Deleting your account may permanently remove your workspace, projects, API keys, policies, receipts,
          sandbox credentials, usage data, and events. This action may not be reversible.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          During beta, deletion is completed by the AgentWing team after request review.
        </p>

        <label htmlFor="delete-confirmation" className="mt-4 block text-xs font-medium text-slate-400">
          Type DELETE MY ACCOUNT to confirm
        </label>
        <input
          id="delete-confirmation"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          disabled={busy || requested}
          className="mt-2 min-h-10 w-full rounded-md border border-red-300/20 bg-[#05070d] px-3 font-mono text-sm text-slate-100 outline-none focus:border-red-300/40 disabled:opacity-60"
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!confirmed || busy || requested}
            onClick={requestDeletion}
            className="rounded-md border border-red-300/30 bg-red-400/[0.12] px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-400/[0.18] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {requested ? "Deletion requested" : busy ? "Requesting..." : "Request account deletion"}
          </button>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-md border border-white/[0.1] px-4 py-2 text-sm font-semibold text-slate-300 transition hover:text-white"
            >
              Sign out
            </button>
          </form>
        </div>

        {status && <p className="mt-3 text-sm text-slate-300">{status}</p>}
      </div>
    </div>
  );
}

function DangerLink({
  href,
  label,
  description,
  external,
}: {
  href: string;
  label: string;
  description: string;
  external?: boolean;
}) {
  const className = "block rounded border border-red-300/20 px-4 py-3 transition hover:border-red-300/40 hover:bg-red-400/[0.04]";

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        <p className="text-xs font-semibold text-red-200">{label}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">{description}</p>
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      <p className="text-xs font-semibold text-red-200">{label}</p>
      <p className="mt-0.5 text-[11px] text-slate-500">{description}</p>
    </Link>
  );
}
