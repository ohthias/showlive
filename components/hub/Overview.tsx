"use client";

import { useMemo, useTransition } from "react";
import Link from "next/link";
import { Activity, ArrowRight, ClipboardCheck, Radio, Timer, Trophy, Tv, Users, WifiOff } from "lucide-react";
import { controlTimer } from "@/app/actions/settings";
import { CameraQuickToggle, ScreenMessageBox } from "./ScreenControls";
import { Bracket } from "@/components/live/Bracket";
import { TimerControls } from "@/components/live/TimerControls";
import { cornerBtn, EmptyState, Panel } from "@/components/ui/brand";
import { useToast } from "@/components/ui/Toast";
import { useLiveEvent } from "@/hooks/useLiveEvent";
import type { LiveActivity, LiveSnapshot } from "@/lib/live-types";
import { computePlayoffs, computeRanking, currentRound, roundProgress } from "@/lib/ranking";
import { computeAllianceRanking } from "@/lib/alliance";
import { CopyChip } from "./CopyChip";
import { ApprovalQueue } from "./ApprovalQueue";
import { formatScore, formatValue, type ScoreFormat } from "@/lib/format";

interface Props {
  initial: LiveSnapshot;
  codes: { id: string; code: string | null; label: string; active: boolean }[];
  isAdmin: boolean;
  canEditScores: boolean;
  site: string;
}

