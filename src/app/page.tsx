import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LandingPage } from "@/components/landing/LandingPage";
import { getDashboardAuthFromCookieHeader } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AgentWing | Runtime control for AI agents",
  description: "Check AI agent tool calls before they run. Apply workspace policies, require human approval, route execution to a sandbox, and audit decisions with verifiable receipts.",
  metadataBase: new URL("https://agentwing.gpmai.dev"),
  alternates: { canonical: "/" },
};

export default async function Home() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join("; ");
  const auth = await getDashboardAuthFromCookieHeader(cookieHeader);
  return <LandingPage isSignedIn={Boolean(auth)} />;
}
