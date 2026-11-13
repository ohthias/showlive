"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveSnapshot } from "@/lib/live-types";

export type LiveStatus = "live" | "connecting" | "offline";

/**
 * Assina o evento via SSE. Reconecta sozinho (com a última revisão, para não
 * receber de novo o que já tem) e, se o streaming estiver bloqueado na rede
 * do local do evento, cai para polling do snapshot a cada 3s (público e staff).
 */
export function useLiveEvent(
  initial: LiveSnapshot,
  audience: "public" | "staff" = initial.audience,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const [snapshot, setSnapshot] = useState(initial);
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [clockOffset, setClockOffset] = useState(initial.serverNow - Date.now());
  const revRef = useRef(initial.revision);
  const failuresRef = useRef(0);
  // Staff acompanha pelo id (funciona fora do ar); o público, pelo código.
  const code = audience === "staff" ? initial.event.id : (initial.event.code ?? initial.event.id);

  const apply = useCallback((next: LiveSnapshot) => {
    if (next.revision < revRef.current) return;
    revRef.current = next.revision;
    setClockOffset(next.serverNow - Date.now());
    setSnapshot(next);
  }, []);

  /** Busca o snapshot agora (após uma ação própria, ou no modo polling). */
  const fetchOnce = useCallback(async () => {
    try {
      const res = await fetch(`/api/live/${code}/snapshot?audience=${audience}`, { cache: "no-store" });
      if (!res.ok) return false;
      apply(await res.json());
      return true;
    } catch {
      return false;
    }
  }, [code, audience, apply]);

  useEffect(() => {
    if (!enabled) {
      setStatus("live");
      return;
    }
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let disposed = false;

    const startPolling = () => {
      if (poll) return;
      poll = setInterval(async () => {
        if (await fetchOnce()) setStatus("live");
        else setStatus("offline");
      }, 3000);
    };

    const connect = () => {
      if (disposed) return;
      setStatus((s) => (s === "live" ? s : "connecting"));
      es = new EventSource(`/api/live/${code}/stream?since=${revRef.current}&audience=${audience}`);

      es.onopen = () => {
        failuresRef.current = 0;
        setStatus("live");
      };
      es.addEventListener("snapshot", (e) => {
        try {
          apply(JSON.parse((e as MessageEvent).data));
        } catch {}
      });
      es.addEventListener("gone", () => {
        disposed = true;
        es?.close();
        setStatus("offline");
      });
      es.onerror = () => {
        es?.close();
        es = null;
        if (disposed) return;
        failuresRef.current++;
        // Fechamento normal a cada ~50s conta como falha "leve": reconecta já.
        if (failuresRef.current >= 4) {
          setStatus("offline");
          startPolling();
        }
        const wait = Math.min(15000, 300 * 2 ** Math.min(failuresRef.current, 6));
        retry = setTimeout(connect, wait);
      };
    };

    connect();

    const onVisible = () => {
      if (document.visibilityState === "visible" && !es && !disposed) {
        if (retry) clearTimeout(retry);
        connect();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      disposed = true;
      es?.close();
      if (retry) clearTimeout(retry);
      if (poll) clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [code, audience, apply, fetchOnce, enabled]);

  return { snapshot, status, clockOffset, refresh: fetchOnce };
}

/** Relógio que anda a cada `ms`, já corrigido pelo horário do servidor. */
export function useServerClock(offset: number, ms = 250) {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + offset), ms);
    return () => clearInterval(id);
  }, [offset, ms]);
  return now;
}
