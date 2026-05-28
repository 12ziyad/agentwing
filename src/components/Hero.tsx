"use client";

import Link from "next/link";
import { PublicFooter } from "@/components/PublicLayout";

const decisions = [
  { d: "allow",                  cls: "text-emerald-400" },
  { d: "block",                  cls: "text-red-400" },
  { d: "sandbox_required",       cls: "text-slate-300" },
  { d: "approval_required",      cls: "text-violet-400" },
  { d: "restore_point_required", cls: "text-slate-300" },
];

export function Hero({ isSignedIn }: { isSignedIn?: boolean }) {
  return (
    <div className="min-h-screen bg-[#080808] text-slate-100 flex flex-col">

      {/* ── Nav ── */}
      <header className="flex-none flex items-center justify-between px-6 py-5 sm:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/agentwing-icon.png" alt="" className="size-8 rounded-lg" />
          <span className="text-[17px] font-bold tracking-tight text-white">AgentWing</span>
        </Link>

        <div className="flex items-center gap-5">
          <span className="hidden text-sm text-slate-500 sm:block">
            Open source · Apache-2.0
          </span>
          {isSignedIn ? (
            <Link
              href="/dashboard"
              className="rounded-md border border-white/[0.12] px-4 py-1.5 text-sm font-medium text-slate-200 transition hover:border-white/25 hover:text-white"
            >
              Dashboard
            </Link>
          ) : (
            <a
              href="/api/auth/signin/google?next=/dashboard"
              className="rounded-md bg-white px-4 py-1.5 text-sm font-semibold text-black transition hover:bg-slate-200"
            >
              Sign in
            </a>
          )}
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="flex-1 flex flex-col items-start justify-center px-6 pb-10 pt-16 sm:px-10 lg:pt-24">
        <div className="w-full max-w-5xl">

          {/* Heading */}
          <h1 className="text-[clamp(2.6rem,6vw,5rem)] font-extrabold leading-[1.05] tracking-tight">
            <span className="text-white">Check every AI agent action</span>
            <br />
            <span className="text-cyan-400">before it runs.</span>
          </h1>

          <p className="mt-5 text-base text-slate-500 sm:text-lg">
            Runtime control layer for AI agents&nbsp;·&nbsp;
            <code className="font-mono text-slate-400">POST /api/v1/check-action</code>
          </p>

          {/* Terminal widget */}
          <div className="mt-10 w-full max-w-2xl rounded-2xl border border-white/[0.08] bg-[#111111] shadow-2xl shadow-black/60">
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
              <span className="size-3 rounded-full bg-[#ff5f57]" />
              <span className="size-3 rounded-full bg-[#febc2e]" />
              <span className="size-3 rounded-full bg-[#28c840]" />
              <span className="ml-3 text-xs text-slate-500 font-mono">POST /api/v1/check-action</span>
            </div>

            {/* Code body */}
            <div className="px-5 py-5 font-mono text-sm leading-7">
              <p>
                <span className="text-slate-400">{"<-"}</span>{" "}
                <span className="text-slate-300">{"{ "}</span>
                <span className="text-slate-400">{'"decision"'}</span>
                <span className="text-slate-300">{": "}</span>
                <span className="text-red-400">{'"block"'}</span>
                <span className="text-slate-300">{", "}</span>
                <span className="text-slate-400">{'"risk"'}</span>
                <span className="text-slate-300">{": "}</span>
                <span className="text-red-400">{'"high"'}</span>
                <span className="text-slate-300">{","}</span>
              </p>
              <p className="pl-5">
                <span className="text-slate-400">{'"policy"'}</span>
                <span className="text-slate-300">{": "}</span>
                <span className="text-amber-400">{'"block-secret-file-access"'}</span>
                <span className="text-slate-300">{", "}</span>
                <span className="text-slate-400">{'"receiptId"'}</span>
                <span className="text-slate-300">{": "}</span>
                <span className="text-emerald-400">{'"aw_receipt_..."'}</span>
                <span className="text-slate-300">{" }"}</span>
              </p>
            </div>
          </div>

          {/* Decision badges */}
          <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-mono">
            {decisions.map(({ d, cls }, i) => (
              <span key={d} className="flex items-center gap-3">
                <span className={cls}>{d}</span>
                {i < decisions.length - 1 && (
                  <span className="text-slate-700">·</span>
                )}
              </span>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-10 flex flex-wrap gap-3">
            {isSignedIn ? (
              <Link
                href="/dashboard"
                className="rounded-md bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-cyan-300"
              >
                Open dashboard
              </Link>
            ) : (
              <>
                <a
                  href="/api/auth/signin/google?next=/dashboard"
                  className="rounded-md bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-cyan-300"
                >
                  Get started free
                </a>
                <Link
                  href="/docs"
                  className="rounded-md border border-white/[0.1] px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:text-white"
                >
                  Docs
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
