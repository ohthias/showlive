"use client";

import { useEffect, useMemo, useState } from "react";
import { computeAllianceRanking, tiebreakerLabel, type AllianceRankRow } from "@/lib/alliance";
import type { LiveMatch, LiveSnapshot, LiveTeam } from "@/lib/live-types";

const RED = "#e5484d";
const BLUE = "#3b82f6";
const SLIDE_MS = 12_000;
const timeFmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

const MEDALS = [
  { bg: "linear-gradient(135deg,#ffe27a,#e0a821)", fg: "#2a1d00" },
  { bg: "linear-gradient(135deg,#f1f4f8,#aab4c0)", fg: "#1c2229" },
  { bg: "linear-gradient(135deg,#f0b27f,#b8693a)", fg: "#2a1405" },
];

/**
 * Telão do formato de alianças: classificação (RP, V-D-E, desempates),
 * último resultado e próximas partidas. Usa as variáveis de tema do telão.
 */
export function AllianceBoard({
  snapshot: s,
  medals,
  showDetails,
  highlight,
  rowsPerPage,
}: {
  snapshot: LiveSnapshot;
  medals: boolean;
  showDetails: boolean;
  highlight: boolean;
  rowsPerPage: number;
}) {
  const cfg = s.alliance!.config;
  const versus = cfg.mode === "versus";
  const ranking = useMemo(
    () => computeAllianceRanking(s.teams, s.matches.map((m) => ({ ...m, final: m.status === "final" })), cfg),
    [s.teams, s.matches, cfg],
  );
  const teamOf = useMemo(() => new Map(s.teams.map((t) => [t.id, t])), [s.teams]);
  const finals = s.matches.filter((m) => m.status === "final");
  const last = [...finals].sort((a, b) => b.updated - a.updated)[0] ?? null;
  const upcoming = s.matches.filter((m) => m.status !== "final").slice(0, 5);

  const per = Math.max(5, rowsPerPage);
  const pages = Math.max(1, Math.ceil(ranking.length / per));
  const perPage = Math.max(1, Math.ceil(ranking.length / pages));
  const slides = useMemo(() => {
    const list: ({ kind: "ranking"; page: number } | { kind: "matches" })[] = [];
    if (s.matches.length) list.push({ kind: "matches" });
    for (let p = 0; p < pages; p++) list.push({ kind: "ranking", page: p });
    return list;
  }, [pages, s.matches.length]);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (slides.length <= 1) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % slides.length), SLIDE_MS);
    return () => clearInterval(id);
  }, [slides.length]);
  const slide = slides[idx % slides.length] ?? { kind: "ranking", page: 0 };

  const primary = cfg.rankBy === "score_avg" ? "MÉDIA" : cfg.rankBy === "rp_total" ? "RP" : "RS";

  return (
    <>
      {/* Faixa de progresso */}
      <div className="mb-4 flex flex-wrap gap-2 font-mono text-[11px] font-bold tracking-wider md:text-xs">
        <span className="tv-r border border-current/15 px-3 py-1.5">
          PARTIDAS · {finals.length}/{s.matches.length}
        </span>
        {upcoming[0] && (
          <span className="tv-r px-3 py-1.5" style={{ background: "color-mix(in oklab, var(--tv-accent) 22%, transparent)" }}>
            PRÓXIMA · Q{upcoming[0].number}
            {upcoming[0].at ? ` · ${timeFmt.format(upcoming[0].at)}` : ""}
          </span>
        )}
      </div>

      {/* Celular */}
      <div className="space-y-6 md:hidden">
        {upcoming[0] && <MatchCard match={upcoming[0]} teamOf={teamOf} versus={versus} title="PRÓXIMA PARTIDA" />}
        {last && <MatchCard match={last} teamOf={teamOf} versus={versus} title="ÚLTIMO RESULTADO" />}
        <RankingTable rows={ranking} versus={versus} primary={primary} tiebreakers={cfg.tiebreakers} medals={medals} showDetails={false} highlight={highlight} compact />
      </div>

      {/* Telão */}
      <div className="hidden md:block">
        <div key={`${slide.kind}-${slide.kind === "ranking" ? slide.page : ""}`} className="tv-slide">
          {slide.kind === "ranking" ? (
            <RankingTable
              rows={ranking.slice(slide.page * perPage, (slide.page + 1) * perPage)}
              versus={versus}
              primary={primary}
              tiebreakers={cfg.tiebreakers}
              medals={medals}
              showDetails={showDetails}
              highlight={highlight}
            />
          ) : (
            <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
              {last ? (
                <MatchCard match={last} teamOf={teamOf} versus={versus} title="ÚLTIMO RESULTADO" big />
              ) : (
                <div className="tv-panel tv-r-xl grid place-items-center p-10 text-xl opacity-70">Nenhuma partida jogada ainda.</div>
              )}
              <div className="tv-panel tv-r-xl p-6">
                <p className="font-mono text-xs font-bold tracking-[0.2em] opacity-60">PRÓXIMAS PARTIDAS</p>
                {upcoming.length ? (
                  <ul className="mt-4 space-y-3">
                    {upcoming.map((m) => (
                      <li key={m.id} className="flex items-center gap-4">
                        <div className="w-20 shrink-0">
                          <p className="tv-num text-3xl font-black">Q{m.number}</p>
                          <p className="font-mono text-xs opacity-60">
                            {m.at ? timeFmt.format(m.at) : ""}
                            {m.field ? ` · ${m.field}` : ""}
                          </p>
                        </div>
                        <div className={`grid flex-1 gap-2 ${versus ? "grid-cols-2" : ""}`}>
                          <Side color={RED} slots={m.red} teamOf={teamOf} />
                          {versus && <Side color={BLUE} slots={m.blue} teamOf={teamOf} />}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-lg opacity-70">Classificatórias encerradas.</p>
                )}
              </div>
            </div>
          )}
        </div>
        {slides.length > 1 && (
          <div className="mt-5 flex justify-center gap-2" aria-hidden>
            {slides.map((_, i) => (
              <span
                key={i}
                className="h-1.5 rounded-full transition-all duration-500"
                style={{ width: i === idx % slides.length ? 40 : 8, background: i === idx % slides.length ? "var(--tv-accent)" : "color-mix(in oklab, currentColor 25%, transparent)" }}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function Side({ color, slots, teamOf, big = false }: { color: string; slots: LiveMatch["red"]; teamOf: Map<string, LiveTeam>; big?: boolean }) {
  return (
    <div className="tv-r border-l-4 px-3 py-1.5" style={{ borderColor: color, background: `color-mix(in oklab, ${color} 14%, transparent)` }}>
      {slots.map((x) => {
        const t = teamOf.get(x.teamId);
        return (
          <p key={x.teamId} className={`truncate font-bold ${big ? "text-2xl" : "text-base"}`}>
            {t?.number && <span className="tv-num mr-2 text-sm opacity-60">{t.number}</span>}
            {t?.name ?? "?"}
            {x.surrogate && <span className="ml-1 text-xs opacity-50">*</span>}
          </p>
        );
      })}
    </div>
  );
}

function MatchCard({ match: m, teamOf, versus, title, big = false }: { match: LiveMatch; teamOf: Map<string, LiveTeam>; versus: boolean; title: string; big?: boolean }) {
  const r = m.result;
  const red = r?.red.score;
  const blue = r?.blue?.score;
  const winner = r && versus ? ((red ?? 0) > (blue ?? 0) ? "red" : (blue ?? 0) > (red ?? 0) ? "blue" : "tie") : null;
  return (
    <div className="tv-panel tv-r-xl p-5 md:p-8">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-xs font-bold tracking-[0.2em] opacity-60">{title}</p>
        <p className="tv-num text-2xl font-black md:text-4xl">Q{m.number}</p>
      </div>
      <div className={`mt-4 grid items-center gap-4 ${versus ? "grid-cols-[1fr_auto_1fr]" : ""}`}>
        <div>
          <Side color={RED} slots={m.red} teamOf={teamOf} big={big} />
          {r && (
            <p className={`tv-num mt-2 font-black ${big ? "text-7xl 2xl:text-8xl" : "text-5xl"}`} style={{ color: RED }}>
              {red}
            </p>
          )}
          {r && r.red.bonus.length > 0 && <p className="mt-1 text-xs opacity-70">+ {r.red.bonus.join(" · ")}</p>}
        </div>
        {versus && <span className="text-2xl font-black opacity-40">×</span>}
        {versus && (
          <div className="text-right">
            <Side color={BLUE} slots={m.blue} teamOf={teamOf} big={big} />
            {r && (
              <p className={`tv-num mt-2 font-black ${big ? "text-7xl 2xl:text-8xl" : "text-5xl"}`} style={{ color: BLUE }}>
                {blue}
              </p>
            )}
            {r?.blue && r.blue.bonus.length > 0 && <p className="mt-1 text-xs opacity-70">+ {r.blue.bonus.join(" · ")}</p>}
          </div>
        )}
      </div>
      {winner && (
        <p className="mt-4 text-center font-mono text-sm font-bold tracking-[0.2em]" style={{ color: winner === "red" ? RED : winner === "blue" ? BLUE : undefined }}>
          {winner === "tie" ? "EMPATE" : `VITÓRIA DA ALIANÇA ${winner === "red" ? "VERMELHA" : "AZUL"}`}
        </p>
      )}
      {!r && m.at && <p className="mt-3 font-mono text-sm opacity-60">{timeFmt.format(m.at)}{m.field ? ` · ${m.field}` : ""}</p>}
    </div>
  );
}

function RankingTable({
  rows,
  versus,
  primary,
  tiebreakers,
  medals,
  showDetails,
  highlight,
  compact = false,
}: {
  rows: AllianceRankRow[];
  versus: boolean;
  primary: string;
  tiebreakers: string[];
  medals: boolean;
  showDetails: boolean;
  highlight: boolean;
  compact?: boolean;
}) {
  const py = compact ? "py-2" : "py-2.5";
  const tbs = compact ? tiebreakers.slice(0, 0) : tiebreakers.slice(0, 2);
  return (
    <div className="tv-panel tv-r-xl overflow-hidden">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="font-mono text-[10px] font-bold tracking-[0.18em] md:text-xs" style={{ background: "var(--tv-accent)", color: "var(--tv-bg)" }}>
            <th className="w-16 px-3 py-3 text-center md:w-24">#</th>
            <th className="px-3">EQUIPE</th>
            {versus && <th className="w-28 px-3 text-center">V-D-E</th>}
            {tbs.map((t) => (
              <th key={t} className="hidden w-36 px-3 text-center lg:table-cell">
                {tiebreakerLabel(t).toUpperCase()}
              </th>
            ))}
            <th className="w-16 px-3 text-center">J</th>
            <th className="w-28 px-4 text-right md:w-36">{primary}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const leader = highlight && r.rank === 1 && r.played > 0;
            const medal = medals && r.played && r.rank <= 3 ? MEDALS[r.rank - 1] : null;
            return (
              <tr
                key={r.team.id}
                className={`tv-row-enter border-t ${leader ? "tv-shimmer" : ""}`}
                style={{
                  borderColor: "var(--tv-line)",
                  animationDelay: `${i * 45}ms`,
                  ...(leader ? { background: "color-mix(in oklab, var(--tv-accent) 16%, transparent)" } : i % 2 ? { background: "color-mix(in oklab, var(--tv-text) 3%, transparent)" } : {}),
                }}
              >
                <td className={`px-3 ${py} text-center`}>
                  <span
                    className="tv-num tv-r inline-grid min-w-9 place-items-center px-2 py-1 text-lg font-black md:text-xl"
                    style={medal ? { background: medal.bg, color: medal.fg } : undefined}
                  >
                    {r.played ? r.rank : "—"}
                  </span>
                </td>
                <td className={`px-3 ${py}`}>
                  <p className={`tv-display truncate font-bold ${compact ? "text-base" : "text-xl 2xl:text-2xl"}`}>{r.team.name}</p>
                  {showDetails && (r.team.number || r.team.organization) && (
                    <p className="truncate text-xs opacity-60">{[r.team.number, r.team.organization].filter(Boolean).join(" · ")}</p>
                  )}
                </td>
                {versus && (
                  <td className={`tv-num px-3 ${py} text-center ${compact ? "text-sm" : "text-xl"} opacity-85`}>
                    {r.wins}-{r.losses}-{r.ties}
                  </td>
                )}
                {tbs.map((t, k) => (
                  <td key={t} className={`tv-num hidden px-3 ${py} text-center text-lg opacity-75 lg:table-cell`}>
                    {r.played ? r.tb[k] : "—"}
                  </td>
                ))}
                <td className={`tv-num px-3 ${py} text-center opacity-70`}>{r.played}</td>
                <td className={`tv-num px-4 ${py} text-right font-black ${compact ? "text-xl" : "text-3xl"}`}>{r.played ? r.score : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
