import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter, PublicNav } from "@/components/PublicLayout";

export const metadata: Metadata = {
  title: "About GPMai Labs | AgentWing",
  description: "Meet the founder of GPMai Labs, the company behind AgentWing.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <h1 className="text-4xl font-semibold tracking-tight">About GPMai Labs</h1>
        <p className="mt-4 leading-7 text-secondary">
          GPMai Labs builds AgentWing, an open-source runtime control layer for AI agents.
          Software teams use it to check agent tool calls against policies, require human
          approval for sensitive actions, and record decisions for later review.
        </p>

        <section aria-labelledby="leadership" className="mt-10">
          <h2 id="leadership" className="text-2xl font-semibold tracking-tight">
            Founding team and leadership
          </h2>
          <div className="mt-4 rounded-md border border-divider bg-surface p-5">
            <h3 className="text-lg font-semibold">Ziyad E J</h3>
            <p className="mt-1 text-sm text-secondary">Founder &amp; CEO</p>
            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <li>
                <a href="https://github.com/12ziyad" className="text-brand underline underline-offset-4">
                  GitHub profile
                </a>
              </li>
              <li>
                <a href="mailto:founder@gpmai.dev" className="text-brand underline underline-offset-4">
                  founder@gpmai.dev
                </a>
              </li>
            </ul>
          </div>
        </section>

        <section aria-labelledby="agentwing" className="mt-10">
          <h2 id="agentwing" className="text-2xl font-semibold tracking-tight">AgentWing</h2>
          <p className="mt-3 leading-7 text-secondary">
            Try a policy check in the public playground or see how to integrate AgentWing
            with your agent in the documentation.
          </p>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <li><Link href="/playground" className="text-brand underline underline-offset-4">Try the playground</Link></li>
            <li><Link href="/docs" className="text-brand underline underline-offset-4">Read the documentation</Link></li>
            <li><a href="https://gpmai.dev" className="text-brand underline underline-offset-4">GPMai website</a></li>
          </ul>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
