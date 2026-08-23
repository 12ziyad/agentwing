"use client";

/**
 * The last boundary. Renders its own <html> because the root layout has already
 * failed by the time this is reached.
 *
 * It deliberately touches nothing — no store, no session, no data fetch. A
 * boundary that can itself throw is not a boundary.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#05070d",
          color: "#e2e8f0",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
          padding: "1.5rem",
        }}
      >
        <main style={{ maxWidth: "32rem", textAlign: "center" }}>
          <p
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: "0.7rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#64748b",
              margin: "0 0 0.75rem",
            }}
          >
            AgentWing
          </p>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: "0 0 0.75rem" }}>Something went wrong</h1>
          <p style={{ fontSize: "0.9rem", lineHeight: 1.6, color: "#94a3b8", margin: "0 0 1.5rem" }}>
            The page could not be rendered. This has been recorded.
          </p>
          {error.digest ? (
            <p
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.75rem",
                color: "#64748b",
                margin: "0 0 1.5rem",
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              border: "1px solid rgba(255,255,255,0.14)",
              background: "transparent",
              color: "#e2e8f0",
              borderRadius: "0.25rem",
              padding: "0.55rem 1.1rem",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
