"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  CheckCircle2,
  ClipboardCheck,
  Eraser,
  LayoutDashboard,
  Lock,
  LogOut,
  Megaphone,
  PauseCircle,
  Pencil,
  Trash2,
  Trophy,
  Search,
  Send,
  Sparkles,
  Swords,
  WifiOff,
} from "lucide-react";
import { leaveMesa } from "@/app/actions/access";
import { getMyScore, refereeAmendScore, refereeVoidScore, submitScore } from "@/app/actions/scores";
import { TimerControls } from "@/components/live/TimerControls";
import { TimerDisplay } from "@/components/live/TimerDisplay";
import { MesaDeviceMenu, useMesaDevicePrefs } from "./MesaDevice";
import { MesaRanking } from "./MesaRanking";
import { cornerBtn, Logo, Tag } from "@/components/ui/brand";
import { useConfirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import { useLiveEvent, useServerClock } from "@/hooks/useLiveEvent";
import type { LiveSnapshot } from "@/lib/live-types";
import type { Mission } from "@/lib/missions";
import { availableRoundsForTeam, computePlayoffs, currentRound, scoreIndex } from "@/lib/ranking";
import { scoreRound, type RoundResponses } from "@/lib/scoring";
import { scoreChallenge, type Challenge, type CustomResponses } from "@/lib/challenge";
import { formatScore, formatSeconds, formatValue } from "@/lib/format";
import { CustomScoreForm } from "@/components/challenge/CustomScoreForm";
import { useWakeLock } from "@/hooks/useWakeLock";
import { ObrScoreForm } from "@/components/obr/ObrScoreForm";
import { emptyResponses as emptyObr, scoreObr, type ObrArena, type ObrLeague, type ObrResponses } from "@/lib/obr";
import { MissionForm } from "./MissionForm";

export type MesaForm =
  | { kind: "fll"; missions: Mission[] }
  | { kind: "custom"; challenge: Challenge }
  | { kind: "obr"; league: ObrLeague; roundArena: Record<string, string> };

interface Props {
  initial: LiveSnapshot;
  form: MesaForm;
  scorerLabel: string;
  via: "code" | "member";
  /** Preferências de quem está logado (voluntários com código usam o padrão). */
  confirmBeforeSend?: boolean;
  keepScreenOn?: boolean;
  /** Id de quem está na mesa (para achar as próprias notas). */
  scorerId: string;
  /** Rodadas que esta mesa pode avaliar (null = todas). */
  allowedRoundIds: string[] | null;
}

type Done = { team: string; round: string; points: number; label: string; gp: string | null; pending?: boolean; amended?: boolean };
type AnyResponses = RoundResponses | CustomResponses | ObrResponses;

export function Mesa({ initial, form, scorerLabel, via, confirmBeforeSend = true, keepScreenOn = true, scorerId, allowedRoundIds }: Props) {
  const [device, setDevice] = useMesaDevicePrefs(keepScreenOn);
  useWakeLock(device.keepScreenOn);
  const { snapshot: s, status, clockOffset, refresh } = useLiveEvent(initial, "staff");
  const { addToast } = useToast();
  const confirm = useConfirm();
  const [pending, start] = useTransition();

  const [teamId, setTeamId] = useState<string | null>(null);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [responses, setResponses] = useState<AnyResponses>({});
  const [done, setDone] = useState<Done | null>(null);
  const [query, setQuery] = useState("");
  const [teamConfirmed, setTeamConfirmed] = useState(false);
  /** Correção de uma nota que esta mesa enviou (janela liberada pela organização). */
  const [editing, setEditing] = useState<{ teamId: string; roundId: string } | null>(null);
  const [showRanking, setShowRanking] = useState(false);

  const idx = useMemo(() => scoreIndex(s.scores), [s.scores]);
  const playoffs = useMemo(() => computePlayoffs(s.teams, s.rounds, s.scores, s.settings), [s]);
  const current = useMemo(() => currentRound(s.teams, s.rounds, s.scores), [s]);
  const available = useMemo(() => {
    const map = new Map<string, ReturnType<typeof availableRoundsForTeam>>();
    for (const t of s.teams) map.set(t.id, availableRoundsForTeam(t.id, s.teams, s.rounds, s.scores, s.settings, allowedRoundIds));
    return map;
  }, [s, allowedRoundIds]);

  const team = s.teams.find((t) => t.id === teamId) ?? null;
  const editRound = editing ? (s.rounds.find((r) => r.id === editing.roundId) ?? null) : null;
  const teamRounds = editRound ? [editRound] : team ? (available.get(team.id) ?? []) : [];
  const round = teamRounds.find((r) => r.id === roundId) ?? null;

  // Que súmula usar nesta rodada: OBR (arena), desafio extra ou a do evento.
  const extraChallenge =
    form.kind === "obr" && round?.extra ? (form.league.extras.find((x) => x.id === round.extra!.id) ?? null) : null;
  const arena =
    form.kind === "obr" && round && !round.extra
      ? (form.league.arenas.find((a) => a.id === form.roundArena[round.id]) ?? null)
      : null;
  const active: MesaForm | { kind: "obr-arena"; arena: ObrArena } | null = extraChallenge
    ? { kind: "custom", challenge: extraChallenge }
    : arena
      ? { kind: "obr-arena", arena }
      : form.kind === "obr"
        ? null
        : form;

  // Se outra mesa avaliou esta equipe/rodada enquanto preenchíamos, avisa.
  useEffect(() => {
    if (!team || !roundId || done || pending || editing) return;
    if (!teamRounds.some((r) => r.id === roundId)) {
      addToast(`${team.name} acabou de ser avaliada por outra mesa nesta rodada.`, "warning", 6000);
      setRoundId(null);
    }
  }, [teamRounds, team, roundId, addToast, done, pending, editing]);

  // Rascunho: sobrevive a um recarregamento acidental.
  const draftKey = team && round && !editing ? `mesa:${s.event.id}:${team.id}:${round.id}` : null;
  useEffect(() => {
    setTeamConfirmed(false);
    if (!draftKey) return;
    const blank = (): AnyResponses => (active?.kind === "obr-arena" ? emptyObr(active.arena) : {});
    try {
      const saved = sessionStorage.getItem(draftKey);
      setResponses(saved ? JSON.parse(saved) : blank());
    } catch {
      setResponses(blank());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);
  useEffect(() => {
    if (draftKey && Object.keys(responses).length) sessionStorage.setItem(draftKey, JSON.stringify(responses));
  }, [draftKey, responses]);

  const onSelect = useCallback((missionId: string, index: number, value: number) => {
    setResponses((prev0) => {
      const prev = prev0 as RoundResponses;
      const m = { ...(prev[missionId] ?? {}) };
      if (m[index] === value) delete m[index];
      else m[index] = value;
      const next = { ...prev, [missionId]: m };
      if (!Object.keys(m).length) delete next[missionId];
      return next;
    });
  }, []);

  const preview = useMemo(() => {
    if (!active) return { points: 0, gp: null as string | null, missing: [] as string[], tempo: null as number | null };
    if (active.kind === "custom") {
      const r = scoreChallenge(active.challenge, responses as CustomResponses);
      return { points: r.value, gp: null as string | null, missing: r.missing.map((m) => m.label), tempo: null };
    }
    if (active.kind === "obr-arena") {
      const resp = responses as ObrResponses;
      if (!Array.isArray(resp.sections)) return { points: 0, gp: null, missing: [], tempo: null };
      const b = scoreObr(active.arena, resp);
      const missing = resp.chegada && !resp.desistiu && resp.tempo === null ? ["tempo da rodada"] : [];
      return { points: b.total, gp: null, missing, tempo: b.tempo };
    }
    if (active.kind === "fll") {
      const r = scoreRound(active.missions, responses as RoundResponses);
      return { points: r.points, gp: r.extras.gp?.label ?? null, missing: [] as string[], tempo: null };
    }
    return { points: 0, gp: null, missing: [], tempo: null };
  }, [active, responses]);
  const answered =
    active?.kind === "obr-arena"
      ? 0
      : Object.keys(responses).filter((k) => !k.startsWith("pen:") && k !== "dnf").length;
  const totalParts = active?.kind === "custom" ? active.challenge.items.length : active?.kind === "fll" ? active.missions.length : 0;
  const f = extraChallenge
    ? { direction: extraChallenge.scoring.direction, unit: extraChallenge.scoring.unit, decimals: extraChallenge.scoring.decimals }
    : s.event.scoring;

  const pickTeam = (id: string) => {
    setTeamId(id);
    const rounds = available.get(id) ?? [];
    setRoundId(rounds.length === 1 ? rounds[0].id : null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reset = () => {
    setTeamId(null);
    setRoundId(null);
    setResponses({});
    setDone(null);
    setEditing(null);
    setTeamConfirmed(false);
  };

  // Notas desta mesa ainda dentro da janela de correção.
  const now = useServerClock(clockOffset, 5000);
  const windowMs = s.settings.refereeEditWindowMin * 60_000;
  const mine = windowMs
    ? s.scores.filter((x) => x.sb === scorerId && x.created && now - x.created < windowMs).sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
    : [];

  const startEdit = (teamId: string, roundId: string) =>
    start(async () => {
      const r = await getMyScore(s.event.id, teamId, roundId);
      if (!r.ok) return addToast(r.error, "error");
      setEditing({ teamId, roundId });
      setTeamId(teamId);
      setRoundId(roundId);
      setResponses(r.data.responses as AnyResponses);
      setDone(null);
      window.scrollTo({ top: 0 });
    });

  const voidMine = async (teamId: string, roundId: string) => {
    const ok = await confirm({
      title: "Apagar esta nota?",
      message: "A equipe volta a ficar pendente nesta rodada e pode ser avaliada de novo.",
      confirmLabel: "Apagar nota",
      danger: true,
    });
    if (ok === false) return;
    start(async () => {
      const r = await refereeVoidScore(s.event.id, teamId, roundId);
      if (!r.ok) return addToast(r.error, "error");
      addToast("Nota apagada.", "success");
      void refresh();
    });
  };

  const send = async () => {
    if (!team || !round) return;
    if (preview.missing.length) {
      addToast(`Preencha: ${preview.missing.join(", ")}.`, "warning", 5000);
      return;
    }
    if (s.settings.requireTeamConfirmation && !teamConfirmed) {
      addToast("Peça para a equipe conferir a súmula e marque a confirmação.", "warning", 5000);
      return;
    }
    if (confirmBeforeSend) {
      const ok = await confirm({
        title: `Enviar ${formatScore(preview.points, f)}?`,
        message: (
          <>
            <b>{team.name}</b> · {round.name}
            {preview.gp && <> · GP: {preview.gp}</>}
            {preview.tempo !== null && <> · tempo {formatSeconds(preview.tempo, 0)}</>}
            <br />
            {s.settings.requireApproval && via === "code"
              ? "A nota vai para aprovação da organização antes do telão."
              : "A nota vai direto para o telão."}{" "}
            {s.settings.refereeEditWindowMin
              ? `Você pode corrigir por ${s.settings.refereeEditWindowMin} min.`
              : "Correções só pela organização."}
          </>
        ),
        confirmLabel: editing ? "Salvar correção" : "Enviar nota",
      });
      if (ok === false) return;
    }
    start(async () => {
      const payload = { teamId: team.id, roundId: round.id, responses, teamConfirmed };
      const r = editing ? await refereeAmendScore(s.event.id, payload) : await submitScore(s.event.id, payload);
      if (!r.ok) {
        addToast(r.error, "error", 6000);
        return;
      }
      if (draftKey) sessionStorage.removeItem(draftKey);
      if (device.vibrate && "vibrate" in navigator) navigator.vibrate?.(120);
      setDone({ ...r.data, amended: !!editing });
      setEditing(null);
      void refresh();
      window.scrollTo({ top: 0 });
    });
  };

  const totalPending = s.teams.filter((t) => (available.get(t.id) ?? []).length > 0).length;
  const filtered = s.teams.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()) || t.number?.includes(query));
  const locked = s.event.status !== "live";
  const paused = s.settings.submissionsPaused && via === "code";
  const canTimer = via === "member" || s.settings.volunteersControlTimer;
  const canSeeRanking = via === "member" || s.settings.volunteersSeeRanking;

  /* ================================================================ */

  return (
    <div className={`min-h-dvh bg-base-200/50 ${device.large ? "mesa-large" : ""}`}>
      <header className="sticky top-0 z-30 border-b border-base-300 bg-base-100/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Logo size="text-sm" href={null} />
              <Tag className="border-secondary/40 bg-secondary/10 text-secondary">
                <ClipboardCheck size={11} /> MESA
              </Tag>
              {status !== "live" && (
                <Tag className="border-warning/50 bg-warning/15">
                  <WifiOff size={11} /> {status === "offline" ? "OFFLINE" : "CONECTANDO"}
                </Tag>
              )}
            </div>
            <p className="mt-1 truncate text-sm font-bold">{s.event.name}</p>
            <p className="truncate text-xs text-base-content/55">{scorerLabel}</p>
          </div>
          {canTimer ? (
            <TimerControls eventId={s.event.id} timer={s.event.timer} clockOffset={clockOffset} size="sm" />
          ) : (
            <TimerDisplay timer={s.event.timer} clockOffset={clockOffset} className="text-xl" />
          )}
          <MesaDeviceMenu prefs={device} onChange={setDevice} />
          {via === "member" ? (
            <Link href={`/hub/${s.event.id}`} className="btn btn-ghost btn-sm btn-square" aria-label="Voltar ao hub">
              <LayoutDashboard size={18} />
            </Link>
          ) : (
            <form action={leaveMesa}>
              <button className="btn btn-ghost btn-sm btn-square" aria-label="Sair da mesa">
                <LogOut size={18} />
              </button>
            </form>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-40 pt-5">
        {s.settings.mesaNotice && (
          <div className="mb-4 flex items-start gap-3 rounded-tl-2xl rounded-br-2xl border-2 border-info bg-info/10 p-4" role="status">
            <Megaphone className="mt-0.5 shrink-0 text-info" size={20} />
            <p className="text-sm font-medium">{s.settings.mesaNotice}</p>
          </div>
        )}
        {paused && !locked && (
          <div className="mb-4 flex items-start gap-3 rounded-tl-2xl rounded-br-2xl border-2 border-warning bg-warning/10 p-4">
            <PauseCircle className="mt-0.5 shrink-0 text-warning" size={20} />
            <div className="text-sm">
              <p className="font-bold">Envios pausados pela organização</p>
              <p className="text-base-content/70">Você pode continuar preenchendo; o envio volta assim que liberarem.</p>
            </div>
          </div>
        )}
        {allowedRoundIds?.length ? (
          <p className="mb-4 text-xs text-base-content/60">
            Esta mesa avalia: <b>{s.rounds.filter((r) => allowedRoundIds.includes(r.id)).map((r) => r.name).join(", ")}</b>
          </p>
        ) : null}
        {locked && (
          <div className="mb-5 flex items-start gap-3 rounded-tl-2xl rounded-br-2xl border-2 border-warning bg-warning/10 p-4">
            <Lock className="mt-0.5 shrink-0 text-warning" size={20} />
            <div className="text-sm">
              <p className="font-bold">{s.event.status === "draft" ? "Evento em preparação" : "Evento encerrado"}</p>
              <p className="text-base-content/70">
                {s.event.status === "draft"
                  ? "Você pode preencher a súmula para treinar, mas o envio só abre quando a organização colocar o evento ao vivo."
                  : "Notas não podem mais ser enviadas."}
              </p>
            </div>
          </div>
        )}

        {done ? (
          <DoneCard done={done} onNext={reset} remaining={totalPending} />
        ) : !team ? (
          /* ------------------------------------------ escolher equipe */
          <section>
            <PhaseBanner phase={playoffs.phase} currentName={current?.name} onlyCurrent={s.settings.showOnlyCurrentRound} />
            {mine.length > 0 && (
              <div className="mb-5 rounded-tl-2xl rounded-br-2xl border border-base-300 bg-base-100 p-4">
                <p className="kicker">/ SUAS NOTAS · CORREÇÃO LIBERADA POR {s.settings.refereeEditWindowMin} MIN</p>
                <ul className="mt-2 divide-y divide-base-300">
                  {mine.map((x) => {
                    const t = s.teams.find((tt) => tt.id === x.teamId);
                    const r = s.rounds.find((rr) => rr.id === x.roundId);
                    const left = Math.max(0, Math.ceil((windowMs - (now - (x.created ?? 0))) / 60_000));
                    return (
                      <li key={`${x.teamId}:${x.roundId}`} className="flex items-center gap-2 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {t?.name} · {r?.name}
                          </p>
                          <p className="text-xs text-base-content/55">
                            {x.points === null ? "—" : formatScore(x.points, r?.extra?.scoring ?? s.event.scoring)}
                            {x.pending && " · aguardando aprovação"} · {left} min para corrigir
                          </p>
                        </div>
                        <button type="button" className="btn btn-xs btn-outline" disabled={pending || paused} onClick={() => startEdit(x.teamId, x.roundId)}>
                          <Pencil size={12} /> Corrigir
                        </button>
                        <button type="button" className="btn btn-xs btn-ghost text-error" disabled={pending || paused} onClick={() => voidMine(x.teamId, x.roundId)} aria-label="Apagar nota">
                          <Trash2 size={12} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {canSeeRanking && (
              <div className="mb-4">
                <button type="button" className="btn btn-sm btn-ghost -ml-2" onClick={() => setShowRanking((v) => !v)}>
                  <Trophy size={15} /> {showRanking ? "Ocultar classificação" : "Ver classificação"}
                </button>
                {showRanking && <MesaRanking snapshot={s} />}
              </div>
            )}
            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <p className="kicker">/ PASSO 1</p>
                <h1 className="text-2xl font-bold tracking-tight">Qual equipe está na mesa?</h1>
              </div>
              <span className="font-mono text-xs text-base-content/55">{totalPending} aguardando</span>
            </div>
            <label className="mt-4 flex items-center gap-2 rounded-tl-xl rounded-br-xl border border-base-300 bg-base-100 px-3">
              <Search size={16} className="text-base-content/50" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome ou número"
                className="h-12 w-full bg-transparent outline-none"
              />
            </label>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {filtered.map((t) => {
                const free = available.get(t.id) ?? [];
                const scored = s.rounds.filter((r) => idx.has(`${t.id}:${r.id}`)).length;
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={!free.length}
                    onClick={() => pickTeam(t.id)}
                    className="group flex items-center gap-3 rounded-tl-xl rounded-br-xl border border-base-300 bg-base-100 p-3 text-left transition hover:-translate-y-0.5 hover:border-secondary/50 disabled:translate-y-0 disabled:opacity-45"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-tl-lg rounded-br-lg bg-base-200 font-mono text-xs font-bold">
                      {t.number ?? t.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{t.name}</span>
                      <span className="block text-xs text-base-content/55">
                        {free.length ? free.map((r) => r.name).join(" · ") : scored ? "Nada liberado agora" : "Sem rodada liberada"}
                      </span>
                    </span>
                    {free.length ? (
                      <ArrowRight size={18} className="text-base-content/30 group-hover:text-secondary" />
                    ) : (
                      <CheckCircle2 size={18} className="text-success" />
                    )}
                  </button>
                );
              })}
            </div>
            {!s.teams.length && <p className="mt-6 text-center text-sm text-base-content/60">Nenhuma equipe cadastrada ainda.</p>}
          </section>
        ) : (
          /* ------------------------------------------------ súmula */
          <section>
            <button type="button" onClick={reset} className="btn btn-ghost btn-sm -ml-2">
              <ArrowLeft size={16} /> {editing ? "Cancelar correção" : "Trocar equipe"}
            </button>
            {editing && (
              <p className="mt-2 rounded-tl-xl rounded-br-xl border-2 border-dashed border-secondary bg-secondary/10 px-4 py-2 text-sm font-medium">
                Corrigindo uma nota que você enviou. Ao salvar, ela substitui a anterior.
              </p>
            )}
            <div className="mt-2 rounded-tl-2xl rounded-br-2xl border-2 border-base-content bg-base-100 p-4 shadow-[6px_6px_0_0_var(--color-secondary)]">
              <p className="kicker">/ PASSO 2 · {team.number ? `#${team.number}` : "EQUIPE"}</p>
              <h1 className="text-2xl font-black tracking-tight">{team.name}</h1>
              <div className="mt-3 flex flex-wrap gap-2">
                {teamRounds.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRoundId(r.id)}
                    className={`btn btn-sm ${cornerBtn} ${roundId === r.id ? "btn-secondary" : "btn-outline border-base-300"}`}
                  >
                    {r.kind === "semifinal" || r.kind === "final" ? <Swords size={14} /> : r.kind === "extra" ? <Sparkles size={14} /> : null} {r.name}
                    {r.arena && <span className="font-mono text-[10px] opacity-70">{r.arena}</span>}
                  </button>
                ))}
                {!teamRounds.length && <span className="text-sm text-base-content/60">Nenhuma rodada liberada para esta equipe.</span>}
              </div>
            </div>

            {round ? (
              <>
                {active?.kind === "fll" ? (
                  <div className="my-4 flex items-start gap-3 rounded-tl-xl rounded-br-xl bg-base-100 p-3 text-xs text-base-content/70">
                    <Ban size={16} className="mt-0.5 shrink-0 text-warning" />
                    <p>
                      <b>Sem equipamento:</b> um modelo de missão não pontua se estiver tocando um equipamento no final da partida.
                    </p>
                  </div>
                ) : active?.kind === "custom" ? (
                  <ChallengeBrief challenge={active.challenge} />
                ) : (
                  <div className="my-4" />
                )}
                {!active ? (
                  <p className="rounded-tl-xl rounded-br-xl bg-warning/15 p-4 text-sm">
                    Esta rodada não está ligada a uma arena. Peça à organização para revisar as arenas no hub.
                  </p>
                ) : active.kind === "fll" ? (
                  <MissionForm
                    missions={active.missions}
                    responses={responses as RoundResponses}
                    onSelect={onSelect}
                    showImages={s.settings.showMissionImages}
                  />
                ) : active.kind === "obr-arena" ? (
                  Array.isArray((responses as ObrResponses).sections) && (
                    <ObrScoreForm arena={active.arena} value={responses as ObrResponses} onChange={setResponses} />
                  )
                ) : active.kind === "custom" ? (
                  <CustomScoreForm
                    challenge={active.challenge}
                    responses={responses as CustomResponses}
                    onChange={setResponses}
                    showImages={s.settings.showMissionImages}
                  />
                ) : null}
              </>
            ) : (
              teamRounds.length > 1 && <p className="mt-6 text-center text-sm text-base-content/60">Escolha a rodada acima.</p>
            )}
          </section>
        )}
      </main>

      {/* barra de envio */}
      {team && round && !done && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-base-content bg-base-100">
          {s.settings.requireTeamConfirmation && (
            <label className="mx-auto flex max-w-4xl cursor-pointer items-center gap-3 border-b border-base-300 px-4 py-2 text-sm">
              <input type="checkbox" className="checkbox checkbox-sm checkbox-primary" checked={teamConfirmed} onChange={(e) => setTeamConfirmed(e.target.checked)} />
              <span>
                <b>A equipe conferiu a súmula</b> e concorda com a pontuação
              </span>
            </label>
          )}
          <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-base-content/55">
                {team.name} · {round.name}
                {round.arena ? ` · ${round.arena}` : ""}
                {totalParts > 0 && ` · ${answered}/${totalParts} ${active?.kind === "fll" ? "missões" : "itens"}`}
              </p>
              <p className="font-mono text-3xl font-black tabular-nums">
                <span key={preview.points} className="score-pop inline-block">
                  {formatValue(preview.points, f)}
                </span>{" "}
                <span className="text-base font-bold text-base-content/50">{f.unit}</span>
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-square"
              aria-label="Limpar súmula"
              disabled={!answered}
              onClick={async () => {
                if ((await confirm({ title: "Limpar a súmula?", confirmLabel: "Limpar", danger: true })) !== false) {
                  setResponses({});
                  if (draftKey) sessionStorage.removeItem(draftKey);
                }
              }}
            >
              <Eraser size={18} />
            </button>
            <button
              type="button"
              disabled={pending || locked || paused || (s.settings.requireTeamConfirmation && !teamConfirmed)}
              onClick={send}
              className={`btn btn-primary btn-lg ${cornerBtn} shadow-[4px_4px_0_0_var(--color-base-content)]`}
            >
              {pending ? <span className="loading loading-spinner" /> : <Send size={18} />}
              {editing ? "Salvar" : "Enviar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChallengeBrief({ challenge }: { challenge: Challenge }) {
  if (!challenge.objective && !challenge.rules.length) return <div className="my-4" />;
  return (
    <details className="my-4 rounded-tl-xl rounded-br-xl bg-base-100 p-3 text-sm">
      <summary className="cursor-pointer font-medium">
        {challenge.name} — objetivo e regras
      </summary>
      {challenge.objective && <p className="mt-2 text-base-content/70">{challenge.objective}</p>}
      {challenge.rules.length > 0 && (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-base-content/70">
          {challenge.rules.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ol>
      )}
    </details>
  );
}

function PhaseBanner({ phase, currentName, onlyCurrent }: { phase: string; currentName?: string; onlyCurrent: boolean }) {
  if (phase === "semifinal" || phase === "final") {
    return (
      <div className="flex items-center gap-3 rounded-tl-2xl rounded-br-2xl bg-primary p-4 text-primary-content">
        <Swords size={22} />
        <div>
          <p className="font-bold">{phase === "semifinal" ? "Semifinal liberada" : "Final liberada"}</p>
          <p className="text-sm opacity-85">Só as equipes classificadas aparecem disponíveis.</p>
        </div>
      </div>
    );
  }
  if (phase === "done") {
    return <div className="rounded-tl-2xl rounded-br-2xl bg-success/15 p-4 font-bold">Playoffs encerrados. Obrigado, mesa! 🎉</div>;
  }
  if (onlyCurrent && currentName) {
    return (
      <div className="rounded-tl-2xl rounded-br-2xl border border-info/30 bg-info/10 p-4 text-sm">
        <b>{currentName}</b> em andamento. A próxima rodada abre quando todas as equipes forem avaliadas.
      </div>
    );
  }
  return null;
}

function DoneCard({ done, onNext, remaining }: { done: Done; onNext: () => void; remaining: number }) {
  return (
    <div className="celebrate-in mx-auto max-w-lg rounded-tl-[2rem] rounded-br-[2rem] border-2 border-base-content bg-base-100 p-8 text-center shadow-[8px_8px_0_0_var(--color-primary)]">
      <span className="mx-auto grid size-14 place-items-center rounded-tl-xl rounded-br-xl bg-success/15 text-success">
        <CheckCircle2 size={30} />
      </span>
      <p className="kicker mt-5">/ {done.amended ? "NOTA CORRIGIDA" : "NOTA ENVIADA"} · {done.round}</p>
      <h2 className="mt-2 text-2xl font-black tracking-tight">{done.team}</h2>
      <p className="mt-3 font-mono text-6xl font-black tabular-nums text-primary">{done.label}</p>
      {done.gp && <p className="text-sm text-base-content/55">GP: {done.gp}</p>}
      {done.pending && (
        <p className="mt-3 rounded-tl-lg rounded-br-lg bg-warning/15 px-3 py-2 text-sm font-medium">
          Aguardando aprovação da organização antes de aparecer no telão.
        </p>
      )}
      <button type="button" onClick={onNext} className={`btn btn-primary btn-lg mt-8 w-full ${cornerBtn}`}>
        Próxima avaliação <ArrowRight size={18} />
      </button>
      <p className="mt-3 text-xs text-base-content/50">{remaining} equipe(s) ainda com rodada pendente</p>
    </div>
  );
}
