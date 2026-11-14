"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, LayoutDashboard, Lock, LogOut, Megaphone, PauseCircle, Send, Swords, Trophy, WifiOff } from "lucide-react";
import { leaveMesa } from "@/app/actions/access";
import { submitMatch } from "@/app/actions/matches";
import { CustomScoreForm } from "@/components/challenge/CustomScoreForm";
import { TimerControls } from "@/components/live/TimerControls";
import { TimerDisplay } from "@/components/live/TimerDisplay";
import { cornerBtn, Logo, Tag } from "@/components/ui/brand";
import { useConfirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import { useLiveEvent } from "@/hooks/useLiveEvent";
import { useWakeLock } from "@/hooks/useWakeLock";
import { computeAllianceRanking, scoreMatch, type TeamMatchFlag } from "@/lib/alliance";
import type { Challenge, CustomResponses } from "@/lib/challenge";
import type { LiveSnapshot, LiveTeam } from "@/lib/live-types";
import { MesaDeviceMenu, useMesaDevicePrefs } from "./MesaDevice";

type Side = "red" | "blue";
type Draft = { red: CustomResponses; blue: CustomResponses; flags: Record<string, TeamMatchFlag> };
const EMPTY: Draft = { red: {}, blue: {}, flags: {} };

const SIDE = {
  red: { label: "Vermelha", cls: "bg-error text-error-content", soft: "border-error/50 bg-error/10", text: "text-error" },
  blue: { label: "Azul", cls: "bg-info text-info-content", soft: "border-info/50 bg-info/10", text: "text-info" },
} as const;

const timeFmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

/**
 * Mesa do formato de alianças: escolhe a partida, preenche a súmula de cada
 * aliança, marca ausências/desclassificações e envia o placar da partida.
 */
export function AllianceMesa({
  initial,
  challenge,
  scorerLabel,
  via,
  confirmBeforeSend = true,
  keepScreenOn = true,
}: {
  initial: LiveSnapshot;
  challenge: Challenge;
  scorerLabel: string;
  via: "code" | "member";
  confirmBeforeSend?: boolean;
  keepScreenOn?: boolean;
}) {
  const [device, setDevice] = useMesaDevicePrefs(keepScreenOn);
  useWakeLock(device.keepScreenOn);
  const { snapshot: s, status, clockOffset, refresh } = useLiveEvent(initial, "staff");
  const { addToast } = useToast();
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  const cfg = challenge.alliance!;
  const versus = cfg.mode === "versus";

  const [matchId, setMatchId] = useState<string | null>(null);
  const [side, setSide] = useState<Side>("red");
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [confirmed, setConfirmed] = useState(false);
  const [done, setDone] = useState<{ number: number; red: number; blue: number | null; pending: boolean } | null>(null);
  const [showRanking, setShowRanking] = useState(false);

  const teamOf = useMemo(() => new Map(s.teams.map((t) => [t.id, t])), [s.teams]);
  const open = s.matches.filter((m) => m.status === "scheduled");
  const played = s.matches.filter((m) => m.status !== "scheduled").sort((a, b) => b.updated - a.updated);
  const match = s.matches.find((m) => m.id === matchId) ?? null;

  // Outra mesa lançou esta partida enquanto preenchíamos.
  useEffect(() => {
    if (match && match.status !== "scheduled" && !done && !pending) {
      addToast(`Q${match.number} acabou de receber resultado de outra mesa.`, "warning", 6000);
      setMatchId(null);
    }
  }, [match, done, pending, addToast]);

  // Rascunho por partida: sobrevive a um recarregamento.
  const key = matchId ? `mesa-alliance:${s.event.id}:${matchId}` : null;
  useEffect(() => {
    setConfirmed(false);
    setSide("red");
    if (!key) return;
    try {
      const saved = sessionStorage.getItem(key);
      setDraft(saved ? JSON.parse(saved) : EMPTY);
    } catch {
      setDraft(EMPTY);
    }
  }, [key]);
  useEffect(() => {
    if (key) sessionStorage.setItem(key, JSON.stringify(draft));
  }, [key, draft]);

  const preview = useMemo(() => {
    try {
      const relaxed = { ...challenge, items: challenge.items.map((i) => ({ ...i, required: false })) };
      return scoreMatch(relaxed, cfg, draft.red, versus ? draft.blue : null, draft.flags);
    } catch {
      return null;
    }
  }, [challenge, cfg, draft, versus]);

  const missing = (resp: CustomResponses) => challenge.items.filter((i) => i.required && resp[i.id] === undefined).map((i) => i.label);
  const locked = s.event.status !== "live";
  const paused = s.settings.submissionsPaused && via === "code";
  const canTimer = via === "member" || s.settings.volunteersControlTimer;
  const canSeeRanking = via === "member" || s.settings.volunteersSeeRanking;

  const send = async () => {
    if (!match || !preview) return;
    const miss = [...missing(draft.red).map((m) => `Vermelha: ${m}`), ...(versus ? missing(draft.blue).map((m) => `Azul: ${m}`) : [])];
    if (miss.length) return addToast(`Preencha: ${miss.join(", ")}.`, "warning", 6000);
    if (s.settings.requireTeamConfirmation && !confirmed) return addToast("Peça para as alianças conferirem e marque a confirmação.", "warning", 5000);
    if (confirmBeforeSend) {
      const ok = await confirm({
        title: versus ? `Enviar Q${match.number}: ${preview.red.score} × ${preview.blue?.score ?? 0}?` : `Enviar Q${match.number}: ${preview.red.score} pts?`,
        message:
          s.settings.requireApproval && via === "code"
            ? "O resultado vai para aprovação da organização antes do telão."
            : "O resultado vai direto para o telão e para a classificação. Correções só pela organização.",
        confirmLabel: "Enviar resultado",
      });
      if (ok === false) return;
    }
    start(async () => {
      const r = await submitMatch(s.event.id, { matchId: match.id, red: draft.red, blue: draft.blue, flags: draft.flags, confirmed });
      if (!r.ok) return addToast(r.error, "error", 6000);
      if (key) sessionStorage.removeItem(key);
      if (device.vibrate && "vibrate" in navigator) navigator.vibrate?.(120);
      setDone(r.data);
      void refresh();
      window.scrollTo({ top: 0 });
    });
  };

  const reset = () => {
    setDone(null);
    setMatchId(null);
    setDraft(EMPTY);
  };

  const teamChip = (teamId: string, surrogate?: boolean) => {
    const t = teamOf.get(teamId);
    return (
      <span key={teamId} className="inline-flex items-center gap-1 text-sm">
        {t?.number && <span className="font-mono text-xs opacity-70">{t.number}</span>}
        <span className="font-medium">{t?.name ?? "?"}</span>
        {surrogate && <span className="text-[10px] uppercase opacity-60">(surrogate)</span>}
      </span>
    );
  };

  return (
    <div className={`min-h-dvh bg-base-200/50 ${device.large ? "mesa-large" : ""}`}>
      <header className="sticky top-0 z-30 border-b border-base-300 bg-base-100/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Logo size="text-sm" href={null} />
              <Tag className="border-secondary/40 bg-secondary/10 text-secondary">
                <Swords size={11} /> MESA · ALIANÇAS
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
            <Link href={`/hub/${s.event.id}/partidas`} className="btn btn-ghost btn-sm btn-square" aria-label="Voltar ao hub">
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

      <main className="mx-auto max-w-4xl px-4 pb-44 pt-5">
        {s.settings.mesaNotice && (
          <div className="mb-4 flex items-start gap-3 rounded-tl-2xl rounded-br-2xl border-2 border-info bg-info/10 p-4" role="status">
            <Megaphone className="mt-0.5 shrink-0 text-info" size={20} />
            <p className="text-sm font-medium">{s.settings.mesaNotice}</p>
          </div>
        )}
        {paused && !locked && (
          <div className="mb-4 flex items-start gap-3 rounded-tl-2xl rounded-br-2xl border-2 border-warning bg-warning/10 p-4">
            <PauseCircle className="mt-0.5 shrink-0 text-warning" size={20} />
            <p className="text-sm">
              <b>Envios pausados pela organização.</b> Você pode continuar preenchendo; o envio volta assim que liberarem.
            </p>
          </div>
        )}
        {locked && (
          <div className="mb-5 flex items-start gap-3 rounded-tl-2xl rounded-br-2xl border-2 border-warning bg-warning/10 p-4">
            <Lock className="mt-0.5 shrink-0 text-warning" size={20} />
            <p className="text-sm">
              <b>{s.event.status === "draft" ? "Evento em preparação." : "Evento encerrado."}</b>{" "}
              {s.event.status === "draft" ? "Dá para treinar a súmula; o envio abre quando o evento ficar ao vivo." : "Resultados não podem mais ser enviados."}
            </p>
          </div>
        )}

        {done ? (
          <section className="rounded-tl-3xl rounded-br-3xl border-2 border-base-content bg-base-100 p-8 text-center shadow-[8px_8px_0_0_var(--color-primary)]">
            <CheckCircle2 size={44} className="mx-auto text-success" />
            <p className="kicker mt-4">/ RESULTADO ENVIADO · Q{done.number}</p>
            {done.blue === null ? (
              <p className="mt-3 font-mono text-6xl font-black tabular-nums text-primary">{done.red}</p>
            ) : (
              <p className="mt-3 flex items-center justify-center gap-4 font-mono text-5xl font-black tabular-nums">
                <span className="text-error">{done.red}</span>
                <span className="text-2xl opacity-40">×</span>
                <span className="text-info">{done.blue}</span>
              </p>
            )}
            {done.pending && <p className="mt-3 text-sm text-warning">Aguardando aprovação da organização antes do telão.</p>}
            <button type="button" className={`btn btn-primary btn-lg mt-6 ${cornerBtn}`} onClick={reset}>
              Próxima partida
            </button>
            <p className="mt-2 text-xs text-base-content/55">{open.length} partida(s) sem resultado</p>
          </section>
        ) : !match ? (
          <section>
            {canSeeRanking && (
              <div className="mb-4">
                <button type="button" className="btn btn-sm btn-ghost -ml-2" onClick={() => setShowRanking((v) => !v)}>
                  <Trophy size={15} /> {showRanking ? "Ocultar classificação" : "Ver classificação"}
                </button>
                {showRanking && <MiniRanking snapshot={s} />}
              </div>
            )}
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="kicker">/ PASSO 1</p>
                <h1 className="text-2xl font-bold tracking-tight">Qual partida está na arena?</h1>
              </div>
              <span className="font-mono text-xs text-base-content/55">{open.length} sem resultado</span>
            </div>
            {open.length === 0 ? (
              <p className="mt-6 rounded-tl-2xl rounded-br-2xl border-2 border-dashed border-base-300 p-8 text-center text-sm text-base-content/60">
                {s.matches.length ? "Todas as partidas têm resultado." : "A organização ainda não publicou o cronograma de partidas."}
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {open.map((m, i) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setMatchId(m.id);
                        window.scrollTo({ top: 0 });
                      }}
                      className={`flex w-full items-stretch gap-3 rounded-tl-2xl rounded-br-2xl border-2 bg-base-100 p-3 text-left transition hover:-translate-y-0.5 ${
                        i === 0 ? "border-base-content shadow-[4px_4px_0_0_var(--color-primary)]" : "border-base-300"
                      }`}
                    >
                      <div className="grid w-16 shrink-0 place-items-center">
                        <span className="font-mono text-xl font-black">Q{m.number}</span>
                        {m.at && <span className="font-mono text-[11px] text-base-content/55">{timeFmt.format(m.at)}</span>}
                        {m.field && <span className="text-[10px] text-base-content/50">{m.field}</span>}
                      </div>
                      <div className={`grid flex-1 gap-2 ${versus ? "sm:grid-cols-2" : ""}`}>
                        <div className={`rounded-tl-lg rounded-br-lg border px-3 py-2 ${SIDE.red.soft}`}>
                          <p className={`font-mono text-[10px] font-bold tracking-wider ${SIDE.red.text}`}>{versus ? "VERMELHA" : "ALIANÇA"}</p>
                          <div className="flex flex-col">{m.red.map((x) => teamChip(x.teamId, x.surrogate))}</div>
                        </div>
                        {versus && (
                          <div className={`rounded-tl-lg rounded-br-lg border px-3 py-2 ${SIDE.blue.soft}`}>
                            <p className={`font-mono text-[10px] font-bold tracking-wider ${SIDE.blue.text}`}>AZUL</p>
                            <div className="flex flex-col">{m.blue.map((x) => teamChip(x.teamId, x.surrogate))}</div>
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {played.length > 0 && (
              <details className="mt-6">
                <summary className="cursor-pointer text-sm font-medium text-base-content/70">Últimos resultados ({played.length})</summary>
                <ul className="mt-2 divide-y divide-base-300 rounded-tl-xl rounded-br-xl border border-base-300 bg-base-100">
                  {played.slice(0, 8).map((m) => (
                    <li key={m.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <span className="w-12 font-mono font-bold">Q{m.number}</span>
                      <span className="flex-1 font-mono">
                        <span className="text-error">{m.result?.red.score ?? "—"}</span>
                        {versus && (
                          <>
                            {" × "}
                            <span className="text-info">{m.result?.blue?.score ?? "—"}</span>
                          </>
                        )}
                      </span>
                      {m.status === "pending" && <Tag className="border-warning/50">AGUARDANDO</Tag>}
                      <span className="text-xs text-base-content/50">{m.by}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        ) : (
          <section>
            <button type="button" className="btn btn-ghost btn-sm -ml-2" onClick={() => setMatchId(null)}>
              <ArrowLeft size={16} /> Trocar partida
            </button>
            <div className="mt-2 flex flex-wrap items-baseline gap-3">
              <h1 className="text-3xl font-black tracking-tight">Q{match.number}</h1>
              {match.at && (
                <span className="inline-flex items-center gap-1 text-sm text-base-content/60">
                  <Clock size={13} /> {timeFmt.format(match.at)}
                </span>
              )}
              {match.field && <span className="text-sm text-base-content/60">{match.field}</span>}
            </div>

            {versus && (
              <div role="tablist" className="sticky top-[68px] z-20 mt-4 grid grid-cols-2 gap-2 bg-base-200/80 py-2 backdrop-blur">
                {(["red", "blue"] as const).map((sd) => (
                  <button
                    key={sd}
                    type="button"
                    role="tab"
                    aria-selected={side === sd}
                    onClick={() => setSide(sd)}
                    className={`rounded-tl-xl rounded-br-xl border-2 px-3 py-2 text-left transition ${side === sd ? `${SIDE[sd].cls} border-transparent` : `${SIDE[sd].soft}`}`}
                  >
                    <span className="block font-mono text-[10px] font-bold tracking-wider">{SIDE[sd].label.toUpperCase()}</span>
                    <span className="font-mono text-2xl font-black tabular-nums">{preview ? (sd === "red" ? preview.red.score : (preview.blue?.score ?? 0)) : "—"}</span>
                  </button>
                ))}
              </div>
            )}

            {(versus ? [side] : (["red"] as Side[])).map((sd) => {
              const slots = sd === "red" ? match.red : match.blue;
              const res = preview ? (sd === "red" ? preview.red : preview.blue) : null;
              return (
                <div key={sd} className="mt-4">
                  <div className={`rounded-tl-2xl rounded-br-2xl border-2 p-4 ${SIDE[sd].soft}`}>
                    <p className={`kicker ${SIDE[sd].text}`}>/ ALIANÇA {versus ? SIDE[sd].label.toUpperCase() : ""}</p>
                    <ul className="mt-2 space-y-2">
                      {slots.map((slot) => (
                        <TeamFlagRow
                          key={slot.teamId}
                          team={teamOf.get(slot.teamId)}
                          surrogate={slot.surrogate}
                          value={draft.flags[slot.teamId]}
                          onChange={(f) =>
                            setDraft((d) => {
                              const flags = { ...d.flags };
                              if (f) flags[slot.teamId] = f;
                              else delete flags[slot.teamId];
                              return { ...d, flags };
                            })
                          }
                        />
                      ))}
                    </ul>
                    {res && (
                      <p className="mt-3 text-xs text-base-content/65">
                        Itens {res.base}
                        {cfg.penaltiesTo === "opponent" && versus ? ` · faltas cometidas ${res.penalty} (vão para o adversário)` : ` · penalidades −${res.penalty}`}
                        {res.bonus.length > 0 && ` · ${res.bonus.join(", ")}`}
                      </p>
                    )}
                  </div>
                  <div className="mt-4">
                    <CustomScoreForm
                      challenge={challenge}
                      responses={draft[sd]}
                      onChange={(next) => setDraft((d) => ({ ...d, [sd]: next }))}
                      showImages={s.settings.showMissionImages}
                    />
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </main>

      {match && !done && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-base-content bg-base-100">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 px-4 py-3">
            {s.settings.requireTeamConfirmation && (
              <label className="flex basis-full items-center gap-2 text-sm">
                <input type="checkbox" className="checkbox checkbox-sm checkbox-primary" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                As alianças conferiram a súmula
              </label>
            )}
            <div className="flex-1">
              <p className="text-xs text-base-content/55">Q{match.number}</p>
              {preview && versus ? (
                <p className="font-mono text-3xl font-black tabular-nums">
                  <span className="text-error">{preview.red.score}</span>
                  <span className="mx-2 text-lg opacity-40">×</span>
                  <span className="text-info">{preview.blue?.score ?? 0}</span>
                </p>
              ) : (
                <p className="font-mono text-3xl font-black tabular-nums text-primary">{preview?.red.score ?? 0}</p>
              )}
            </div>
            <button
              type="button"
              className={`btn btn-primary btn-lg ${cornerBtn}`}
              disabled={pending || locked || paused || (s.settings.requireTeamConfirmation && !confirmed)}
              onClick={send}
            >
              {pending ? <span className="loading loading-spinner" /> : <Send size={18} />} Enviar resultado
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TeamFlagRow({
  team,
  surrogate,
  value,
  onChange,
}: {
  team: LiveTeam | undefined;
  surrogate?: boolean;
  value: TeamMatchFlag | undefined;
  onChange: (v: TeamMatchFlag | undefined) => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-2">
      <span className="min-w-0 flex-1 truncate">
        {team?.number && <span className="mr-1.5 font-mono text-xs opacity-70">{team.number}</span>}
        <b>{team?.name ?? "?"}</b>
        {surrogate && <span className="ml-1.5 text-[10px] uppercase opacity-60">surrogate · não conta</span>}
      </span>
      <div className="join">
        {(
          [
            [undefined, "Jogou"],
            ["noshow", "Não veio"],
            ["dq", "Desclass."],
          ] as const
        ).map(([v, label]) => (
          <button
            key={label}
            type="button"
            onClick={() => onChange(v)}
            className={`btn join-item btn-xs ${value === v ? (v === "dq" ? "btn-error" : v === "noshow" ? "btn-warning" : "btn-neutral") : "btn-outline border-base-300 bg-base-100"}`}
          >
            {label}
          </button>
        ))}
      </div>
    </li>
  );
}

function MiniRanking({ snapshot: s }: { snapshot: LiveSnapshot }) {
  const rows = useMemo(
    () =>
      s.alliance
        ? computeAllianceRanking(
            s.teams,
            s.matches.map((m) => ({ ...m, final: m.status === "final" })),
            s.alliance.config,
          )
        : [],
    [s],
  );
  const coop = s.alliance?.config.mode === "coop";
  return (
    <ol className="mt-2 divide-y divide-base-300 rounded-tl-xl rounded-br-xl border border-base-300 bg-base-100 text-sm">
      {rows.slice(0, 12).map((r) => (
        <li key={r.team.id} className="flex items-center gap-3 px-3 py-1.5">
          <span className="w-6 font-mono font-bold">{r.played ? r.rank : "—"}</span>
          <span className="flex-1 truncate">{r.team.name}</span>
          <span className="font-mono text-xs text-base-content/60">{coop ? `${r.avg} méd.` : `${r.wins}-${r.losses}-${r.ties} · ${r.rs} RS`}</span>
        </li>
      ))}
    </ol>
  );
}
