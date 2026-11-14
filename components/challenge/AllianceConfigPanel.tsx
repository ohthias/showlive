"use client";

import { ArrowDown, ArrowUp, Plus, Swords, Trash2, Users } from "lucide-react";
import { Panel } from "@/components/ui/brand";
import { ALLIANCE_LIMITS, RANK_BY_LABELS, TIEBREAKER_LABELS, tiebreakerLabel } from "@/lib/alliance-config";
import type { AllianceConfig } from "@/lib/alliance-types";

/** Configuração das alianças dentro do construtor de desafios. */
export function AllianceConfigPanel({
  value,
  groups,
  onChange,
}: {
  value: AllianceConfig;
  groups: string[];
  onChange: (next: AllianceConfig) => void;
}) {
  const a = value;
  const set = (p: Partial<AllianceConfig>) => onChange({ ...a, ...p });
  const versus = a.mode === "versus";
  const tbOptions = [...(versus ? Object.keys(TIEBREAKER_LABELS) : ["avg", "high"]), ...groups.map((g) => `group:${g}`)].filter(
    (t) => !a.tiebreakers.includes(t),
  );
  const moveTb = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= a.tiebreakers.length) return;
    const list = [...a.tiebreakers];
    [list[i], list[j]] = [list[j], list[i]];
    set({ tiebreakers: list });
  };
  const numInput = (label: string, v: number, onV: (n: number) => void, opts: { min?: number; max?: number; step?: number } = {}) => (
    <label>
      <span className="text-xs font-medium">{label}</span>
      <input
        type="number"
        min={opts.min ?? 0}
        max={opts.max}
        step={opts.step ?? 1}
        value={v}
        onChange={(e) => onV(Number(e.target.value))}
        className="input input-bordered input-sm mt-1 w-full"
      />
    </label>
  );

  return (
    <Panel kicker="/ 1 · ALIANÇAS" title="Como as partidas funcionam" action={<Swords size={16} className="text-base-content/40" />}>
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["versus", "Vermelha × azul", "Duas alianças se enfrentam; vitória dá RP."],
            ["coop", "Cooperativo", "Uma aliança contra o placar; os pontos valem para todas as equipes dela."],
          ] as const
        ).map(([mode, label, hint]) => (
          <button
            key={mode}
            type="button"
            onClick={() =>
              set(
                mode === "coop"
                  ? { mode, rankBy: "score_avg", penaltiesTo: "self", bonusRp: [], tiebreakers: a.tiebreakers.filter((t) => t === "high" || t.startsWith("group:")) }
                  : { mode, rankBy: "rp_avg", penaltiesTo: "opponent" },
              )
            }
            className={`rounded-tl-2xl rounded-br-2xl border-2 p-4 text-left transition ${
              a.mode === mode ? "border-base-content bg-base-100 shadow-[4px_4px_0_0_var(--color-primary)]" : "border-base-300 hover:border-base-content/30"
            }`}
          >
            <span className="font-bold">{label}</span>
            <span className="mt-1 block text-xs text-base-content/60">{hint}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label>
          <span className="flex items-center gap-1 text-xs font-medium">
            <Users size={12} /> Equipes por aliança
          </span>
          <div className="join mt-1 w-full">
            {Array.from({ length: ALLIANCE_LIMITS.teams }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => set({ teamsPerAlliance: n })}
                className={`btn join-item btn-sm flex-1 ${a.teamsPerAlliance === n ? "btn-neutral" : "btn-outline border-base-300"}`}
              >
                {n}
              </button>
            ))}
          </div>
        </label>
        {numInput("Partidas por equipe (cronograma)", a.matchesPerTeam, (n) => set({ matchesPerTeam: n }), { min: 1, max: ALLIANCE_LIMITS.matchesPerTeam })}
        {numInput("Descartar as N piores partidas", a.dropLowest, (n) => set({ dropLowest: n }), { min: 0, max: ALLIANCE_LIMITS.dropLowest })}
      </div>

      {versus && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_1.4fr]">
            {numInput("RP por vitória", a.rp.win, (n) => set({ rp: { ...a.rp, win: n } }), { step: 0.5, max: 10 })}
            {numInput("RP por empate", a.rp.tie, (n) => set({ rp: { ...a.rp, tie: n } }), { step: 0.5, max: 10 })}
            {numInput("RP por derrota", a.rp.loss, (n) => set({ rp: { ...a.rp, loss: n } }), { step: 0.5, max: 10 })}
            <label>
              <span className="text-xs font-medium">Penalidades</span>
              <select
                value={a.penaltiesTo}
                onChange={(e) => set({ penaltiesTo: e.target.value as AllianceConfig["penaltiesTo"] })}
                className="select select-bordered select-sm mt-1 w-full"
              >
                <option value="opponent">Viram pontos do adversário</option>
                <option value="self">Descontam da própria aliança</option>
              </select>
            </label>
          </div>

          <div className="mt-4">
            <p className="text-xs font-medium">RP bônus (metas da partida)</p>
            <ul className="mt-1 space-y-2">
              {a.bonusRp.map((b, i) => (
                <li key={b.id} className="grid items-end gap-2 sm:grid-cols-[1fr_160px_100px_70px_auto]">
                  <input
                    value={b.label}
                    maxLength={60}
                    onChange={(e) => set({ bonusRp: a.bonusRp.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
                    className="input input-bordered input-sm w-full"
                    aria-label="Nome do RP bônus"
                  />
                  <select
                    value={b.group ?? ""}
                    onChange={(e) => set({ bonusRp: a.bonusRp.map((x, j) => (j === i ? { ...x, group: e.target.value || null } : x)) })}
                    className="select select-bordered select-sm w-full"
                    aria-label="Onde contar"
                  >
                    <option value="">Total da aliança</option>
                    {groups.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                  <label className="text-[11px]">
                    pontos ≥
                    <input
                      type="number"
                      min={0}
                      value={b.min}
                      onChange={(e) => set({ bonusRp: a.bonusRp.map((x, j) => (j === i ? { ...x, min: Number(e.target.value) } : x)) })}
                      className="input input-bordered input-sm w-full"
                    />
                  </label>
                  <label className="text-[11px]">
                    RP
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={b.rp}
                      onChange={(e) => set({ bonusRp: a.bonusRp.map((x, j) => (j === i ? { ...x, rp: Number(e.target.value) } : x)) })}
                      className="input input-bordered input-sm w-full"
                    />
                  </label>
                  <button type="button" className="btn btn-ghost btn-sm btn-square text-error" onClick={() => set({ bonusRp: a.bonusRp.filter((_, j) => j !== i) })} aria-label="Remover RP bônus">
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn btn-ghost btn-xs mt-1"
              disabled={a.bonusRp.length >= ALLIANCE_LIMITS.bonusRp}
              onClick={() => set({ bonusRp: [...a.bonusRp, { id: `b${Date.now().toString(36)}`, label: "RP bônus", group: groups[0] ?? null, min: 20, rp: 1 }] })}
            >
              <Plus size={12} /> RP bônus
            </button>
          </div>
        </>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label>
          <span className="text-xs font-medium">Classificação</span>
          <select
            value={a.rankBy}
            disabled={!versus}
            onChange={(e) => set({ rankBy: e.target.value as AllianceConfig["rankBy"] })}
            className="select select-bordered select-sm mt-1 w-full"
          >
            {(Object.keys(RANK_BY_LABELS) as AllianceConfig["rankBy"][]).map((k) => (
              <option key={k} value={k}>
                {RANK_BY_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <div>
          <p className="text-xs font-medium">Desempates (na ordem)</p>
          <ol className="mt-1 space-y-1">
            {a.tiebreakers.map((t, i) => (
              <li key={t} className="flex items-center gap-1 rounded-tl-md rounded-br-md bg-base-200/70 px-2 py-1 text-sm">
                <span className="w-5 font-mono text-xs text-base-content/50">{i + 1}.</span>
                <span className="flex-1">{tiebreakerLabel(t)}</span>
                <button type="button" className="btn btn-ghost btn-xs btn-square" onClick={() => moveTb(i, -1)} disabled={i === 0} aria-label="Subir">
                  <ArrowUp size={12} />
                </button>
                <button type="button" className="btn btn-ghost btn-xs btn-square" onClick={() => moveTb(i, 1)} disabled={i === a.tiebreakers.length - 1} aria-label="Descer">
                  <ArrowDown size={12} />
                </button>
                <button type="button" className="btn btn-ghost btn-xs btn-square" onClick={() => set({ tiebreakers: a.tiebreakers.filter((x) => x !== t) })} aria-label="Remover">
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ol>
          {tbOptions.length > 0 && a.tiebreakers.length < ALLIANCE_LIMITS.tiebreakers && (
            <select className="select select-bordered select-xs mt-1" value="" onChange={(e) => e.target.value && set({ tiebreakers: [...a.tiebreakers, e.target.value] })}>
              <option value="">+ desempate</option>
              {tbOptions.map((t) => (
                <option key={t} value={t}>
                  {tiebreakerLabel(t)}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      <p className="mt-3 text-xs text-base-content/55">
        Dê um <b>grupo</b> aos itens da súmula (Autônomo, Teleoperado, Fim de jogo…) para usá-los em desempates e RP bônus.
      </p>
    </Panel>
  );
}
