"use client";

import { useEffect } from "react";

/** Mantém a tela ligada (telão no projetor, mesa no tablet). Ignora navegadores sem suporte. */
export function useWakeLock(enabled = true) {
  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    const request = async () => {
      try {
        lock = await (navigator as Navigator & { wakeLock: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock.request("screen");
      } catch {}
    };
    const onVisible = () => document.visibilityState === "visible" && void request();
    void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
    };
  }, [enabled]);
}
