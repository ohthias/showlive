"use client";

import { useMemo } from "react";
import type { LiveSnapshot } from "@/lib/live-types";
import { computeRanking } from "@/lib/ranking";
import { formatValue } from "@/lib/format";

/** Classificação compacta para a mesa (quando a organização permite). */
export function MesaRanking({ snapshot: s }: { snapshot: LiveSnapshot }) {
  const rows = useMemo(() => computeRanking(s.teams, s.rounds, s.scores, s.settings), [s]);
  return (
    <ol className="mt-2 divide-y divide-base-300 rounded-tl-2xl rounded-br-2xl border border-base-300 bg-base-100">
      {rows.map((r) => (
        <li key={r.team.id} className="flex items-center gap-3 px-4 py-2">
          <span className={`grid size-7 place-items-center rounded-tl-md rounded-br-md font-mono text-xs font-bold ${r.rank === 1 && r.evaluated ? "bg-accent text-accent-content" : "bg-base-200"}`}>
            {r.rank}
          </span>
          <span className="flex-1 truncate text-sm font-medium">{r.team.name}</span>
          <span className="font-mono font-bold tabular-nums">{r.evaluated ? formatValue(r.score, s.event.scoring) : "—"}</span>
        </li>
      ))}
    </ol>
  );
}
