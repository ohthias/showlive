"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, ChevronDown, Download, Pencil, Plus, RotateCcw, Save, Swords, Trash2, Wand2, X } from "lucide-react";
import {
  addMatch,
  approveMatches,
  clearMatches,
  deleteMatch,
  editMatchResult,
  generateMatches,
  getMatchDetail,
  updateMatch,
  voidMatchResult,
} from "@/app/actions/matches";
import { CustomScoreForm } from "@/components/challenge/CustomScoreForm";
import { cornerBtn, EmptyState, Panel, Tag } from "@/components/ui/brand";
import { useConfirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import { useLiveEvent } from "@/hooks/useLiveEvent";
import { computeAllianceRanking, RANK_BY_LABELS, scoreMatch, tiebreakerLabel, type TeamMatchFlag } from "@/lib/alliance";
import type { Challenge, CustomResponses } from "@/lib/challenge";
import type { LiveMatch, LiveSnapshot, LiveTeam } from "@/lib/live-types";

const timeFmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const pad = (n: number) => String(n).padStart(2, "0");
const toLocal = (ms: number | null) => {
  if (!ms) return "";
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

/** Hub do formato de alianças: cronograma, resultados, aprovação e classificação. */
export function MatchesManager({ initial, challenge, isAdmin }: { initial: LiveSnapshot; challenge: Challenge; isAdmin: boolean }) {
  const { snapshot: s } = useLiveEvent(initial, "staff");
  const cfg = challenge.alliance!;
  const versus = cfg.mode === "versus";
  const teamOf = useMemo(() => new Map(s.teams.map((t) => [t.id, t])), [s.teams]);
  const ranking = useMemo(
    () => computeAllianceRanking(s.teams, s.matches.map((m) => ({ ...m, final: m.status === "final" })), cfg),
    [s.teams, s.matches, cfg],
  );
  const [showGen, setShowGen] = useState(s.matches.length === 0);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<"all" | "scheduled" | "pending" | "final">("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { addToast } = useToast();
  const confirm = useConfirm();

  const counts = {
    total: s.matches.length,
    final: s.matches.filter((m) => m.status === "final").length,
    pending: s.matches.filter((m) => m.status === "pending").length,
  };
  const visible = s.matches.filter((m) => filter === "all" || m.status === filter);
  const pendingList = s.matches.filter((m) => m.status === "pending");

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, success?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) addToast(r.error ?? "Erro", "error", 5000);
      else if (success) addToast(success, "success");
    });

  const exportCsv = () => {
    const esc = (v: unknown) => {
      const t = v === null || v === undefined ? "" : String(v);
      return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const name = (id: string) => teamOf.get(id)?.name ?? "";
    const head = ["Partida", "Horário", "Campo", ...(versus ? ["Vermelha", "Azul", "Placar vermelha", "Placar azul"] : ["Aliança", "Placar"]), "Status"];
    const lines = s.matches.map((m) => [
      `Q${m.number}`,
      m.at ? timeFmt.format(m.at) : "",
      m.field ?? "",
      m.red.map((x) => name(x.teamId)).join(" + "),
      ...(versus ? [m.blue.map((x) => name(x.teamId)).join(" + ")] : []),
      m.result?.red.score ?? "",
      ...(versus ? [m.result?.blue?.score ?? ""] : []),
      m.status === "final" ? "final" : m.status === "pending" ? "aguardando aprovação" : "sem resultado",
    ]);
    const csv = "﻿" + [head, ...lines].map((l) => l.map(esc).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    Object.assign(document.createElement("a"), { href: url, download: "partidas.csv" }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Partidas" value={counts.total} />
        <Stat label="Com resultado" value={counts.final} />
        <Stat label="Aguardando aprovação" value={counts.pending} />
      </div>

      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`btn btn-sm ${showGen ? "btn-neutral" : "btn-outline"}`} onClick={() => setShowGen((v) => !v)}>
            <Wand2 size={15} /> Gerar cronograma <ChevronDown size={14} className={showGen ? "rotate-180" : ""} />
          </button>
          <button type="button" className={`btn btn-sm ${showAdd ? "btn-neutral" : "btn-outline"}`} onClick={() => setShowAdd((v) => !v)}>
            <Plus size={15} /> Partida avulsa
          </button>
          <div className="flex-1" />
          {s.matches.some((m) => m.status === "scheduled") && (
            <button
              type="button"
              className="btn btn-sm btn-ghost text-error"
              disabled={pending}
              onClick={async () => {
                const ok = await confirm({ title: "Apagar as partidas sem resultado?", message: "Partidas que já têm resultado são mantidas.", confirmLabel: "Apagar", danger: true });
                if (ok !== false) act(() => clearMatches(s.event.id), "Partidas sem resultado apagadas.");
              }}
            >
              <Trash2 size={14} /> Limpar sem resultado
            </button>
          )}
        </div>
      )}

      {isAdmin && showGen && (
        <GenerateForm
          teams={s.teams.length}
          perAlliance={cfg.teamsPerAlliance}
          versus={versus}
          defaultPerTeam={cfg.matchesPerTeam}
          hasMatches={s.matches.length > 0}
          pending={pending}
          onSubmit={(input) =>
            start(async () => {
              const r = await generateMatches(s.event.id, input);
              if (!r.ok) return addToast(r.error, "error", 6000);
              addToast(`${r.data.created} partidas criadas.`, "success");
              setShowGen(false);
            })
          }
        />
      )}
      {isAdmin && showAdd && (
        <Panel kicker="/ AVULSA" title="Nova partida">
          <MatchTeamsForm
            teams={s.teams}
            perAlliance={cfg.teamsPerAlliance}
            versus={versus}
            pending={pending}
            onCancel={() => setShowAdd(false)}
            onSubmit={(input) =>
              start(async () => {
                const r = await addMatch(s.event.id, input);
                if (!r.ok) return addToast(r.error, "error", 5000);
                setShowAdd(false);
              })
            }
          />
        </Panel>
      )}

      {pendingList.length > 0 && (
        <Panel
          kicker={`/ ${pendingList.length} AGUARDANDO`}
          title="Resultados para aprovar"
          action={
            <button type="button" className={`btn btn-sm btn-primary ${cornerBtn}`} disabled={pending} onClick={() => act(() => approveMatches(s.event.id, "all"), "Resultados aprovados.")}>
              <Check size={14} /> Aprovar todos
            </button>
          }
        >
          <ul className="divide-y divide-base-300">
            {pendingList.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-12 font-mono font-bold">Q{m.number}</span>
                <ScoreText m={m} versus={versus} />
                <span className="flex-1 text-xs text-base-content/55">{m.by}</span>
                <button type="button" className="btn btn-xs btn-outline" onClick={() => setEditing(m.id)}>
                  <Pencil size={12} /> Conferir
                </button>
                <button type="button" className="btn btn-xs btn-primary" disabled={pending} onClick={() => act(() => approveMatches(s.event.id, [m.id]))}>
                  <Check size={12} /> Aprovar
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid gap-6 2xl:grid-cols-[1.4fr_1fr]">
        <Panel
          kicker={`/ ${visible.length} PARTIDA(S)`}
          title="Cronograma e resultados"
          action={
            <div className="flex gap-2">
              <select className="select select-bordered select-sm" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Filtrar">
                <option value="all">Todas</option>
                <option value="scheduled">Sem resultado</option>
                <option value="pending">Aguardando aprovação</option>
                <option value="final">Com resultado</option>
              </select>
              <button type="button" className="btn btn-sm btn-outline" onClick={exportCsv} disabled={!s.matches.length}>
                <Download size={14} /> CSV
              </button>
            </div>
          }
        >
          {visible.length === 0 ? (
            <EmptyState
              icon={<Swords size={22} />}
              title={s.matches.length ? "Nada com esse filtro" : "Nenhuma partida ainda"}
              text={s.matches.length ? undefined : s.teams.length ? "Use “Gerar cronograma” para distribuir as equipes nas alianças." : "Cadastre as equipes primeiro."}
            />
          ) : (
            <ul className="divide-y divide-base-300">
              {visible.map((m) =>
                editing === m.id ? (
                  <li key={m.id} className="py-3">
                    <ResultEditor
                      eventId={s.event.id}
                      match={m}
                      challenge={challenge}
                      teamOf={teamOf}
                      onClose={() => setEditing(null)}
                    />
                  </li>
                ) : (
                  <MatchRow
                    key={m.id}
                    eventId={s.event.id}
                    match={m}
                    versus={versus}
                    teams={s.teams}
                    teamOf={teamOf}
                    perAlliance={cfg.teamsPerAlliance}
                    isAdmin={isAdmin}
                    onEditResult={() => setEditing(m.id)}
                  />
                ),
              )}
            </ul>
          )}
        </Panel>

        <Panel kicker="/ CLASSIFICAÇÃO" title={RANK_BY_LABELS[cfg.rankBy]}>
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Equipe</th>
                  {versus && <th className="text-right">V-D-E</th>}
                  <th className="text-right">{cfg.rankBy === "score_avg" ? "Média" : cfg.rankBy === "rp_total" ? "RP" : "RS"}</th>
                  {cfg.tiebreakers.map((t) => (
                    <th key={t} className="text-right" title={tiebreakerLabel(t)}>
                      {tiebreakerLabel(t).replace("Média no ", "")}
                    </th>
                  ))}
                  <th className="text-right">J</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r) => (
                  <tr key={r.team.id} className={r.played ? "" : "text-base-content/45"}>
                    <td className="font-mono font-bold">{r.played ? r.rank : "—"}</td>
                    <td className="max-w-40 truncate">
                      {r.team.number && <span className="mr-1 font-mono text-xs text-base-content/50">{r.team.number}</span>}
                      {r.team.name}
                    </td>
                    {versus && (
                      <td className="text-right font-mono">
                        {r.wins}-{r.losses}-{r.ties}
                      </td>
                    )}
                    <td className="text-right font-mono font-bold">{r.score}</td>
                    {r.tb.map((v, i) => (
                      <td key={i} className="text-right font-mono text-xs">
                        {v}
                      </td>
                    ))}
                    <td className="text-right font-mono text-xs">{r.played}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {cfg.dropLowest > 0 && <p className="mt-2 text-xs text-base-content/55">Descartando as {cfg.dropLowest} pior(es) partida(s) de cada equipe.</p>}
        </Panel>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-tl-xl rounded-br-xl border border-base-300 bg-base-100 px-4 py-3">
      <p className="kicker">{label.toUpperCase()}</p>
      <p className="font-mono text-2xl font-black">{value}</p>
    </div>
  );
}

function ScoreText({ m, versus }: { m: LiveMatch; versus: boolean }) {
  if (!m.result) return <span className="font-mono text-base-content/40">—</span>;
  const r = m.result.red.score;
  const b = m.result.blue?.score ?? 0;
  if (!versus) return <span className="font-mono font-bold">{r}</span>;
  return (
    <span className="font-mono font-bold">
      <span className={r > b ? "text-error underline" : "text-error"}>{r}</span>
      <span className="mx-1 opacity-40">×</span>
      <span className={b > r ? "text-info underline" : "text-info"}>{b}</span>
    </span>
  );
}

function GenerateForm({
  teams,
  perAlliance,
  versus,
  defaultPerTeam,
  hasMatches,
  pending,
  onSubmit,
}: {
  teams: number;
  perAlliance: number;
  versus: boolean;
  defaultPerTeam: number;
  hasMatches: boolean;
  pending: boolean;
  onSubmit: (input: Parameters<typeof generateMatches>[1]) => void;
}) {
  const [perTeam, setPerTeam] = useState(defaultPerTeam);
  const [startAt, setStartAt] = useState("");
  const [cycle, setCycle] = useState(7);
  const [fields, setFields] = useState(1);
  const [replace, setReplace] = useState(false);
  const slots = perAlliance * (versus ? 2 : 1);
  const total = teams >= slots ? Math.ceil((teams * perTeam) / slots) : 0;
  const surrogates = total * slots - teams * perTeam;

  return (
    <Panel kicker="/ GERAR" title="Cronograma de classificatórias">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ matchesPerTeam: perTeam, startIso: fromLocal(startAt), cycleMin: cycle, fields, replace });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-4">
          <label>
            <span className="text-xs font-medium">Partidas por equipe</span>
            <input type="number" min={1} max={20} value={perTeam} onChange={(e) => setPerTeam(Number(e.target.value))} className="input input-bordered mt-1 w-full" />
          </label>
          <label>
            <span className="text-xs font-medium">Início (opcional)</span>
            <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="input input-bordered mt-1 w-full" />
          </label>
          <label>
            <span className="text-xs font-medium">Minutos entre partidas</span>
            <input type="number" min={1} max={60} value={cycle} onChange={(e) => setCycle(Number(e.target.value))} className="input input-bordered mt-1 w-full" />
          </label>
          <label>
            <span className="text-xs font-medium">Campos</span>
            <input type="number" min={1} max={8} value={fields} onChange={(e) => setFields(Number(e.target.value))} className="input input-bordered mt-1 w-full" />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {hasMatches && (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="checkbox checkbox-sm" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
              Substituir partidas sem resultado
            </label>
          )}
          <p className="flex-1 text-xs text-base-content/60">
            {teams < slots
              ? `Precisa de pelo menos ${slots} equipes (você tem ${teams}).`
              : `${teams} equipes → ${total} partidas${surrogates ? `, com ${surrogates} vaga(s) de surrogate (partida extra que não conta)` : ""}. O gerador evita repetir parceiros e partidas seguidas.`}
          </p>
          <button className={`btn btn-primary ${cornerBtn}`} disabled={pending || teams < slots}>
            {pending ? <span className="loading loading-spinner loading-sm" /> : <Wand2 size={16} />} Gerar
          </button>
        </div>
      </form>
    </Panel>
  );
}

function MatchTeamsForm({
  teams,
  perAlliance,
  versus,
  pending,
  initial,
  onSubmit,
  onCancel,
}: {
  teams: LiveTeam[];
  perAlliance: number;
  versus: boolean;
  pending: boolean;
  initial?: LiveMatch;
  onSubmit: (input: Parameters<typeof addMatch>[1]) => void;
  onCancel: () => void;
}) {
  const fill = (slots: LiveMatch["red"] | undefined) => Array.from({ length: perAlliance }, (_, i) => slots?.[i]?.teamId ?? "");
  const [red, setRed] = useState(fill(initial?.red));
  const [blue, setBlue] = useState(fill(initial?.blue));
  const [surrogates, setSurrogates] = useState<string[]>([...(initial?.red ?? []), ...(initial?.blue ?? [])].filter((x) => x.surrogate).map((x) => x.teamId));
  const [startAt, setStartAt] = useState(toLocal(initial?.at ?? null));
  const [field, setField] = useState(initial?.field ?? "");
  const sorted = [...teams].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const column = (color: "red" | "blue", values: string[], set: (v: string[]) => void) => (
    <div className={`rounded-tl-lg rounded-br-lg border p-2 ${color === "red" ? "border-error/50 bg-error/5" : "border-info/50 bg-info/5"}`}>
      <p className={`mb-1 font-mono text-[10px] font-bold tracking-wider ${color === "red" ? "text-error" : "text-info"}`}>{color === "red" ? (versus ? "VERMELHA" : "ALIANÇA") : "AZUL"}</p>
      {values.map((v, i) => (
        <div key={i} className="mb-1 flex items-center gap-1">
          <select
            value={v}
            onChange={(e) => set(values.map((x, j) => (j === i ? e.target.value : x)))}
            className="select select-bordered select-sm flex-1"
            aria-label={`Equipe ${i + 1}`}
          >
            <option value="">Equipe…</option>
            {sorted.map((t) => (
              <option key={t.id} value={t.id}>
                {t.number ? `${t.number} · ` : ""}
                {t.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-[10px]" title="Surrogate: a partida não conta para esta equipe">
            <input
              type="checkbox"
              className="checkbox checkbox-xs"
              checked={!!v && surrogates.includes(v)}
              disabled={!v}
              onChange={(e) => setSurrogates((s) => (e.target.checked ? [...s, v] : s.filter((x) => x !== v)))}
            />
            S
          </label>
        </div>
      ))}
    </div>
  );

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ red, blue: versus ? blue : [], surrogates, startIso: fromLocal(startAt), field: field || null });
      }}
    >
      <div className={`grid gap-2 ${versus ? "sm:grid-cols-2" : ""}`}>
        {column("red", red, setRed)}
        {versus && column("blue", blue, setBlue)}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="input input-bordered input-sm" aria-label="Horário" />
        <input value={field} onChange={(e) => setField(e.target.value)} placeholder="Campo" maxLength={30} className="input input-bordered input-sm w-28" />
        <div className="flex-1" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancelar
        </button>
        <button className="btn btn-primary btn-sm" disabled={pending}>
          <Save size={14} /> Salvar
        </button>
      </div>
    </form>
  );
}

