"use client";

import { useTransition } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { controlTimer } from "@/app/actions/settings";
import { useToast } from "@/components/ui/Toast";
import type { TimerState } from "@/lib/live-types";
import { useTimer } from "./TimerDisplay";

/** Controles do cronômetro compartilhado (mesa e hub). */
export function TimerControls({
  eventId,
  timer,
  clockOffset,
  size = "md",
}: {
  eventId: string;
  timer: TimerState;
  clockOffset: number;
  size?: "sm" | "md";
}) {
  const { status, label, remaining } = useTimer(timer, clockOffset);
  const { addToast } = useToast();
  const [pending, start] = useTransition();
  const act = (a: "start" | "pause" | "reset") =>
    start(async () => {
      const r = await controlTimer(eventId, a);
      if (!r.ok) addToast(r.error, "error");
    });

  const warn = status === "running" && remaining <= 30_000;
  const btn = size === "sm" ? "btn-sm btn-square" : "btn-square";

  return (
    <div className="flex items-center gap-2">
      <span
        className={`min-w-[4.5ch] text-right font-mono font-bold tabular-nums ${size === "sm" ? "text-xl" : "text-3xl"} ${
          warn ? "text-primary" : status === "paused" ? "text-base-content/50" : ""
        }`}
      >
        {label}
      </span>
      {status === "running" ? (
        <button type="button" className={`btn btn-neutral ${btn}`} onClick={() => act("pause")} disabled={pending} aria-label="Pausar">
          <Pause size={16} />
        </button>
      ) : (
        <button
          type="button"
          className={`btn btn-primary ${btn}`}
          onClick={() => act("start")}
          disabled={pending}
          aria-label={status === "paused" ? "Continuar" : "Iniciar"}
        >
          <Play size={16} />
        </button>
      )}
      <button type="button" className={`btn btn-ghost ${btn}`} onClick={() => act("reset")} disabled={pending || status === "idle"} aria-label="Zerar">
        <RotateCcw size={16} />
      </button>
    </div>
  );
}
