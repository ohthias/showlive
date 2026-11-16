import type { TimerState } from "./live-types";

export type TimerStatus = "idle" | "running" | "paused" | "finished";

/** Restante em ms, dado o relógio "agora" (já corrigido pelo offset do servidor). */
export function timerRemaining(t: TimerState, now: number): number {
  const full = t.durationSec * 1000;
  if (t.startedAt !== null) {
    const base = t.remainingMs ?? full;
    return Math.max(0, base - (now - t.startedAt));
  }
  return t.remainingMs ?? full;
}

export function timerStatus(t: TimerState, now: number): TimerStatus {
  if (t.startedAt !== null) return timerRemaining(t, now) <= 0 ? "finished" : "running";
  if (t.remainingMs !== null) return t.remainingMs <= 0 ? "finished" : "paused";
  return "idle";
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
