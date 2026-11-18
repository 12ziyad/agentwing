import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter, PublicNav } from "@/components/PublicLayout";

export const metadata: Metadata = {
  title: "Pricing — AgentWing",
  description: "AgentWing is free during the public beta. Planned Pro and Team plans add higher monthly limits, longer receipt history and team controls.",
};

/**
 * Only the Beta column describes what exists today. Pro and Team are the
 * planned paid plans; nothing on this page takes payment, and the copy says
 * so. Edit prices and limits here.
 */
const PLANS = [
  {
    name: "Beta",
    price: "$0",
    cadence: "free during the beta",
    status: "Available now",
    blurb: "Everything in the hosted service, with beta limits.",
    features: [
      "1,000 action checks per API key",
      "20 sandbox runs per API key (your own E2B)",
      "Default safety policies + custom policies",
      "Approval gates — the agent cannot approve itself",
      "Restore-point gating for sensitive changes",
      "Tamper-evident receipt chain",
      "Webhooks, MCP server, hook and SDK",
    ],
    cta: { label: "Start free", href: "/api/auth/signin/google?next=/dashboard" },
    highlight: true,
  },
  {
    name: "Pro",
    price: "$29",
    cadence: "per month, planned",
    status: "After beta",
    blurb: "For one developer running agents every day.",
    features: [
      "50,000 action checks per month",
      "1,000 sandbox runs per month",
      "Limits shared across all your projects",
      "90-day receipt and run history",
      "Email support",
    ],
    cta: null,
    highlight: false,
  },
  {
    name: "Team",
    price: "$99",
    cadence: "per month, planned",
    status: "After beta",
    blurb: "For teams whose agents touch shared code and production.",
    features: [
      "250,000 action checks per month",
      "5,000 sandbox runs per month",
      "Seats with owner, admin, approver and viewer roles",
      "Approve from Slack or email",
      "1-year receipt history and export",
      "Priority support",
    ],
    cta: null,
    highlight: false,
  },
] as const;

const FAQ = [
  ["Is it really free right now?", "Yes. The hosted service is free during the public beta. There is no card on file and nothing to cancel."],
  [
    "What happens to my account when paid plans launch?",
    "Nothing changes without you choosing it. You will never be charged unless you pick a paid plan yourself, and beta users hear about pricing by email first.",
  ],
  [
    "What counts as an action check?",
    "One call to check-action or execute-action — one proposed action, one decision, one receipt. Reads the engine allows count the same as blocks.",
  ],
  ["Who pays for sandbox compute?", "You do, directly. Sandboxes run in your own E2B account (bring your own key). AgentWing decides when one is needed and records the result."],
  ["Can I self-host?", "Yes. AgentWing is open source under Apache 2.0. The SDK, hook and receipt verifier are in the same repository."],
] as const;

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />
      <main className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brand">Pricing</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl text-balance">
            Free while we&apos;re in beta.
          </h1>
          <p className="mt-4 text-sm leading-6 text-muted sm:text-base sm:leading-7">
            Use the full hosted service today at no cost. Paid plans with higher limits come after the beta — they are
            shown here so you know where it&apos;s going.
          </p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`flex flex-col rounded-xl border p-6 ${
                plan.highlight
                  ? "border-brand-outline bg-linear-to-b from-brand/10 to-surface"
                  : "border-divider bg-surface"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-lg font-semibold text-foreground">{plan.name}</p>
                <span
                  className={`rounded-full px-2.5 py-0.5 font-mono text-[10.5px] ${
                    plan.highlight
                      ? "bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/25"
                      : "bg-white/[0.04] text-muted ring-1 ring-white/[0.1]"
                  }`}
                >
                  {plan.status}
                </span>
              </div>
              <p className="mt-4 flex items-baseline gap-2">
                <span className="text-4xl font-bold tracking-tight text-foreground">{plan.price}</span>
                <span className="text-sm text-subdued">{plan.cadence}</span>
              </p>
              <p className="mt-3 text-sm leading-6 text-muted">{plan.blurb}</p>
              <ul className="mt-6 flex-1 space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2.5 text-[13px] leading-5 text-secondary">
                    <svg viewBox="0 0 16 16" className={`mt-0.5 size-4 shrink-0 ${plan.highlight ? "text-brand" : "text-subdued"}`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                      <path d="M3.5 8.5l3 3 6-7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              {plan.cta ? (
                <a
                  href={plan.cta.href}
                  className="mt-8 rounded-md bg-brand px-4 py-2.5 text-center text-sm font-semibold text-black transition hover:bg-brand"
                >
                  {plan.cta.label}
                </a>
              ) : (
                <p className="mt-8 rounded-md border border-dashed border-outline px-4 py-2.5 text-center text-sm text-subdued">
                  Not on sale yet
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-divider bg-surface p-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div>
            <p className="font-semibold text-foreground">Enterprise and self-hosting</p>
            <p className="mt-1 text-sm text-muted">
              Run AgentWing in your own infrastructure, custom limits, or a security review. Tell us what you need.
            </p>
          </div>
          <Link
            href="/contact"
            className="mt-4 inline-block shrink-0 rounded-md border border-outline px-4 py-2 text-sm font-semibold text-secondary transition hover:border-white/30 sm:mt-0"
          >
            Contact us
          </Link>
        </div>

        <section className="mx-auto mt-20 max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Questions</h2>
          <div className="mt-6 divide-y divide-white/[0.07] border-y border-divider">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                  {q}
                  <span className="font-mono text-subdued transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-6 text-muted">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
