"use client";

import { useEffect, useState } from "react";
import type { JudgingSessionStatus } from "@/lib/rubric-types";

export const SESSION_STATUS: Record<JudgingSessionStatus, { label: string; cls: string }> = {
  scheduled: { label: "Agendada", cls: "border-base-content/20 text-base-content/60" },
  in_progress: { label: "Em avaliação", cls: "border-warning/50 bg-warning/15 text-base-content" },
  done: { label: "Concluída", cls: "border-success/40 bg-success/10 text-success" },
  absent: { label: "Ausente", cls: "border-error/40 bg-error/10 text-error" },
};

export function SessionStatusPill({ status }: { status: JudgingSessionStatus }) {
  const s = SESSION_STATUS[status];
  return (
    <span className={`inline-flex shrink-0 items-center rounded-tl-md rounded-br-md border px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.12em] ${s.cls}`}>
      {s.label.toUpperCase()}
    </span>
  );
}

const timeFmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });

/**
 * Horário no fuso do aparelho. Renderiza depois da hidratação para não
 * divergir do servidor (que roda em UTC).
 */
export function LocalTime({ iso, withDay = false, fallback = "—" }: { iso: string | null; withDay?: boolean; fallback?: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!iso) return setText(null);
    const d = new Date(iso);
    setText(withDay ? `${dayFmt.format(d)} · ${timeFmt.format(d)}` : timeFmt.format(d));
  }, [iso, withDay]);
  if (!iso) return <>{fallback}</>;
  return <time dateTime={iso}>{text ?? "··:··"}</time>;
}

/** Converte ISO ↔ valor de <input type="datetime-local"> no fuso do aparelho. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function pct(n: number | null | undefined, digits = 1) {
  return typeof n === "number" ? `${n.toLocaleString("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: digits })}%` : "—";
}
