"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Download, Pencil, RotateCcw, Save } from "lucide-react";
import { adminSetScore, approveScores, deleteScore, getScoreDetail, rejectScore } from "@/app/actions/scores";
import { cornerBtn, Panel } from "@/components/ui/brand";
import { useConfirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import { useLiveEvent } from "@/hooks/useLiveEvent";
import type { LiveRound, LiveSnapshot, LiveTeam } from "@/lib/live-types";
import type { Mission } from "@/lib/missions";
import type { Challenge } from "@/lib/challenge";
import { bestLabel, formatClockTime, formatValue } from "@/lib/format";
import { HAZARDS, type ObrResponses } from "@/lib/obr";
import { computeRanking, scoreIndex } from "@/lib/ranking";
import { computeMissionBreakdown, NON_SCORING_MISSIONS } from "@/lib/scoring";

type Detail = Awaited<ReturnType<typeof getScoreDetail>>;
const fmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });

export function ScoresMatrix({ initial, missions, challenge }: { initial: LiveSnapshot; missions: Mission[]; challenge: Challenge | null }) {
  const { snapshot: s } = useLiveEvent(initial, "staff");
  const ranking = useMemo(() => computeRanking(s.teams, s.rounds, s.scores, s.settings), [s]);
  const idx = useMemo(() => scoreIndex(s.scores), [s.scores]);
  const rounds = useMemo(() => [...s.rounds].sort((a, b) => a.position - b.position), [s.rounds]);
  const [cell, setCell] = useState<{ team: LiveTeam; round: LiveRound } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const open = (team: LiveTeam, round: LiveRound) => {
    setCell({ team, round });
    requestAnimationFrame(() => dialog.current?.showModal());
  };

  const exportCsv = () => {
    const head = ["Posição", "Equipe", "Número", ...rounds.map((r) => r.name), s.settings.rankingMode === "sum" ? "Total" : "Melhor"];
    const lines = ranking.map((r) => [
      r.rank,
      r.team.name,
      r.team.number ?? "",
      ...rounds.map((rd) => idx.get(`${r.team.id}:${rd.id}`)?.points ?? ""),
      r.score,
    ]);
    const csv = [head, ...lines].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${s.event.name} - notas.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Panel
      kicker="/ SÚMULAS"
      title="Pontuações por rodada"
      action={
        <button type="button" onClick={exportCsv} className="btn btn-sm btn-ghost" disabled={!ranking.length}>
          <Download size={15} /> CSV
        </button>
      }
    >
      <p className="mb-4 text-sm text-base-content/60">
        Clique numa célula para ver a súmula, corrigir a nota ou apagá-la para a mesa avaliar de novo. Toda correção fica no histórico.
      </p>
      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr className="font-mono text-[10px] tracking-[0.12em]">
              <th className="w-10">#</th>
              <th>EQUIPE</th>
              {rounds.map((r) => (
                <th key={r.id} className={`text-center ${r.kind !== "qualifying" ? "text-primary" : ""}`}>
                  {r.name.toUpperCase()}
                  {r.arena && <span className="block text-[9px] opacity-60">{r.arena.toUpperCase()}</span>}
                </th>
              ))}
              <th className="text-right">{bestLabel(s.event.scoring, s.settings.rankingMode)}</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((row) => (
              <tr key={row.team.id} className="hover">
                <td className="font-mono font-bold">{row.rank}</td>
                <td className="max-w-56 truncate font-medium">{row.team.name}</td>
                {rounds.map((r) => {
                  const sc = idx.get(`${row.team.id}:${r.id}`);
                  return (
                    <td key={r.id} className="p-1 text-center">
                      <button
                        type="button"
                        onClick={() => open(row.team, r)}
                        title={sc ? `${sc.pending ? "PENDENTE · " : ""}${sc.by ?? ""}${sc.gp ? ` · GP ${sc.gp}` : ""}` : "Sem nota"}
                        className={`h-9 w-full min-w-16 rounded-tl-md rounded-br-md font-mono tabular-nums transition ${
                          sc?.pending
                            ? "border-2 border-dashed border-warning bg-warning/10 font-bold"
                            : sc
                              ? "bg-base-200 font-bold hover:bg-base-300"
                              : "border border-dashed border-base-300 text-base-content/30 hover:border-base-content/40"
                        }`}
                      >
                        {sc ? formatValue(sc.points ?? 0, r.extra?.scoring ?? s.event.scoring) : "—"}
                        {sc && typeof sc.tb === "number" && s.event.format === "obr" && (
                          <span className="ml-1 text-[10px] font-normal opacity-50">{formatClockTime(sc.tb)}</span>
                        )}
                      </button>
                    </td>
                  );
                })}
                <td className="text-right font-mono text-base font-black tabular-nums">{row.evaluated ? formatValue(row.score, s.event.scoring) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dialog ref={dialog} className="modal" onClose={() => setCell(null)}>
        {cell && (
          <CellEditor
            key={`${cell.team.id}:${cell.round.id}:${idx.get(`${cell.team.id}:${cell.round.id}`)?.at ?? 0}`}
            eventId={s.event.id}
            team={cell.team}
            round={cell.round}
            current={idx.get(`${cell.team.id}:${cell.round.id}`)?.points ?? null}
            isPending={!!idx.get(`${cell.team.id}:${cell.round.id}`)?.pending}
            missions={missions}
            challenge={challenge}
            unit={s.event.scoring.unit}
            onClose={() => dialog.current?.close()}
          />
        )}
        <form method="dialog" className="modal-backdrop">
          <button>fechar</button>
        </form>
      </dialog>
    </Panel>
  );
}

function CellEditor({
  eventId,
  team,
  round,
  current,
  isPending,
  missions,
  challenge,
  unit,
  onClose,
}: {
  eventId: string;
  team: LiveTeam;
  round: LiveRound;
  current: number | null;
  isPending: boolean;
  missions: Mission[];
  challenge: Challenge | null;
  unit: string;
  onClose: () => void;
}) {
  const [value, setValue] = useState(current === null ? "" : String(current));
  const [detail, setDetail] = useState<Detail | null>(null);
  const [pending, start] = useTransition();
  const { addToast } = useToast();
  const confirm = useConfirm();

  const loadDetail = () =>
    start(async () => {
      setDetail(await getScoreDetail(eventId, team.id, round.id));
    });

  const save = () =>
    start(async () => {
      const r = await adminSetScore(eventId, team.id, round.id, Number(value));
      if (!r.ok) return addToast(r.error, "error");
      addToast("Nota salva.", "success");
      onClose();
    });

  const remove = async () => {
    const ok = await confirm({
      title: "Apagar esta nota?",
      message: `${team.name} volta a aparecer como pendente no ${round.name} e a mesa poderá avaliar de novo.`,
      confirmLabel: "Apagar nota",
      danger: true,
    });
    if (ok === false) return;
    start(async () => {
      const r = await deleteScore(eventId, team.id, round.id);
      if (!r.ok) return addToast(r.error, "error");
      onClose();
    });
  };

  const resp = detail?.ok ? (detail.data.responses as Record<string, unknown>) : {};
  const obr = resp && Array.isArray((resp as { sections?: unknown }).sections) ? (resp as unknown as ObrResponses) : null;
  const answered: { id: string; name: string; value: string }[] = !detail?.ok
    ? []
    : obr
      ? [
          ...HAZARDS.filter((h) => obr.hazards[h.key]).map((h) => ({ id: "P", name: h.label, value: `${obr.hazards[h.key]}×` })),
          ...obr.sections.map((a, i) => ({ id: `C${i + 1}`, name: `Checkpoint ${i + 1}`, value: a ? (a === 4 ? "4ª+" : `${a}ª`) : "não" })),
          { id: "→", name: `Chegada (${obr.falhas} falhas)`, value: obr.chegada ? "sim" : "não" },
          { id: "V", name: "Vivas / mortas / trocadas", value: `${obr.vivas} / ${obr.mortas} / ${obr.invertidas}` },
          ...(obr.surpresa ? [{ id: "★", name: "Desafio Surpresa", value: "×1,5" }] : []),
          { id: "⏱", name: obr.desistiu ? "Desistiu" : "Tempo", value: obr.tempo === null ? "—" : formatClockTime(obr.tempo) },
        ]
      : challenge
      ? [
          ...challenge.items
            .filter((i) => resp[i.id] !== undefined)
            .map((i) => ({ id: String(challenge.items.indexOf(i) + 1), name: i.label, value: String(resp[i.id]) })),
          ...challenge.penalties
            .filter((p) => resp[`pen:${p.id}`])
            .map((p) => ({ id: "−", name: p.label, value: `${resp[`pen:${p.id}`]}×` })),
          ...(resp.dnf ? [{ id: "!", name: "Não completou", value: "tempo limite" }] : []),
        ]
      : missions
          .filter((m) => resp[m.id])
          .map((m) => ({
            id: m.id,
            name: m.name,
            value: NON_SCORING_MISSIONS.has(m.id) ? "—" : String(computeMissionBreakdown(m, resp[m.id] as Record<number, number>).total),
          }));

  return (
    <div className="modal-box max-w-lg rounded-tl-3xl rounded-br-3xl rounded-tr-none rounded-bl-none border-2 border-base-content p-0 shadow-[8px_8px_0_0_var(--color-secondary)]">
      <div className="border-b border-base-300 px-6 py-4">
        <p className="kicker">/ {round.name.toUpperCase()}</p>
        <h3 className="text-lg font-bold">{team.name}</h3>
      </div>
      <div className="space-y-5 p-6">
        {isPending && (
          <div className="flex flex-wrap items-center gap-2 rounded-tl-xl rounded-br-xl border-2 border-dashed border-warning bg-warning/10 p-3">
            <p className="flex-1 text-sm font-medium">Aguardando aprovação — ainda não aparece no telão.</p>
            <button
              type="button"
              className="btn btn-sm btn-success"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await approveScores(eventId, [{ teamId: team.id, roundId: round.id }]);
                  if (!r.ok) return addToast(r.error, "error");
                  addToast("Nota aprovada.", "success");
                  onClose();
                })
              }
            >
              Aprovar
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost text-error"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await rejectScore(eventId, team.id, round.id);
                  if (!r.ok) return addToast(r.error, "error");
                  onClose();
                })
              }
            >
              Rejeitar
            </button>
          </div>
        )}
        <label className="block">
          <span className="text-sm font-medium">{current === null ? "Lançar nota manualmente" : "Corrigir nota"} ({unit})</span>
          <div className="mt-1 flex gap-2">
            <input
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="input input-bordered w-36 font-mono text-lg font-bold"
            />
            <button type="button" onClick={save} disabled={pending || value === "" || Number(value) === current} className={`btn btn-primary ${cornerBtn}`}>
              {current === null ? <Pencil size={15} /> : <Save size={15} />} Salvar
            </button>
          </div>
          <span className="mt-1 block text-xs text-base-content/55">
            Use para revisão de súmula. Para refazer a partida, prefira apagar a nota e reavaliar na mesa.
          </span>
        </label>

        {current !== null && (
          <div className="rounded-tl-xl rounded-br-xl border border-base-300">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm font-medium">Súmula enviada</span>
              {!detail && (
                <button type="button" className="btn btn-ghost btn-xs" onClick={loadDetail} disabled={pending}>
                  Ver missões
                </button>
              )}
            </div>
            {detail?.ok && (
              <div className="border-t border-base-300 px-4 py-3 text-sm">
                <p className="text-xs text-base-content/55">
                  {detail.data.by} · {fmt.format(new Date(detail.data.at))}
                  {detail.data.extras.gp && <> · GP: {detail.data.extras.gp.label}</>}
                </p>
                {answered.length ? (
                  <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                    {answered.map((a, k) => (
                      <li key={k} className="flex justify-between gap-3">
                        <span className="truncate">
                          <b className="font-mono">{a.id}</b> {a.name}
                        </span>
                        <span className="font-mono tabular-nums">{a.value}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-base-content/60">Nota lançada manualmente (sem súmula).</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex justify-between gap-2 border-t border-base-300 bg-base-200/60 px-6 py-4">
        {current !== null ? (
          <button type="button" className="btn btn-ghost text-error" onClick={remove} disabled={pending}>
            <RotateCcw size={15} /> Apagar nota
          </button>
        ) : (
          <span />
        )}
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  );
}
