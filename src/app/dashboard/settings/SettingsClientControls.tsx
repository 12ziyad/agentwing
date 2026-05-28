"use client";

import { useState } from "react";

const CONFIRMATION_TEXT = "DELETE";

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
  const [confirmOpen, setConfirmOpen] = useState(false);
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
      setConfirmOpen(false);
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
    <>
      <div className="rounded-md border border-red-300/20 bg-red-400/[0.04] p-4">
        <p className="text-sm font-semibold text-red-100">Delete account</p>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
          Permanently delete your workspace, API keys, runs, receipts, and settings. This cannot be undone.
        </p>

        <button
          type="button"
          disabled={busy || requested}
          onClick={() => {
            setConfirmation("");
            setConfirmOpen(true);
          }}
          className="mt-4 rounded-md border border-red-300/30 bg-red-400/[0.12] px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-400/[0.18] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {requested ? "Deletion requested" : "Delete account"}
        </button>

        {status && <p className="mt-3 text-sm text-slate-300">{status}</p>}
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-md border border-red-300/25 bg-[#080b12] p-6 shadow-2xl">
            <p className="text-lg font-semibold text-red-100">Confirm account deletion</p>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              This records an irreversible deletion request for your account and workspace. Type DELETE to confirm.
            </p>

            <label htmlFor="delete-confirmation" className="mt-5 block text-xs font-medium text-slate-400">
              Type DELETE to confirm
            </label>
            <input
              id="delete-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              disabled={busy || requested}
              placeholder="DELETE"
              className="mt-2 min-h-11 w-full rounded-md border border-red-300/20 bg-[#05070d] px-3 font-mono text-sm text-slate-100 outline-none focus:border-red-300/40 disabled:opacity-60"
              autoFocus
            />

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmation("");
                }}
                className="rounded-md border border-white/[0.1] px-4 py-2 text-sm font-semibold text-slate-300 transition hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!confirmed || busy || requested}
                onClick={requestDeletion}
                className="rounded-md border border-red-300/30 bg-red-400/[0.14] px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-400/[0.2] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Deleting..." : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
