"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { Dispatch } from "react";
import type { DemoEvent } from "@/lib/demoTypes";
import { REPLAY_SEQUENCE } from "@/lib/demoEvents";
import { createRuntimeLabSessionId, enrichRuntimeLabTransaction } from "@/lib/runtimeLabApi";

const WS_URL = "ws://localhost:8080/demo-stream";
const WS_TIMEOUT_MS = 1200;

export function useDemoStream(dispatch: Dispatch<DemoEvent>) {
  const [mode, setMode] = useState<"live" | "replay">("replay");
  const [wsConnected, setWsConnected] = useState(false);
  const [connectionLost, setConnectionLost] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startedRef = useRef(false);
  const sessionIdRef = useRef(createRuntimeLabSessionId());

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    let ws: WebSocket;

    try {
      ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      timeoutId = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          setMode("replay");
          dispatch({ type: "mode", mode: "replay" });
        }
      }, WS_TIMEOUT_MS);

      ws.onopen = () => {
        clearTimeout(timeoutId);
        setWsConnected(true);
        setMode("live");
        dispatch({ type: "mode", mode: "live" });
      };

      ws.onmessage = (e: MessageEvent) => {
        try {
          const event = JSON.parse(e.data as string) as DemoEvent;
          if (event.type === "transaction") {
            void enrichRuntimeLabTransaction(event, sessionIdRef.current).then(dispatch);
            return;
          }
          dispatch(event);
        } catch {
          // ignore malformed messages
        }
      };

      ws.onerror = () => {
        clearTimeout(timeoutId);
        setMode("replay");
      };

      ws.onclose = (e) => {
        clearTimeout(timeoutId);
        if (wsConnected && e.code !== 1000) {
          setConnectionLost(true);
          setMode("replay");
        }
        setWsConnected(false);
      };
    } catch {
      setMode("replay");
    }

    return () => {
      clearTimeout(timeoutId);
      ws?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startDemo = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (wsConnected && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ command: "start" }));
      return;
    }

    // Local replay
    setMode("replay");
    dispatch({ type: "mode", mode: "replay" });

    for (const [at, event] of REPLAY_SEQUENCE) {
      const id = setTimeout(() => {
        if (event.type === "transaction") {
          void enrichRuntimeLabTransaction(event, sessionIdRef.current).then(dispatch);
          return;
        }
        dispatch(event);
      }, at);
      timersRef.current.push(id);
    }
  }, [wsConnected, dispatch]);

  const stopDemo = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    startedRef.current = false;
  }, []);

  return { startDemo, stopDemo, mode, wsConnected, connectionLost };
}
