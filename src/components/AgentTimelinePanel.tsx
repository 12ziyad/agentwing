"use client";

import { useEffect, useRef } from "react";
import type { TimelineEvent } from "@/lib/types";
import { ShieldCheck } from "lucide-react";
import { TimelineEventCard } from "./TimelineEventCard";

export function AgentTimelinePanel({
  events,
  isRunning,
}: {
  events: TimelineEvent[];
  isRunning: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isRunning && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length, isRunning]);

  return (
    <div className="flex flex-col h-full bg-[#0c0f1b] overflow-hidden">
      {/* Header */}
      <div className="flex-none flex items-center justify-between px-3 h-9 border-b border-white/[0.07]">
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={12} className="text-indigo-400" />
          <span className="text-xs font-semibold text-slate-300">AgentWing Timeline</span>
        </div>
        <span className="hidden text-[9px] text-slate-600 sm:block">Every tool call is checked</span>
      </div>

      {/* Events */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-2.5 py-2.5 space-y-1.5"
      >
        {events.length === 0 ? (
          <div className="mt-2 rounded-lg border border-dashed border-white/[0.07] px-3 py-4 text-center text-[10.5px] text-slate-600 leading-[1.7]">
            Policy decisions will appear here as the agent reads files, writes code, runs commands, and handles blocked actions.
          </div>
        ) : (
          events.map((event) => (
            <TimelineEventCard key={event.id} event={event} />
          ))
        )}
      </div>
    </div>
  );
}
