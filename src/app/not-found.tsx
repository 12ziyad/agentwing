import Link from "next/link";

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#050505",
        color: "#ffffff",
        fontFamily: "Inter, system-ui, sans-serif",
        padding: 24,
      }}
    >
      <section
        style={{
          maxWidth: 560,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 24,
          padding: 32,
          background: "rgba(255,255,255,0.04)",
        }}
      >
        <p style={{ color: "#888", marginBottom: 8 }}>AgentWing</p>
        <h1 style={{ fontSize: 32, margin: 0 }}>Page not found</h1>
        <p style={{ color: "#aaa", lineHeight: 1.6 }}>
          This route does not exist or is not available in this build.
        </p>
        <Link href="/" style={{ color: "#fff", textDecoration: "underline" }}>
          Go back home
        </Link>
      </section>
    </main>
  );
}
