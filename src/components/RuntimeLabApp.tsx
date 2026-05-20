"use client";

import { useEffect, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { RuntimeLabIntro } from "@/components/RuntimeLabIntro";
import { RuntimeLimitReached } from "@/components/RuntimeLimitReached";
import { Stage } from "@/components/Stage";
import { useDemoStream } from "@/hooks/useDemoStream";
import { demoReducer, initialState } from "@/lib/demoReducer";

type View = "lab-intro" | "workbench" | "limit-reached";

const MAX_RUNTIME_RUNS = 3;
const RUNS_USED_KEY = "agentwing_runtime_runs_used";
const FIRST_SEEN_KEY = "agentwing_runtime_first_seen";
const LAST_RUN_KEY = "agentwing_runtime_last_run";

function readRunsUsed() {
  if (typeof window === "undefined") return 0;
  const value = Number.parseInt(window.localStorage.getItem(RUNS_USED_KEY) ?? "0", 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function ensureFirstSeen() {
  if (typeof window === "undefined") return;
  if (!window.localStorage.getItem(FIRST_SEEN_KEY)) {
    window.localStorage.setItem(FIRST_SEEN_KEY, new Date().toISOString());
  }
}

export function RuntimeLabApp() {
  const router = useRouter();
  const [state, dispatch] = useReducer(demoReducer, initialState);
  const [view, setView] = useState<View>("lab-intro");
  const [runsLeft, setRunsLeft] = useState(MAX_RUNTIME_RUNS);
  const { startDemo, mode, connectionLost } = useDemoStream(dispatch);

  useEffect(() => {
    ensureFirstSeen();
    setRunsLeft(Math.max(0, MAX_RUNTIME_RUNS - readRunsUsed()));
  }, []);

  function handleStartRuntimeTest() {
    ensureFirstSeen();
    const used = readRunsUsed();
    if (used >= MAX_RUNTIME_RUNS) {
      setRunsLeft(0);
      setView("limit-reached");
      return;
    }

    const nextUsed = used + 1;
    window.localStorage.setItem(RUNS_USED_KEY, String(nextUsed));
    window.localStorage.setItem(LAST_RUN_KEY, new Date().toISOString());
    setRunsLeft(Math.max(0, MAX_RUNTIME_RUNS - nextUsed));

    if (state.screen !== "stage") {
      dispatch({ type: "start" });
      startDemo();
    }
    setView("workbench");
  }

  function handleBackToLanding() {
    router.push("/");
  }

  return (
    <div className="min-h-full bg-[#05070d]">
      {view === "lab-intro" && (
        <RuntimeLabIntro
          onStart={handleStartRuntimeTest}
          onLimitReached={() => setView("limit-reached")}
          onBack={handleBackToLanding}
          mode={mode}
          runsLeft={runsLeft}
        />
      )}
      {view === "limit-reached" && <RuntimeLimitReached onBack={handleBackToLanding} />}
      {view === "workbench" && (
        <Stage
          state={state}
          dispatch={dispatch}
          connectionLost={connectionLost}
          onBackToLanding={handleBackToLanding}
        />
      )}
    </div>
  );
}
