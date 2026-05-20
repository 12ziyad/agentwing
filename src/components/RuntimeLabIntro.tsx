"use client";

import { useState } from "react";

type RuntimeLabIntroProps = {
  onStart: () => void;
  onLimitReached: () => void;
  onBack: () => void;
  mode: "live" | "replay";
  runsLeft: number;
};

export function RuntimeLabIntro({ onStart, onLimitReached, onBack, mode, runsLeft }: RuntimeLabIntroProps) {
  const [task, setTask] = useState("Add an extra box, run tests, and prepare staging deploy");
  const limitReached = runsLeft <= 0;

  return (
    <main className="min-h-screen bg-[#05070d] px-4 py-6 text-slate-100 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl flex-col rounded-2xl border border-white/[0.08] bg-[#080b12] shadow-2xl shadow-black/45">
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-white">AgentWing Runtime Lab</p>
            <p className="text-[11px] text-slate-300">Mini coding agent test environment</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10.5px] text-slate-300 sm:inline">
              {mode === "live" ? "Live stream" : "Replay mode"}
            </span>
            <button
              type="button"
              onClick={onBack}
              className="rounded border border-white/[0.1] bg-white/[0.035] px-3 py-1.5 text-[11px] font-medium text-slate-200 transition hover:border-cyan-400/25 hover:text-white"
            >
              Back to landing
            </button>
          </div>
        </header>

        <section className="grid flex-1 gap-8 p-5 sm:p-8 lg:grid-cols-[1fr_0.82fr] lg:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
              Runtime Lab
            </p>
            <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Test AgentWing on a mini coding agent.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
              The Mini Code Agent will edit the Box Arena demo app, run tests, and
              attempt risky actions. First you&apos;ll see the agent run without
              AgentWing. Then the same task runs with AgentWing controlling
              every action.
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Product note: this replay is ready to call the real /api/v1/check-action
              endpoint as the Runtime Lab graduates from scripted demo to live policy checks.
            </p>
            <div className={`mt-5 inline-flex rounded border px-3 py-1.5 text-sm font-medium ${
              limitReached
                ? "border-amber-400/25 bg-amber-400/[0.08] text-amber-100"
                : "border-cyan-400/25 bg-cyan-400/[0.07] text-cyan-100"
            }`}>
              Public test runs left: {runsLeft}
            </div>

            <div className="mt-8 rounded-xl border border-white/[0.09] bg-[#0c1019] p-4">
              <label htmlFor="runtime-lab-task" className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                Tell the Mini Code Agent what to change
              </label>
              <textarea
                id="runtime-lab-task"
                value={task}
                onChange={(event) => setTask(event.target.value)}
                rows={3}
                className="min-h-20 w-full resize-none rounded-md border border-white/[0.1] bg-[#05070d] px-3 py-2 font-mono text-sm leading-5 text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-400/35"
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={limitReached ? onLimitReached : onStart}
                className="rounded-md border border-cyan-300/30 bg-cyan-300 px-5 py-3 text-sm font-semibold text-[#031018] transition hover:bg-cyan-200 active:scale-[0.99]"
              >
                {limitReached ? "Request early access" : "Start Runtime Test"}
              </button>
              <button
                type="button"
                onClick={onBack}
                className="rounded-md border border-white/[0.12] bg-white/[0.04] px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/[0.2] hover:bg-white/[0.07]"
              >
                Back to landing
              </button>
            </div>
          </div>

          <BoxArenaIntroPreview />
        </section>
      </div>
    </main>
  );
}

function BoxArenaIntroPreview() {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0c1019] p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
            Box Arena
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-white">Current app state</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            This is the demo app the Mini Code Agent will edit.
          </p>
        </div>
        <span className="rounded border border-red-400/25 bg-red-400/10 px-2 py-1 text-[10px] font-semibold text-red-300">
          uncontrolled
        </span>
      </div>

      <div className="rounded-lg border border-white/[0.08] bg-[#05070d] p-4">
        <div className="grid grid-cols-8 gap-1.5">
          {Array.from({ length: 48 }).map((_, index) => (
            <div
              key={index}
              className={`aspect-square rounded-sm border border-white/[0.04] ${
                index === 18 ? "bg-cyan-300/75" : "bg-white/[0.035]"
              }`}
            />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
          <span className="rounded border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-slate-200">
            1 box
          </span>
          <span className="rounded border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-slate-200">
            basic score
          </span>
          <span className="rounded border border-red-400/20 bg-red-400/[0.06] px-2 py-1.5 text-red-200">
            uncontrolled
          </span>
        </div>
      </div>
    </div>
  );
}
