"use client";

/**
 * Dashboard segment boundary.
 *
 * The most likely cause here is D1 being unreachable, which the store now fails
 * loudly on rather than degrading to a stale in-memory view. That is the right
 * behaviour, so this needs to say so plainly instead of rendering an empty
 * dashboard that looks like a workspace with no data.
 */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-md border border-red-300/20 bg-surface p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-red-300/70">Dashboard unavailable</p>
      <h2 className="mt-2 text-lg font-semibold text-foreground">This view could not be loaded</h2>
      <p className="mt-2 max-w-prose text-sm leading-6 text-muted">
        AgentWing could not read from its database. Nothing has been lost, and no decisions were made from incomplete
        data — the control plane fails closed rather than guessing.
      </p>
      {error.digest ? <p className="mt-3 font-mono text-xs text-subdued">Reference: {error.digest}</p> : null}
      <button
        type="button"
        onClick={reset}
        className="mt-5 rounded border border-outline px-4 py-2 text-xs font-semibold text-secondary transition hover:text-foreground"
      >
        Retry
      </button>
    </div>
  );
}