export function Overview({ initial, codes, isAdmin, canEditScores, site }: Props) {
  const { snapshot: s, status, clockOffset } = useLiveEvent(initial, "staff");
  const ranking = useMemo(() => computeRanking(s.teams, s.rounds, s.scores, s.settings), [s]);
  const progress = useMemo(() => roundProgress(s.teams, s.rounds, s.scores), [s]);
  const current = useMemo(() => currentRound(s.teams, s.rounds, s.scores), [s]);
  const playoffs = useMemo(() => computePlayoffs(s.teams, s.rounds, s.scores, s.settings), [s]);
  const qualScores = progress.reduce((a, p) => a + p.done, 0);
  const qualTotal = progress.reduce((a, p) => a + p.total, 0);
  const top = ranking[0];

  // Alianças: a classificação e o progresso vêm das partidas.
  const alliance = s.alliance;
  const aRanking = useMemo(
    () => (alliance ? computeAllianceRanking(s.teams, s.matches.map((m) => ({ ...m, final: m.status === "final" })), alliance.config) : []),
    [alliance, s.teams, s.matches],
  );
  const nextMatch = s.matches.find((m) => m.status === "scheduled");
  const finals = s.matches.filter((m) => m.status === "final").length;
  const teamName = (id: string) => s.teams.find((t) => t.id === id)?.name ?? "?";

  const kpis = alliance
    ? [
        { label: "EQUIPES", value: s.teams.length, icon: Users },
        { label: "PARTIDAS", value: `${finals}/${s.matches.length}`, icon: ClipboardCheck },
        { label: "PRÓXIMA", value: nextMatch ? `Q${nextMatch.number}` : s.matches.length ? "Concluídas" : "—", icon: Radio },
        {
          label: "LÍDER",
          value: aRanking[0]?.played ? `${aRanking[0].team.name} · ${aRanking[0].score}${alliance.config.mode === "coop" ? " pts" : " RS"}` : "—",
          icon: Trophy,
        },
      ]
    : [
    { label: "EQUIPES", value: s.teams.length, icon: Users },
    { label: "NOTAS", value: `${qualScores}/${qualTotal}`, icon: ClipboardCheck },
    {
      label: "RODADA ATUAL",
      value: current?.name ?? (playoffs.phase === "off" || playoffs.phase === "waiting" ? (s.teams.length ? "Concluídas" : "—") : "Playoffs"),
      icon: Radio,
    },
    { label: "LÍDER", value: top && top.evaluated ? `${top.team.name} · ${formatValue(top.score, s.event.scoring)}` : "—", icon: Trophy },
      ];

  return (
    <div className="space-y-6">
      {status !== "live" && (
        <p className="flex items-center gap-2 text-xs text-warning">
          <WifiOff size={14} /> Reconectando ao tempo real…
        </p>
      )}

      {s.teams.length === 0 && isAdmin && (
        <EmptyState icon={<Users size={22} />} title="Comece cadastrando as equipes" text="Cole a lista inteira de uma vez, uma equipe por linha.">
          <Link href={`/hub/${s.event.id}/equipes`} className={`btn btn-primary ${cornerBtn}`}>
            Cadastrar equipes <ArrowRight size={16} />
          </Link>
        </EmptyState>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-tl-2xl rounded-br-2xl border border-base-300 bg-base-100 p-4">
            <div className="flex items-center justify-between">
              <p className="kicker">{label}</p>
              <Icon size={16} className="text-base-content/35" />
            </div>
            <p className="mt-2 truncate text-2xl font-bold tracking-tight">{value}</p>
          </div>
        ))}
      </div>

      {s.settings.submissionsPaused && (
        <p className="rounded-tl-xl rounded-br-xl border-2 border-warning bg-warning/10 px-4 py-3 text-sm font-medium">
          Envios das mesas pausados. Libere em Configurações → Regras das mesas.
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <ApprovalQueue snapshot={s} canEdit={canEditScores} />
          {alliance ? (
            <>
              <Panel
                kicker={`/ ${finals} DE ${s.matches.length}`}
                title="Partidas"
                action={
                  canEditScores && (
                    <Link href={`/hub/${s.event.id}/partidas`} className="btn btn-ghost btn-xs">
                      Gerenciar <ArrowRight size={13} />
                    </Link>
                  )
                }
              >
                {s.matches.length ? (
                  <>
                    <progress className="progress progress-primary h-2" value={finals} max={Math.max(1, s.matches.length)} />
                    <ul className="mt-3 divide-y divide-base-300 text-sm">
                      {s.matches
                        .filter((m) => m.status !== "final")
                        .slice(0, 4)
                        .map((m) => (
                          <li key={m.id} className="flex items-center gap-3 py-2">
                            <span className="w-10 font-mono font-bold">Q{m.number}</span>
                            <span className="min-w-0 flex-1 truncate">
                              <span className="text-error">{m.red.map((x) => teamName(x.teamId)).join(" + ")}</span>
                              {m.blue.length > 0 && (
                                <>
                                  <span className="mx-1.5 opacity-40">×</span>
                                  <span className="text-info">{m.blue.map((x) => teamName(x.teamId)).join(" + ")}</span>
                                </>
                              )}
                            </span>
                            {m.status === "pending" && <span className="font-mono text-[10px] text-warning">AGUARDANDO</span>}
                          </li>
                        ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-sm text-base-content/60">
                    Nenhuma partida ainda.{" "}
                    {isAdmin && (
                      <Link href={`/hub/${s.event.id}/partidas`} className="link">
                        Gerar o cronograma
                      </Link>
                    )}
                  </p>
                )}
              </Panel>
              <Panel kicker="/ AO VIVO" title="Classificação">
                <ol className="divide-y divide-base-300">
                  {aRanking.slice(0, 10).map((r) => (
                    <li key={r.team.id} className="flex items-center gap-3 py-2">
                      <span className={`grid size-7 place-items-center rounded-tl-md rounded-br-md font-mono text-xs font-bold ${r.rank === 1 && r.played ? "bg-accent text-accent-content" : "bg-base-200"}`}>
                        {r.played ? r.rank : "—"}
                      </span>
                      <span className="flex-1 truncate font-medium">{r.team.name}</span>
                      {alliance.config.mode === "versus" && (
                        <span className="font-mono text-xs text-base-content/50">
                          {r.wins}-{r.losses}-{r.ties}
                        </span>
                      )}
                      <span className="w-20 text-right font-mono font-bold tabular-nums">{r.played ? r.score : "—"}</span>
                    </li>
                  ))}
                </ol>
              </Panel>
            </>
          ) : (
          <>
          <Panel kicker="/ PROGRESSO" title="Rodadas">
            {progress.length ? (
              <ul className="space-y-3">
                {progress.map((p) => (
                  <li key={p.round.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">
                        {p.round.name}
                        {current?.id === p.round.id && <span className="ml-2 font-mono text-[10px] font-bold tracking-wider text-primary">EM ANDAMENTO</span>}
                      </span>
                      <span className="font-mono text-xs text-base-content/60">
                        {p.done}/{p.total}
                      </span>
                    </div>
                    <progress className={`progress mt-1.5 h-2 ${p.complete ? "progress-success" : "progress-primary"}`} value={p.done} max={Math.max(1, p.total)} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-base-content/60">Nenhuma rodada configurada.</p>
            )}
          </Panel>

          <Panel
            kicker="/ AO VIVO"
            title="Classificação"
            action={
              isAdmin && (
                <Link href={`/hub/${s.event.id}/pontuacoes`} className="btn btn-ghost btn-xs">
                  Todas as notas <ArrowRight size={13} />
                </Link>
              )
            }
          >
            {ranking.length ? (
              <ol className="divide-y divide-base-300">
                {ranking.slice(0, 10).map((r) => (
                  <li key={r.team.id} className="flex items-center gap-3 py-2">
                    <span
                      className={`grid size-7 place-items-center rounded-tl-md rounded-br-md font-mono text-xs font-bold ${
                        r.rank === 1 && r.evaluated ? "bg-accent text-accent-content" : "bg-base-200"
                      }`}
                    >
                      {r.rank}
                    </span>
                    <span className="flex-1 truncate font-medium">{r.team.name}</span>
                    <span className="font-mono text-xs text-base-content/50">{r.evaluated} rod.</span>
                    <span className="w-20 text-right font-mono font-bold tabular-nums">{r.evaluated ? formatValue(r.score, s.event.scoring) : "—"}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-base-content/60">Sem equipes.</p>
            )}
          </Panel>
          </>
          )}

          {playoffs.phase !== "off" && (
            <Panel kicker="/ PLAYOFFS" title={playoffs.phase === "waiting" ? "Aguardando as classificatórias" : "Chave"}>
              {playoffs.phase === "waiting" ? (
                <p className="text-sm text-base-content/60">A chave aparece quando todas as equipes tiverem nota em todas as rodadas.</p>
              ) : (
                <Bracket playoffs={playoffs} dense f={s.event.scoring} />
              )}
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          <Panel kicker="/ CRONÔMETRO" title="Tempo da partida" action={<Timer size={16} className="text-base-content/40" />}>
            <TimerControls eventId={s.event.id} timer={s.event.timer} clockOffset={clockOffset} />
            <DurationPicker eventId={s.event.id} current={s.event.timer.durationSec} />
            {!s.settings.showTimer && isAdmin && (
              <p className="mt-3 text-xs text-base-content/55">
                O cronômetro está oculto no telão.{" "}
                <Link className="link" href={`/hub/${s.event.id}/telao`}>
                  Mostrar
                </Link>
              </p>
            )}
          </Panel>

          <Panel kicker="/ CÓDIGOS" title="Compartilhe">
            {!s.event.code ? (
              <div className="space-y-2 text-sm">
                <p className="font-medium">Nenhum código ativo.</p>
                <p className="text-base-content/60">
                  Os códigos do telão e das mesas são gerados quando você colocar o evento <b>Ao vivo</b> e deixam de valer quando ele sair do ar.
                </p>
                <Link href={`/hub/${s.event.id}/previa`} target="_blank" className="btn btn-sm btn-outline mt-1">
                  <Tv size={14} /> Prévia do telão
                </Link>
              </div>
            ) : (
            <div className="space-y-3">
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs text-base-content/60">
                  <Tv size={13} /> Público (telão)
                </p>
                <CopyChip value={`${site}/e/${s.event.code}`} display={s.event.code} />
              </div>
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs text-base-content/60">
                  <ClipboardCheck size={13} /> Mesas de arbitragem
                </p>
                <div className="flex flex-wrap gap-2">
                  {codes.filter((c) => c.active && c.code).map((c) => (
                    <CopyChip key={c.id} label={c.label.toUpperCase()} value={c.code!} />
                  ))}
                  {!codes.some((c) => c.active && c.code) && <span className="text-sm text-base-content/55">Nenhuma mesa ativa.</span>}
                </div>
              </div>
              <p className="text-xs text-base-content/50">
                Os dois tipos de código entram em <b>{site.replace(/^https?:\/\//, "")}/entrar</b>.
              </p>
            </div>
            )}
          </Panel>

          {isAdmin && <ScreenMessageBox eventId={s.event.id} current={s.settings.screenMessage} clockOffset={clockOffset} />}
          {isAdmin && <CameraQuickToggle eventId={s.event.id} camera={s.settings.camera} />}

          <Panel kicker="/ HISTÓRICO" title="Atividade" action={<Activity size={16} className="text-base-content/40" />}>
            <ActivityFeed items={s.activity} f={s.event.scoring} />
          </Panel>
        </div>
      </div>
    </div>
  );
}

function DurationPicker({ eventId, current }: { eventId: string; current: number }) {
  const [pending, start] = useTransition();
  const { addToast } = useToast();
  const set = (sec: number) =>
    start(async () => {
      const r = await controlTimer(eventId, "duration", sec);
      if (!r.ok) addToast(r.error, "error");
    });
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {[150, 180, 300, 600].map((sec) => (
        <button
          key={sec}
          type="button"
          disabled={pending}
          onClick={() => set(sec)}
          className={`btn btn-xs ${current === sec ? "btn-neutral" : "btn-ghost border-base-300"}`}
        >
          {Math.floor(sec / 60)}:{String(sec % 60).padStart(2, "0")}
        </button>
      ))}
      <span className="text-xs text-base-content/50">2:30 é o tempo oficial da partida</span>
    </div>
  );
}

const fmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

function ActivityFeed({ items, f }: { items: LiveActivity[]; f: ScoreFormat }) {
  const v = (n?: number) => (n === undefined ? "?" : formatScore(n, f));
  if (!items.length) return <p className="text-sm text-base-content/55">Nada por aqui ainda.</p>;
  return (
    <ol className="space-y-2.5">
      {items.slice(0, 12).map((a) => {
        const p = a.payload;
        let text: string;
        switch (a.kind) {
          case "score":
            text = `${p.team} · ${p.round}: ${v(p.points)}`;
            break;
          case "score_edit":
            text = `Correção ${p.team} · ${p.round}: ${v(p.previous)} → ${v(p.points)}`;
            break;
          case "score_void":
            text = `Nota apagada ${p.team} · ${p.round} (era ${v(p.previous)})`;
            break;
          case "scores_reset":
            text = "Todas as notas foram zeradas";
            break;
          case "event_created":
            text = "Evento criado";
            break;
          case "message":
            text = `• ${p.message}`;
            break;
          case "announcement":
            text = `📣 Aviso no telão: ${p.message}`;
            break;
          case "score_pending":
            text = `⏳ ${p.team} · ${p.round}: ${v(p.points)} (aguardando aprovação)`;
            break;
          case "score_rejected":
            text = `✕ Nota rejeitada ${p.team} · ${p.round} (era ${v(p.previous)})`;
            break;
          case "challenge_edit":
            text = `✎ ${p.message}`;
            break;
          case "match":
            text = `⚔ ${p.message}`;
            break;
          case "match_pending":
            text = `⏳ ${p.message} (aguardando aprovação)`;
            break;
          default:
            text = a.kind;
        }
        return (
          <li key={a.id} className="flex gap-3 text-sm">
            <span className="w-11 shrink-0 font-mono text-xs text-base-content/45">{fmt.format(a.at)}</span>
            <span className="min-w-0">
              <span className="block">{text}</span>
              {p.by && a.kind !== "message" && <span className="block text-xs text-base-content/50">{p.by}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
