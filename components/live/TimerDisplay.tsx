"use client";

import { useServerClock } from "@/hooks/useLiveEvent";
import type { TimerState } from "@/lib/live-types";
import { formatClock, timerRemaining, timerStatus } from "@/lib/timer";

export function useTimer(timer: TimerState, clockOffset: number) {
  const now = useServerClock(clockOffset, 200);
  const remaining = timerRemaining(timer, now);
  const status = timerStatus(timer, now);
  return { remaining, status, label: status === "finished" ? "FIM" : formatClock(remaining) };
}

export function TimerDisplay({
  timer,
  clockOffset,
  className = "",
  warnAtSec = 30,
}: {
  timer: TimerState;
  clockOffset: number;
  className?: string;
  warnAtSec?: number;
}) {
  const { remaining, status, label } = useTimer(timer, clockOffset);
  const warn = status === "running" && remaining <= warnAtSec * 1000;
  return (
    <span
      className={`font-mono font-bold tabular-nums ${warn ? "text-[var(--tv-accent,var(--color-primary))]" : ""} ${
        status === "paused" ? "opacity-60" : ""
      } ${status === "finished" ? "animate-pulse" : ""} ${className}`}
      aria-live="off"
    >
      {label}
    </span>
  );
}