function MatchRow({
  eventId,
  match: m,
  versus,
  teams,
  teamOf,
  perAlliance,
  isAdmin,
  onEditResult,
}: {
  eventId: string;
  match: LiveMatch;
  versus: boolean;
  teams: LiveTeam[];
  teamOf: Map<string, LiveTeam>;
  perAlliance: number;
  isAdmin: boolean;
  onEditResult: () => void;
}) {
  const [editingTeams, setEditingTeams] = useState(false);
  const [pending, start] = useTransition();
  const { addToast } = useToast();
  const confirm = useConfirm();
  const names = (slots: LiveMatch["red"]) =>
    slots.map((x) => (
      <span key={x.teamId} className="block truncate">
        {teamOf.get(x.teamId)?.number && <span className="mr-1 font-mono text-[10px] opacity-60">{teamOf.get(x.teamId)?.number}</span>}
        {teamOf.get(x.teamId)?.name ?? "?"}
        {x.surrogate && <span className="ml-1 text-[9px] uppercase opacity-60">surr.</span>}
        {m.result?.flags[x.teamId] && <span className="ml-1 text-[9px] font-bold uppercase text-warning">{m.result.flags[x.teamId] === "dq" ? "DQ" : "ausente"}</span>}
      </span>
    ));

  if (editingTeams) {
    return (
      <li className="py-3">
        <p className="mb-2 font-mono font-bold">Q{m.number}</p>
        <MatchTeamsForm
          teams={teams}
          perAlliance={perAlliance}
          versus={versus}
          pending={pending}
          initial={m}
          onCancel={() => setEditingTeams(false)}
          onSubmit={(input) =>
            start(async () => {
              const r = await updateMatch(eventId, m.id, input);
              if (!r.ok) return addToast(r.error, "error", 5000);
              setEditingTeams(false);
            })
          }
        />
      </li>
    );
  }

  return (
    <li className={`flex flex-wrap items-center gap-3 py-2.5 ${pending ? "opacity-50" : ""}`}>
      <div className="w-14 shrink-0">
        <p className="font-mono font-black">Q{m.number}</p>
        <p className="font-mono text-[11px] text-base-content/55">{m.at ? timeFmt.format(m.at) : ""}</p>
        {m.field && <p className="text-[10px] text-base-content/50">{m.field}</p>}
      </div>
      <div className={`grid min-w-0 flex-1 gap-2 text-sm ${versus ? "grid-cols-2" : ""}`}>
        <div className="min-w-0 border-l-4 border-error pl-2">{names(m.red)}</div>
        {versus && <div className="min-w-0 border-l-4 border-info pl-2">{names(m.blue)}</div>}
      </div>
      <div className="w-24 text-right">
        <ScoreText m={m} versus={versus} />
        {m.status === "pending" && <Tag className="mt-1 border-warning/50">AGUARDANDO</Tag>}
        {m.result && (m.result.red.bonus.length > 0 || (m.result.blue?.bonus.length ?? 0) > 0) && (
          <p className="text-[10px] text-base-content/50">+RP bônus</p>
        )}
      </div>
      <div className="flex gap-1">
        <button type="button" className="btn btn-xs btn-outline" onClick={onEditResult} title={m.result ? "Corrigir resultado" : "Lançar resultado"}>
          <Pencil size={12} /> {m.result ? "Corrigir" : "Lançar"}
        </button>
        {m.result && (
          <button
            type="button"
            className="btn btn-xs btn-ghost"
            title="Anular resultado (a partida será repetida)"
            onClick={async () => {
              const ok = await confirm({ title: `Anular o resultado da Q${m.number}?`, message: "A partida volta para a fila da mesa.", confirmLabel: "Anular", danger: true });
              if (ok !== false)
                start(async () => {
                  const r = await voidMatchResult(eventId, m.id);
                  if (!r.ok) addToast(r.error, "error");
                });
            }}
          >
            <RotateCcw size={12} />
          </button>
        )}
        {isAdmin && (
          <>
            <button type="button" className="btn btn-xs btn-ghost" onClick={() => setEditingTeams(true)} aria-label={`Editar Q${m.number}`}>
              <Swords size={12} />
            </button>
            <button
              type="button"
              className="btn btn-xs btn-ghost text-error"
              aria-label={`Apagar Q${m.number}`}
              onClick={async () => {
                const ok = await confirm({ title: `Apagar a Q${m.number}?`, message: m.result ? "O resultado também será apagado." : undefined, confirmLabel: "Apagar", danger: true });
                if (ok !== false)
                  start(async () => {
                    const r = await deleteMatch(eventId, m.id);
                    if (!r.ok) addToast(r.error, "error");
                  });
              }}
            >
              <Trash2 size={12} />
            </button>
          </>
        )}
      </div>
    </li>
  );
}

