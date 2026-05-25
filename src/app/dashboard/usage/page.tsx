"use client";

/* eslint-disable react-hooks/exhaustive-deps */

import { useEffect, useMemo, useState } from "react";

type UsageShape = {
  apiKey?: string;
  keyPrefix?: string;
  planName?: string;
  actionChecksUsed?: number;
  actionCheckLimit?: number;
  sandboxRunsUsed?: number;
  sandboxRunLimit?: number;
  receiptsCreated?: number;
  [key: string]: unknown;
};

function toNumber(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function Card(props: { title: string; used?: number; limit?: number; subtitle?: string }) {
  const used = props.used ?? 0;
  const limit = props.limit ?? 0;
  const remaining = Math.max(limit - used, 0);
  const percent = limit > 0 ? Math.min(Math.round((used / limit) * 100), 100) : 0;

  return (
    <div style={{
      border: "1px solid rgba(255,255,255,0.1)",
      background: "rgba(255,255,255,0.045)",
      borderRadius: 24,
      padding: 24,
      boxShadow: "0 24px 80px rgba(0,0,0,0.35)"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
        <div>
          <p style={{ color: "#999", margin: "0 0 8px", fontSize: 13 }}>{props.title}</p>
          <h2 style={{ margin: 0, fontSize: 32, letterSpacing: "-0.04em" }}>
            {used.toLocaleString()} / {limit.toLocaleString()}
          </h2>
        </div>
        <div style={{
          minWidth: 92,
          height: 92,
          borderRadius: 999,
          display: "grid",
          placeItems: "center",
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.04)",
          fontWeight: 700
        }}>
          {percent}%
        </div>
      </div>

      <div style={{
        height: 10,
        borderRadius: 999,
        background: "rgba(255,255,255,0.08)",
        overflow: "hidden",
        marginTop: 22
      }}>
        <div style={{
          width: `${percent}%`,
          height: "100%",
          borderRadius: 999,
          background: "linear-gradient(90deg, #ffffff, #888888)"
        }} />
      </div>

      <p style={{ color: "#aaa", margin: "14px 0 0", fontSize: 14 }}>
        {props.subtitle ?? `${remaining.toLocaleString()} remaining`}
      </p>
    </div>
  );
}

export default function UsagePage() {
  const [apiKey, setApiKey] = useState("aw_live_demo_key");
  const [usage, setUsage] = useState<UsageShape | null>(null);
  const [raw, setRaw] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const normalized = useMemo(() => {
    const source = usage ?? {};
    return {
      planName: String(source.planName ?? "Beta"),
      actionChecksUsed: toNumber(source.actionChecksUsed),
      actionCheckLimit: toNumber(source.actionCheckLimit, 1000),
      sandboxRunsUsed: toNumber(source.sandboxRunsUsed),
      sandboxRunLimit: toNumber(source.sandboxRunLimit, 20),
      receiptsCreated: toNumber(source.receiptsCreated),
      keyPrefix: String(source.keyPrefix ?? source.apiKey ?? "demo")
    };
  }, [usage]);

  async function loadUsage(key = apiKey) {
    setLoading(true);
    setErr("");

    try {
      const response = await fetch("/api/v1/usage", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        cache: "no-store"
      });

      const json = await response.json().catch(() => ({}));
      setRaw(json);

      if (!response.ok) {
        throw new Error(
          typeof json?.error === "string"
            ? json.error
            : typeof json?.message === "string"
              ? json.message
              : `Usage request failed with HTTP ${response.status}`
        );
      }

      const data = (json?.usage ?? json?.data ?? json) as UsageShape;
      setUsage(data);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("agentwing_usage_api_key", key);
      }
    } catch (error) {
      setUsage(null);
      setErr(error instanceof Error ? error.message : "Unknown usage error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const saved = typeof window !== "undefined"
      ? window.localStorage.getItem("agentwing_usage_api_key")
      : null;

    const firstKey = saved || "aw_live_demo_key";
    setApiKey(firstKey);
    loadUsage(firstKey);
  }, []);

  return (
    <main style={{
      minHeight: "100vh",
      background: "radial-gradient(circle at top, #1f1f1f 0%, #070707 48%, #000 100%)",
      color: "#fff",
      fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      padding: 32
    }}>
      <section style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 24,
          flexWrap: "wrap",
          marginBottom: 28
        }}>
          <div>
            <p style={{
              display: "inline-flex",
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.05)",
              color: "#bbb",
              margin: "0 0 14px"
            }}>
              AgentWing Dashboard
            </p>
            <h1 style={{ fontSize: 46, lineHeight: 1, letterSpacing: "-0.06em", margin: 0 }}>
              Usage & Balance
            </h1>
            <p style={{ color: "#aaa", maxWidth: 720, lineHeight: 1.7, marginTop: 16 }}>
              Track how many action checks, sandbox runs, and receipts this API key has used.
              This is the billing foundation for AgentWing V1.
            </p>
          </div>

          <a href="/dashboard" style={{
            color: "#fff",
            textDecoration: "none",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 14,
            padding: "12px 14px",
            background: "rgba(255,255,255,0.05)"
          }}>
            Back to dashboard
          </a>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: 16,
          marginBottom: 24,
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.04)",
          borderRadius: 24,
          padding: 20
        }}>
          <label style={{ color: "#aaa", fontSize: 14 }}>
            API key for usage lookup
          </label>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <input
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="aw_live_..."
              style={{
                flex: "1 1 420px",
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(0,0,0,0.35)",
                color: "#fff",
                borderRadius: 14,
                padding: "14px 16px",
                outline: "none"
              }}
            />
            <button
              onClick={() => loadUsage()}
              disabled={loading || !apiKey.trim()}
              style={{
                border: "1px solid rgba(255,255,255,0.14)",
                background: loading ? "rgba(255,255,255,0.1)" : "#fff",
                color: loading ? "#aaa" : "#000",
                borderRadius: 14,
                padding: "14px 18px",
                fontWeight: 800,
                cursor: loading ? "not-allowed" : "pointer"
              }}
            >
              {loading ? "Loading..." : "Refresh usage"}
            </button>
          </div>

          {err ? (
            <div style={{
              border: "1px solid rgba(255,80,80,0.35)",
              background: "rgba(255,80,80,0.08)",
              color: "#ffb4b4",
              borderRadius: 16,
              padding: 14
            }}>
              {err}
            </div>
          ) : null}
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 18
        }}>
          <Card
            title="Action checks"
            used={normalized.actionChecksUsed}
            limit={normalized.actionCheckLimit}
          />
          <Card
            title="Sandbox runs"
            used={normalized.sandboxRunsUsed}
            limit={normalized.sandboxRunLimit}
          />
          <Card
            title="Receipts created"
            used={normalized.receiptsCreated}
            limit={Math.max(normalized.receiptsCreated, 1)}
            subtitle={`${normalized.receiptsCreated.toLocaleString()} audit receipts saved`}
          />
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 18,
          marginTop: 18
        }}>
          <div style={{
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.04)",
            borderRadius: 24,
            padding: 24
          }}>
            <p style={{ color: "#999", margin: "0 0 8px", fontSize: 13 }}>Current plan</p>
            <h2 style={{ margin: 0, fontSize: 28 }}>{normalized.planName}</h2>
            <p style={{ color: "#aaa", lineHeight: 1.6 }}>
              V1 beta plan with action-check and sandbox-run limits.
            </p>
          </div>

          <div style={{
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.04)",
            borderRadius: 24,
            padding: 24
          }}>
            <p style={{ color: "#999", margin: "0 0 8px", fontSize: 13 }}>Key scope</p>
            <h2 style={{ margin: 0, fontSize: 22, wordBreak: "break-word" }}>{normalized.keyPrefix}</h2>
            <p style={{ color: "#aaa", lineHeight: 1.6 }}>
              Usage is read through the API key you enter above.
            </p>
          </div>
        </div>

        <details style={{
          marginTop: 18,
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.035)",
          borderRadius: 20,
          padding: 18
        }}>
          <summary style={{ cursor: "pointer", color: "#ddd", fontWeight: 700 }}>
            Raw API response
          </summary>
          <pre style={{
            overflowX: "auto",
            color: "#bbb",
            fontSize: 13,
            lineHeight: 1.6,
            marginTop: 16
          }}>
            {JSON.stringify(raw, null, 2)}
          </pre>
        </details>
      </section>
    </main>
  );
}

