"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";

const TEAMS = ["Equipe Alfa", "Robôs do Sertão", "Mecatrônicos", "LEGOlândia", "Byte Bandeirante"];
const START = [312, 285, 270, 240, 198];

/** Telão de demonstração da landing: as notas "chegam" e a ordem muda. */
export function DemoBoard() {
  const [scores, setScores] = useState(START);
  const [flash, setFlash] = useState<number | null>(null);
  const [last, setLast] = useState<{ team: string; pts: number } | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      const i = Math.floor(Math.random() * TEAMS.length);
      const pts = 180 + Math.round(Math.random() * 22) * 10;
      setScores((prev) => prev.map((v, k) => (k === i ? Math.max(v, pts) : v)));
      setFlash(i);
      setLast({ team: TEAMS[i], pts });
    }, 2600);
    return () => clearInterval(id);
  }, []);

  const order = scores.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s);

  return (
    <div className="relative">
      <div aria-hidden className="absolute -right-4 -top-4 size-24 rotate-12 rounded-tl-2xl rounded-br-2xl bg-accent" />
      <div aria-hidden className="absolute -bottom-5 -left-5 size-20 rounded-full border-2 border-dashed border-secondary/50" />

      <div
        className="relative overflow-hidden rounded-tl-3xl rounded-br-3xl border border-base-300 bg-[#1f1c18] text-[#f3ecdc] shadow-[8px_8px_0_0_var(--color-secondary)]"
        style={{ ["--tv-accent" as string]: "#e04444" }}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <span className="inline-flex items-center gap-2 font-mono text-xs text-white/60">
            <span className="live-dot text-[#e04444]" />
            Telão · Regional Nordeste
          </span>
          <span className="rounded-sm border border-white/15 px-1.5 py-0.5 font-mono text-[10px] tracking-widest text-white/50">
            DEMONSTRAÇÃO
          </span>
        </div>

        <ol className="relative" style={{ height: TEAMS.length * 56 }}>
          {order.map(({ s, i }, pos) => (
            <li
              key={TEAMS[i]}
              className={`absolute inset-x-0 flex h-14 items-center gap-4 border-b border-white/5 px-5 transition-transform duration-700 ${
                flash === i ? "tv-flash" : ""
              }`}
              style={{ transform: `translateY(${pos * 56}px)` }}
            >
              <span
                className={`grid size-8 place-items-center rounded-tl-md rounded-br-md font-mono text-sm font-bold ${
                  pos === 0 ? "bg-[#fabd32] text-[#2f2108]" : "bg-white/10"
                }`}
              >
                {pos + 1}
              </span>
              <span className="flex-1 truncate font-semibold">{TEAMS[i]}</span>
              {pos === 0 && <Trophy size={16} className="text-[#fabd32]" />}
              <span key={s} className="score-pop font-mono text-lg font-bold tabular-nums">
                {s}
              </span>
            </li>
          ))}
        </ol>

        <div className="flex items-center gap-3 bg-[#e04444] px-5 py-2.5 font-mono text-[11px] text-white sm:text-xs">
          <span className="font-bold tracking-widest">ÚLTIMA NOTA</span>
          <span className="truncate opacity-90">{last ? `${last.team} · ${last.pts} pts` : "aguardando a mesa…"}</span>
        </div>
      </div>
    </div>
  );
}