function ResultEditor({
  eventId,
  match: m,
  challenge,
  teamOf,
  onClose,
}: {
  eventId: string;
  match: LiveMatch;
  challenge: Challenge;
  teamOf: Map<string, LiveTeam>;
  onClose: () => void;
}) {
  const cfg = challenge.alliance!;
  const versus = cfg.mode === "versus";
  const [loaded, setLoaded] = useState(!m.result);
  const [red, setRed] = useState<CustomResponses>({});
  const [blue, setBlue] = useState<CustomResponses>({});
  const [flags, setFlags] = useState<Record<string, TeamMatchFlag>>({});
  const [side, setSide] = useState<"red" | "blue">("red");
  const [pending, start] = useTransition();
  const { addToast } = useToast();

  // Carrega as súmulas lançadas pela mesa.
  useEffect(() => {
    if (loaded) return;
    let alive = true;
    void getMatchDetail(eventId, m.id).then((r) => {
      if (!alive) return;
      if (!r.ok) {
        addToast(r.error, "error");
        return onClose();
      }
      setRed(r.data.red as CustomResponses);
      setBlue(r.data.blue as CustomResponses);
      setFlags(r.data.flags);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, m.id]);

  const preview = useMemo(() => {
    try {
      const relaxed = { ...challenge, items: challenge.items.map((i) => ({ ...i, required: false })) };
      return scoreMatch(relaxed, cfg, red, versus ? blue : null, flags);
    } catch {
      return null;
    }
  }, [challenge, cfg, red, blue, flags, versus]);

  const save = () =>
    start(async () => {
      const r = await editMatchResult(eventId, { matchId: m.id, red, blue, flags });
      if (!r.ok) return addToast(r.error, "error", 6000);
      addToast(`Q${m.number} salva.`, "success");
      onClose();
    });

  const slots = side === "red" ? m.red : m.blue;
  return (
    <div className="rounded-tl-2xl rounded-br-2xl border-2 border-base-content p-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-mono text-lg font-black">Q{m.number}</p>
        {preview && (
          <p className="font-mono text-xl font-black">
            <span className="text-error">{preview.red.score}</span>
            {versus && (
              <>
                <span className="mx-1 opacity-40">×</span>
                <span className="text-info">{preview.blue?.score ?? 0}</span>
              </>
            )}
          </p>
        )}
        <div className="flex-1" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          <X size={14} /> Cancelar
        </button>
        <button type="button" className={`btn btn-primary btn-sm ${cornerBtn}`} disabled={pending || !loaded} onClick={save}>
          <Save size={14} /> Salvar resultado
        </button>
      </div>
      {!loaded ? (
        <p className="py-6 text-center text-sm text-base-content/55">
          <span className="loading loading-spinner loading-sm" /> Carregando súmulas…
        </p>
      ) : (
        <>
          {versus && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(["red", "blue"] as const).map((sd) => (
                <button
                  key={sd}
                  type="button"
                  onClick={() => setSide(sd)}
                  className={`btn btn-sm ${side === sd ? (sd === "red" ? "btn-error" : "btn-info") : "btn-outline"}`}
                >
                  {sd === "red" ? "Vermelha" : "Azul"}
                </button>
              ))}
            </div>
          )}
          <ul className="mt-3 space-y-1">
            {slots.map((x) => (
              <li key={x.teamId} className="flex items-center gap-2 text-sm">
                <span className="flex-1 truncate">{teamOf.get(x.teamId)?.name ?? "?"}</span>
                <select
                  value={flags[x.teamId] ?? ""}
                  onChange={(e) =>
                    setFlags((f) => {
                      const next = { ...f };
                      if (e.target.value) next[x.teamId] = e.target.value as TeamMatchFlag;
                      else delete next[x.teamId];
                      return next;
                    })
                  }
                  className="select select-bordered select-xs"
                >
                  <option value="">Jogou</option>
                  <option value="noshow">Não compareceu</option>
                  <option value="dq">Desclassificada</option>
                </select>
              </li>
            ))}
          </ul>
          <div className="mt-3 max-h-[60vh] overflow-y-auto pr-1">
            <CustomScoreForm
              challenge={challenge}
              responses={side === "red" ? red : blue}
              onChange={side === "red" ? setRed : setBlue}
              showImages={false}
            />
          </div>
        </>
      )}
    </div>
  );
}
