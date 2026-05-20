"use client";

import { useState } from "react";

const PRESETS = [
  { cmd: "don't deploy", response: "Runtime constraint added: block deploy until tests pass" },
  { cmd: "do not deploy", response: "Runtime constraint added: block deploy until tests pass" },
  { cmd: "block deploy", response: "Runtime constraint added: block deploy until tests pass" },
  { cmd: "pause", response: "Runtime constraint added: pause after current transaction" },
  { cmd: "rollback", response: "Runtime constraint added: prefer rollback before any new write" },
];

export function GuideInput({ onMessage }: { onMessage: (msg: string) => void }) {
  const [value, setValue] = useState("");

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    const preset = PRESETS.find((p) => trimmed.toLowerCase().includes(p.cmd));
    onMessage(preset ? preset.response : `Runtime constraint added: ${trimmed}`);
    setValue("");
  }

  return (
    <div>
      <label htmlFor="agentwing-guide" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
        Guide AgentWing
      </label>
      <div className="flex gap-2">
        <input
          id="agentwing-guide"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Add runtime constraint... e.g. Block deploy until tests pass"
          className="h-9 min-w-0 flex-1 rounded border border-slate-500/60 bg-[#10141d] px-2.5 text-[11px] text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60"
        />
        <button
          onClick={handleSubmit}
          className="h-9 shrink-0 rounded border border-slate-400/40 bg-white/[0.04] px-3 text-[11px] font-semibold text-slate-100 transition hover:border-cyan-300/50 hover:text-cyan-100 active:scale-95"
        >
          Send
        </button>
      </div>
    </div>
  );
}
