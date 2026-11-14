"use client";

import "./tv-fonts";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Expand, Lock, LogOut, Minimize, Search, Trophy, WifiOff } from "lucide-react";
import { useLiveEvent } from "@/hooks/useLiveEvent";
import type { EventTheme } from "@/db/schema";
import type { LiveActivity, LiveSnapshot } from "@/lib/live-types";
import {
  computeExtraRanking,
  computePlayoffs,
  computeRanking,
  currentRound,
  qualifyingRounds,
  roundProgress,
  type RankingRow,
} from "@/lib/ranking";
import { FONTS, fontCss, isVideo, numFontCss, resolveTvStyle, sanitizeTheme, type TvStyle } from "@/lib/themes";
import { Bracket } from "./Bracket";
import { AllianceBoard } from "./AllianceBoard";
import { CameraFeed, CameraMenu, useLocalCamera } from "./CameraFeed";
import { ScreenBanner } from "./ScreenBanner";
import { TimerDisplay } from "./TimerDisplay";
import { QrBadge } from "./QrBadge";
import { useWakeLock } from "@/hooks/useWakeLock";
import { bestLabel, formatClockTime, formatScore, formatValue, type ScoreFormat } from "@/lib/format";

const SLIDE_MS = 12_000;
const CELEBRATE_MS = 5_000;
const MOVE_MS = 25_000;

const MEDALS = [
  { bg: "linear-gradient(135deg,#ffe27a,#e0a821)", fg: "#2a1d00" },
  { bg: "linear-gradient(135deg,#f1f4f8,#aab4c0)", fg: "#1c2229" },
  { bg: "linear-gradient(135deg,#f0b27f,#b8693a)", fg: "#2a1405" },
];

type Slide = { kind: "ranking"; page: number } | { kind: "bracket" } | { kind: "podium" } | { kind: "extra"; roundId: string };
type Moves = Map<string, number>;

export function Telao({ initial, preview = false }: { initial: LiveSnapshot; preview?: boolean }) {
  const { snapshot: s, status, clockOffset } = useLiveEvent(initial, "public", { enabled: !preview });
  useWakeLock(!preview);
  const f = s.event.scoring;

  /* Na prévia do hub, o editor manda o rascunho do tema por postMessage. */
  const [draftTheme, setDraftTheme] = useState<EventTheme | null>(null);
  useEffect(() => {
    if (!preview) return;
    const on = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== "showlive:theme") return;
      setDraftTheme(sanitizeTheme(e.data.theme, s.event.theme));
    };
    window.addEventListener("message", on);
    window.parent?.postMessage({ type: "showlive:preview-ready" }, window.location.origin);
    return () => window.removeEventListener("message", on);
  }, [preview, s.event.theme]);
  const theme = draftTheme ?? s.event.theme;
  const style = resolveTvStyle(theme);
  const [bg, accent, text] = theme.colors;
  const caps = FONTS.find((x) => x.id === style.font)?.caps;

  const ranking = useMemo(() => computeRanking(s.teams, s.rounds, s.scores, s.settings), [s]);
  const playoffs = useMemo(() => computePlayoffs(s.teams, s.rounds, s.scores, s.settings), [s]);
  const progress = useMemo(() => roundProgress(s.teams, s.rounds, s.scores), [s]);
  const current = useMemo(() => currentRound(s.teams, s.rounds, s.scores), [s]);
  const quals = useMemo(() => qualifyingRounds(s.rounds), [s.rounds]);
  const flashed = useFlashedTeams(s);
  const moves = useRankMoves(ranking);
  const celebration = useCelebrations(s.activity, s.settings.celebrateScores);

  /* --------------------------------------------------------- slides */
  const maxPerPage = Math.round(Math.max(5, s.settings.rowsPerPage) * (style.layout === "split" ? 2 : style.layout === "compact" ? 1.5 : 1));
  const pages = Math.max(1, Math.ceil(ranking.length / maxPerPage));
  /* distribui por igual: 12 equipes em 2 páginas = 6 + 6, não 10 + 2 */
  const perPage = Math.max(1, Math.ceil(ranking.length / pages));
  const slides: Slide[] = useMemo(() => {
    const list: Slide[] = [];
    if (s.event.status === "finished" && ranking.length >= 3 && ranking[0].evaluated > 0) list.push({ kind: "podium" });
    for (let p = 0; p < pages; p++) list.push({ kind: "ranking", page: p });
    if (s.settings.showBrackets && ["semifinal", "final", "done"].includes(playoffs.phase)) list.push({ kind: "bracket" });
    for (const r of s.rounds)
      if (r.kind === "extra" && s.scores.some((x) => x.roundId === r.id)) list.push({ kind: "extra", roundId: r.id });
    return list;
  }, [pages, playoffs.phase, s.settings.showBrackets, s.event.status, ranking, s.rounds, s.scores]);
  const tbIdx = useMemo(() => {
    const m = new Map<string, number | null | undefined>();
    for (const x of s.scores) m.set(`${x.teamId}:${x.roundId}`, x.tb);
    return m;
  }, [s.scores]);
  const showTb = s.event.format === "obr";

  const [slideIdx, setSlideIdx] = useState(0);
  useEffect(() => {
    if (slides.length <= 1) return;
    const id = setInterval(() => setSlideIdx((i) => (i + 1) % slides.length), SLIDE_MS);
    return () => clearInterval(id);
  }, [slides.length]);
  const activeSlide = slideIdx % slides.length;
  const slide = slides[activeSlide] ?? slides[0];

  /* ---------------------------------------------------- tela cheia */
  const [full, setFull] = useState(false);
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const toggleFull = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());

  /* ------------------------------------------------------- câmera */
  const cam = s.settings.camera;
  const [localCam, setLocalCam] = useLocalCamera(s.event.id);
  // Câmera do aparelho só liga onde o operador ativou; transmissão por link aparece em todas as telas.
  const camOn = cam.enabled && (cam.source === "url" || preview || localCam.use);
  // Um só player por vez (a câmera local não deve abrir duas vezes): decide pelo tamanho da tela.
  const [desktop, setDesktop] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const on = () => setDesktop(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const camMobile = camOn && desktop === false;
  const camDesk = camOn && desktop === true;
  const camFeed = (extra = "") => <CameraFeed camera={cam} deviceId={localCam.deviceId} preview={preview} className={extra} />;
  const pipWidth = { s: "22vw", m: "30vw", l: "38vw" }[cam.size];
  const pipPos = { br: "bottom-24 right-6", bl: "bottom-24 left-6", tr: "top-6 right-6", tl: "top-6 left-6" }[cam.corner];

  const statusBadge =
    s.event.status === "live" ? "AO VIVO" : s.event.status === "finished" ? "RESULTADO FINAL" : "EM PREPARAÇÃO";

  const vars = {
    "--tv-bg": bg,
    "--tv-accent": accent,
    "--tv-text": text,
    "--tv-2": style.secondary,
    "--tv-font": fontCss(style.font),
    "--tv-num": numFontCss(style),
    "--slide-ms": `${SLIDE_MS}ms`,
    color: text,
    backgroundColor: bg,
  } as React.CSSProperties;

  const boardProps = {
    rounds: quals,
    mode: s.settings.rankingMode,
    f,
    tb: showTb ? (t: string, r: string) => tbIdx.get(`${t}:${r}`) : null,
    showDetails: s.settings.showTeamDetails,
    highlight: s.settings.highlightLeader,
    flashed,
    moves: style.rankMoves ? moves : new Map(),
    medals: style.medals,
    animate: style.motion !== "off",
  };

  return (
    <div
      className="tv-root relative isolate min-h-dvh overflow-hidden"
      style={vars}
      data-corners={style.corners}
      data-panel={style.panel}
      data-motion={style.motion}
      data-layout={style.layout}
      data-caps={caps ? "1" : "0"}
    >
      <Background theme={theme} style={style} />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-[1680px] flex-col px-4 py-4 md:px-10 md:py-6">
        {/* ------------------------------------------------ topo */}
        <header className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {theme.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={theme.logoUrl} alt="" className="h-12 w-auto md:h-16" />
          )}
          <div className="order-first min-w-0 basis-full md:order-none md:basis-0 md:flex-1">
            <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] font-bold tracking-[0.2em] md:text-xs">
              <span className="tv-r inline-flex items-center gap-1.5 px-2 py-1" style={{ background: accent, color: bg }}>
                {s.event.status === "live" && <span className="live-dot" />}
                {statusBadge}
              </span>
              <span className="opacity-60">
                {s.event.format === "obr" ? "OBR" : s.event.format === "custom" ? "DESAFIO" : s.event.format === "alliance" ? "ALIANÇAS" : "FLL"} ·{" "}
                {s.event.seasonLabel.toUpperCase()}
              </span>
              {preview && (
                <span className="tv-r border border-current/30 px-2 py-1">PRÉVIA · {s.event.code ? "AO VIVO" : "FORA DO AR"}</span>
              )}
              {status !== "live" && !preview && (
                <span className="inline-flex items-center gap-1 opacity-70">
                  <WifiOff size={12} /> {status === "offline" ? "SEM CONEXÃO" : "CONECTANDO"}
                </span>
              )}
            </div>
            <h1 className="tv-display mt-2 text-3xl font-black leading-[1.05] tracking-tight md:truncate md:text-5xl 2xl:text-6xl">
              {s.event.name}
            </h1>
            <span className="mt-2 block h-1 w-20 rounded-full" style={{ background: `linear-gradient(90deg, ${accent}, ${style.secondary})` }} />
            {s.event.challenge?.objective && (
              <p className="mt-2 hidden max-w-3xl truncate text-sm opacity-60 md:block">{s.event.challenge.objective}</p>
            )}
          </div>

          {s.settings.showTimer && (
            <div className="tv-panel tv-r-lg flex items-center gap-3 px-4 py-1.5 md:block md:px-5 md:py-2 md:text-right">
              <p className="font-mono text-[10px] font-bold tracking-[0.2em] opacity-60">CRONÔMETRO</p>
              <TimerDisplay timer={s.event.timer} clockOffset={clockOffset} className="tv-num text-2xl md:text-6xl" />
            </div>
          )}

          <div className={`ml-auto flex items-center gap-1 opacity-40 transition hover:opacity-100 md:ml-0 ${preview ? "hidden" : ""}`}>
            {cam.enabled && cam.source === "local" && (
              <span className="hidden md:block">
                <CameraMenu pref={localCam} onChange={setLocalCam} />
              </span>
            )}
            <button type="button" onClick={toggleFull} className="btn btn-ghost btn-sm btn-square text-current" aria-label="Tela cheia">
              {full ? <Minimize size={18} /> : <Expand size={18} />}
            </button>
            <Link href="/entrar" className="btn btn-ghost btn-sm btn-square text-current" aria-label="Sair">
              <LogOut size={18} />
            </Link>
          </div>
        </header>

        {!(camDesk && cam.layout === "full") && (
          <ScreenBanner message={s.settings.screenMessage} clockOffset={clockOffset} accent={accent} bg={bg} secondary={style.secondary} />
        )}

        {/* ------------------------------------------ progresso */}
        {quals.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {progress.map((p) => {
              const active = current?.id === p.round.id;
              const pct = p.total ? (p.done / p.total) * 100 : 0;
              return (
                <div
                  key={p.round.id}
                  className={`tv-r relative isolate overflow-hidden border px-3 py-1.5 font-mono text-[11px] font-bold tracking-wider md:text-xs ${
                    active ? "border-transparent" : "border-current/15 opacity-70"
                  }`}
                  style={active ? { background: `color-mix(in oklab, ${accent} 22%, transparent)` } : undefined}
                >
                  <span className="absolute inset-y-0 left-0 -z-10 opacity-45 transition-[width] duration-700" style={{ width: `${pct}%`, background: accent }} />
                  {p.round.name.toUpperCase()} · {p.complete ? "✓" : `${p.done}/${p.total}`}
                </div>
              );
            })}
            {playoffs.phase !== "off" && playoffs.phase !== "waiting" && (
              <div className="tv-r px-3 py-1.5 font-mono text-[11px] font-bold tracking-wider md:text-xs" style={{ background: accent, color: bg }}>
                PLAYOFFS · {playoffs.phase === "done" ? "ENCERRADOS" : playoffs.phase === "semifinal" ? "SEMIFINAL" : "FINAL"}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------- conteúdo */}
        <main className="mt-5 flex-1">
          {/* Câmera no celular: sempre no fluxo, acima da classificação. */}
          {camMobile && <div className="mb-5">{camFeed()}</div>}
          {camDesk && cam.layout === "full" ? (
            <div className="relative">
              {camFeed("mx-auto max-h-[calc(100dvh-16rem)]")}
              <ScreenBanner message={s.settings.screenMessage} clockOffset={clockOffset} accent={accent} bg={bg} secondary={style.secondary} overlay />
            </div>
          ) : null}
          <div
            className={
              camDesk && cam.layout === "full"
                ? "hidden"
                : camDesk && cam.layout === "split"
                  ? "md:grid md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:items-start md:gap-6"
                  : ""
            }
          >
          <div className="min-w-0">
          {s.teams.length === 0 ? (
            <Waiting text="As equipes ainda estão sendo cadastradas." />
          ) : s.alliance ? (
            <AllianceBoard
              snapshot={s}
              medals={style.medals}
              showDetails={s.settings.showTeamDetails}
              highlight={s.settings.highlightLeader}
              rowsPerPage={Math.round(Math.max(5, s.settings.rowsPerPage) * (style.layout === "compact" ? 1.5 : 1))}
            />
          ) : (
            <>
              {/* Celular: lista completa com busca */}
              <div className="md:hidden">
                <MobileList ranking={ranking} rounds={quals} highlight={s.settings.highlightLeader} flashed={flashed} f={f} medals={style.medals} />
                {s.settings.showBrackets && ["semifinal", "final", "done"].includes(playoffs.phase) && (
                  <div className="mt-8">
                    <p className="mb-3 font-mono text-xs font-bold tracking-[0.2em] opacity-60">PLAYOFFS</p>
                    <Bracket playoffs={playoffs} dense f={s.event.scoring} />
                  </div>
                )}
              </div>

              {/* Telão */}
              <div className="hidden md:block">
                <div key={`${slide.kind}-${slide.kind === "ranking" ? slide.page : slide.kind === "extra" ? slide.roundId : ""}-${style.layout}`} className="tv-slide">
                  {slide.kind === "ranking" &&
                    (() => {
                      const rows = ranking.slice(slide.page * perPage, (slide.page + 1) * perPage);
                      if (style.layout === "cards") return <CardsBoard rows={rows} {...boardProps} />;
                      if (style.layout === "split") return <SplitBoard rows={rows} {...boardProps} />;
                      return <TableBoard rows={rows} compact={style.layout === "compact"} {...boardProps} />;
                    })()}
                  {slide.kind === "bracket" && (
                    <div className="tv-panel tv-r-xl p-10">
                      <Bracket playoffs={playoffs} f={s.event.scoring} />
                    </div>
                  )}
                  {slide.kind === "podium" && <Podium rows={ranking} champion={playoffs.champion?.name} f={f} medals={style.medals} />}
                  {slide.kind === "extra" && <ExtraBoard snapshot={s} roundId={slide.roundId} medals={style.medals} />}
                </div>

                {slides.length > 1 && (
                  <div className="mt-5 flex justify-center gap-2" aria-hidden>
                    {slides.map((sl, i) => (
                      <span
                        key={i}
                        className="relative h-1.5 overflow-hidden rounded-full transition-all duration-500"
                        style={{ width: i === activeSlide ? 40 : 8, background: "color-mix(in oklab, currentColor 25%, transparent)" }}
                        title={sl.kind}
                      >
                        {i === activeSlide && (
                          <span key={slideIdx} className="tv-dot-fill absolute inset-y-0 left-0 rounded-full" style={{ background: accent }} />
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
          </div>
          {camDesk && cam.layout === "split" && <div className="sticky top-6">{camFeed()}</div>}
          </div>
          {camDesk && cam.layout === "pip" && (
            <div className={`fixed z-20 ${pipPos}`} style={{ width: pipWidth }}>
              {camFeed("shadow-2xl")}
            </div>
          )}
        </main>

        {s.settings.showTicker && <Ticker items={s.activity} accent={accent} bg={bg} f={f} />}

        {s.settings.showQrCode && s.event.code && !preview && (
          <div className={`fixed bottom-24 z-20 ${camOn && cam.layout === "pip" && cam.corner === "br" ? "left-6" : "right-6"}`}>
            <QrBadge code={s.event.code} fg={bg} bg={text} />
          </div>
        )}
        <footer className="mt-4 flex items-center justify-between font-mono text-[10px] tracking-[0.15em] opacity-45">
          <span>
            SHOW<b>LIVE</b> · ROBOSTAGE
          </span>
          <span>CÓDIGO {s.event.code}</span>
        </footer>
      </div>

      {celebration && <Celebration item={celebration} accent={accent} bg={bg} text={text} secondary={style.secondary} f={f} motion={style.motion} />}
    </div>
  );
}

/* ================================================================ fundo */

function Background({ theme, style }: { theme: EventTheme; style: TvStyle }) {
  const [bg, accent] = theme.colors;
  const sec = style.secondary;
  const mix = (c: string, p: number) => `color-mix(in oklab, ${c} ${p}%, transparent)`;
  let base: string = bg;
  if (!theme.background) {
    if (style.bgStyle === "gradient") base = `linear-gradient(135deg, ${bg} 0%, ${bg} 35%, color-mix(in oklab, ${sec} 38%, ${bg}) 100%)`;
    else if (style.bgStyle === "spotlight")
      base = `radial-gradient(1200px 620px at 8% -12%, ${mix(accent, 26)}, transparent 62%), radial-gradient(900px 500px at 100% 110%, ${mix(sec, 14)}, transparent 60%), ${bg}`;
    else if (style.bgStyle === "mesh")
      base = `radial-gradient(40% 50% at 15% 20%, ${mix(accent, 22)}, transparent 70%), radial-gradient(35% 45% at 85% 15%, ${mix(sec, 20)}, transparent 70%), radial-gradient(45% 50% at 70% 90%, ${mix(accent, 14)}, transparent 70%), radial-gradient(30% 40% at 25% 85%, ${mix(sec, 12)}, transparent 70%), ${bg}`;
  }
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden>
      {theme.background ? (
        <>
          {isVideo(theme.background) ? (
            <video className="absolute inset-0 size-full object-cover" src={theme.background} autoPlay loop muted playsInline />
          ) : (
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${theme.background})` }} />
          )}
          <div
            className={`absolute inset-0 ${theme.blur ? "backdrop-blur-md" : ""}`}
            style={{ background: `linear-gradient(180deg, color-mix(in oklab, ${bg} 70%, transparent), color-mix(in oklab, ${bg} 92%, transparent))` }}
          />
        </>
      ) : (
        <div className="absolute inset-0" style={{ background: base }} />
      )}
      {!theme.background && style.bgStyle === "aurora" && (
        <>
          <span className="tv-blob" style={{ background: accent, left: "-18vmax", top: "-26vmax", ["--dur" as string]: "28s" }} />
          <span className="tv-blob" style={{ background: sec, right: "-22vmax", top: "-8vmax", ["--dur" as string]: "34s", animationDelay: "-9s" }} />
          <span className="tv-blob" style={{ background: accent, left: "20vmax", bottom: "-40vmax", opacity: 0.22, ["--dur" as string]: "40s", animationDelay: "-17s" }} />
        </>
      )}
      {style.pattern !== "none" && (
        <div className="tv-pattern" data-p={style.pattern} style={{ ["--tv-pat-op" as string]: style.patternOpacity / 100 }} />
      )}
      {/* vinheta: segura o contraste nas bordas */}
      <div className="absolute inset-0" style={{ background: `radial-gradient(120% 90% at 50% 40%, transparent 55%, color-mix(in oklab, ${bg} 70%, transparent) 100%)` }} />
    </div>
  );
}

/* ============================================================== partes */

type BoardProps = {
  rows: RankingRow[];
  rounds: LiveSnapshot["rounds"];
  mode: "best" | "sum" | "best2";
  f: ScoreFormat;
  tb: ((teamId: string, roundId: string) => number | null | undefined) | null;
  showDetails: boolean;
  highlight: boolean;
  flashed: Set<string>;
  moves: Moves;
  medals: boolean;
  animate: boolean;
};

function Score({ value, f }: { value: number | null | undefined; f: ScoreFormat }) {
  if (value === undefined) return <span className="opacity-30">—</span>;
  if (value === null)
    return (
      <span className="inline-flex items-center gap-1 opacity-60" title="Nota revelada ao fim da rodada">
        <Lock size={14} /> ✓
      </span>
    );
  return <>{formatValue(value, f)}</>;
}

function RankBadge({ row, medals, highlight, size = "md" }: { row: { rank: number; evaluated: number }; medals: boolean; highlight: boolean; size?: "sm" | "md" | "lg" }) {
  const scored = row.evaluated > 0;
  const medal = medals && scored && row.rank <= 3 ? MEDALS[row.rank - 1] : null;
  const leader = !medal && highlight && scored && row.rank === 1;
  const cls = size === "lg" ? "size-14 text-2xl" : size === "sm" ? "size-8 text-base" : "size-10 text-lg";
  return (
    <span
      className={`tv-r tv-num inline-grid shrink-0 place-items-center font-bold ${cls}`}
      style={
        medal
          ? { background: medal.bg, color: medal.fg, boxShadow: "inset 0 -2px 0 rgb(0 0 0 / .18)" }
          : leader
            ? { background: "var(--tv-accent)", color: "var(--tv-bg)" }
            : { background: "var(--tv-soft)" }
      }
    >
      {row.rank}
    </span>
  );
}

function Move({ delta }: { delta: number | undefined }) {
  if (!delta) return null;
  const up = delta > 0;
  return (
    <span
      key={delta}
      className="tv-move tv-num inline-flex items-center text-sm font-bold"
      style={{ color: up ? "#3ddc84" : "#ff6b6b" }}
      title={up ? `Subiu ${delta}` : `Caiu ${-delta}`}
    >
      {up ? <ChevronUp size={16} strokeWidth={3} /> : <ChevronDown size={16} strokeWidth={3} />}
      {Math.abs(delta)}
    </span>
  );
}

function Total({ row, f, animate }: { row: RankingRow; f: ScoreFormat; animate: boolean }) {
  const v = useCountUp(row.evaluated ? row.score : null, animate);
  if (!row.evaluated || v === null) return <span className="opacity-30">—</span>;
  return <>{formatValue(v, f)}</>;
}

function TeamName({ row, showDetails, leader, size }: { row: RankingRow; showDetails: boolean; leader: boolean; size: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-3">
        <span className={`tv-display truncate font-bold ${size}`}>{row.team.name}</span>
        {leader && <Trophy size={20} className="shrink-0" style={{ color: "var(--tv-accent)" }} />}
      </div>
      {showDetails && (row.team.number || row.team.organization) && (
        <p className="truncate font-mono text-xs opacity-50">
          {[row.team.number && `#${row.team.number}`, row.team.organization].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
}

function TableBoard({ rows, rounds, mode, f, tb, highlight, flashed, showDetails, moves, medals, animate, compact }: BoardProps & { compact: boolean }) {
  const ref = useFlip<HTMLTableSectionElement>(rows, animate);
  const py = compact ? "py-1.5" : "py-2.5";
  return (
    <div className="tv-panel tv-r-xl overflow-hidden">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="font-mono text-xs font-bold tracking-[0.18em]" style={{ background: "var(--tv-accent)", color: "var(--tv-bg)" }}>
            <th className={`w-24 px-6 text-center ${compact ? "py-2" : "py-3"}`}>#</th>
            <th className="px-4">EQUIPE</th>
            {rounds.map((r) => (
              <th key={r.id} className="w-32 px-4 text-center">
                {r.name.toUpperCase()}
                {r.arena && <span className="block text-[10px] opacity-70">{r.arena.toUpperCase()}</span>}
              </th>
            ))}
            <th className="w-44 px-6 text-right">{bestLabel(f, mode)}</th>
          </tr>
        </thead>
        <tbody ref={ref}>
          {rows.map((row, i) => {
            const leader = highlight && row.rank === 1 && row.evaluated > 0;
            return (
              <tr
                key={row.team.id}
                data-flip={row.team.id}
                className={`tv-row-enter border-t ${flashed.has(row.team.id) ? "tv-flash" : ""} ${leader ? "tv-shimmer" : ""}`}
                style={{
                  borderColor: "var(--tv-line)",
                  animationDelay: `${i * 45}ms`,
                  ...(leader ? { background: "color-mix(in oklab, var(--tv-accent) 16%, transparent)" } : i % 2 ? { background: "color-mix(in oklab, var(--tv-text) 3%, transparent)" } : {}),
                }}
              >
                <td className={`px-6 ${py} text-center`}>
                  <div className="flex items-center justify-center gap-1.5">
                    <RankBadge row={row} medals={medals} highlight={highlight} size={compact ? "sm" : "md"} />
                    <span className="w-7 text-left">
                      <Move delta={moves.get(row.team.id)} />
                    </span>
                  </div>
                </td>
                <td className={`px-4 ${py}`}>
                  <TeamName row={row} showDetails={showDetails && !compact} leader={leader} size={compact ? "text-lg" : "text-xl 2xl:text-2xl"} />
                </td>
                {rounds.map((r) => (
                  <td key={r.id} className={`tv-num px-4 ${py} text-center ${compact ? "text-base" : "text-xl"} opacity-85`}>
                    <Score value={row.byRound[r.id]} f={f} />
                    {tb && typeof tb(row.team.id, r.id) === "number" && (
                      <span className="block text-xs opacity-50">{formatClockTime(tb(row.team.id, r.id) as number)}</span>
                    )}
                  </td>
                ))}
                <td className={`tv-num px-6 ${py} text-right font-black ${compact ? "text-2xl" : "text-3xl"}`}>
                  <Total row={row} f={f} animate={animate} />
                  {tb && row.tbTotal !== null && <span className="block text-xs font-normal opacity-50">Σ {formatClockTime(row.tbTotal)}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CardsBoard({ rows, rounds, mode, f, tb, highlight, flashed, showDetails, moves, medals, animate }: BoardProps) {
  const ref = useFlip<HTMLOListElement>(rows, animate);
  return (
    <div>
      <div className="mb-2 flex items-center gap-4 px-5 font-mono text-[11px] font-bold tracking-[0.18em] opacity-55">
        <span className="w-[5.5rem]">#</span>
        <span className="flex-1">EQUIPE</span>
        {rounds.map((r) => (
          <span key={r.id} className="w-24 text-center">
            {r.name.toUpperCase()}
          </span>
        ))}
        <span className="w-40 text-right">{bestLabel(f, mode)}</span>
      </div>
      <ol ref={ref} className="space-y-1.5">
        {rows.map((row, i) => {
          const leader = highlight && row.rank === 1 && row.evaluated > 0;
          return (
            <li
              key={row.team.id}
              data-flip={row.team.id}
              className={`tv-panel tv-r-lg tv-row-enter relative flex items-center gap-4 overflow-hidden px-5 py-1.5 ${flashed.has(row.team.id) ? "tv-flash" : ""} ${leader ? "tv-shimmer" : ""}`}
              style={{
                animationDelay: `${i * 45}ms`,
                ...(leader ? { background: "color-mix(in oklab, var(--tv-accent) 20%, color-mix(in oklab, var(--tv-bg) 70%, transparent))", borderColor: "var(--tv-accent)" } : {}),
              }}
            >
              <span className="absolute inset-y-0 left-0 w-1" style={{ background: leader ? "var(--tv-accent)" : row.rank <= 3 && row.evaluated ? "var(--tv-2)" : "transparent" }} />
              <div className="flex w-[5.5rem] items-center gap-1.5">
                <RankBadge row={row} medals={medals} highlight={highlight} />
                <Move delta={moves.get(row.team.id)} />
              </div>
              <div className="min-w-0 flex-1">
                <TeamName row={row} showDetails={showDetails} leader={leader} size="text-xl 2xl:text-2xl" />
              </div>
              {rounds.map((r) => {
                const v = row.byRound[r.id];
                const best = v !== undefined && v !== null && row.evaluated > 0 && v === row.score && mode === "best";
                return (
                  <span
                    key={r.id}
                    className="tv-r tv-num w-24 py-0.5 text-center text-lg"
                    style={{ background: best ? "color-mix(in oklab, var(--tv-accent) 22%, transparent)" : "var(--tv-soft)" }}
                  >
                    <Score value={v} f={f} />
                    {tb && typeof tb(row.team.id, r.id) === "number" && (
                      <span className="block text-[10px] leading-tight opacity-55">{formatClockTime(tb(row.team.id, r.id) as number)}</span>
                    )}
                  </span>
                );
              })}
              <span className="tv-num w-40 text-right text-3xl font-black 2xl:text-4xl">
                <Total row={row} f={f} animate={animate} />
                {tb && row.tbTotal !== null && <span className="block text-xs font-normal opacity-50">Σ {formatClockTime(row.tbTotal)}</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function SplitBoard({ rows, rounds, f, highlight, flashed, showDetails, moves, medals, animate }: BoardProps) {
  const half = Math.ceil(rows.length / 2);
  const cols = [rows.slice(0, half), rows.slice(half)];
  return (
    <div className="grid grid-cols-2 gap-4">
      {cols.map((col, c) => (
        <SplitColumn key={c} rows={col} offset={c * half} {...{ rounds, f, highlight, flashed, showDetails, moves, medals, animate }} />
      ))}
    </div>
  );
}

function SplitColumn({
  rows,
  offset,
  rounds,
  f,
  highlight,
  flashed,
  showDetails,
  moves,
  medals,
  animate,
}: Omit<BoardProps, "mode" | "tb"> & { offset: number }) {
  const ref = useFlip<HTMLOListElement>(rows, animate);
  return (
    <ol ref={ref} className="space-y-1.5">
      {rows.map((row, i) => {
        const leader = highlight && row.rank === 1 && row.evaluated > 0;
        return (
          <li
            key={row.team.id}
            data-flip={row.team.id}
            className={`tv-panel tv-r-lg tv-row-enter flex items-center gap-3 px-4 py-2 ${flashed.has(row.team.id) ? "tv-flash" : ""} ${leader ? "tv-shimmer" : ""}`}
            style={{ animationDelay: `${(offset + i) * 35}ms`, ...(leader ? { borderColor: "var(--tv-accent)", background: "color-mix(in oklab, var(--tv-accent) 18%, transparent)" } : {}) }}
          >
            <RankBadge row={row} medals={medals} highlight={highlight} size="sm" />
            <span className="w-6">
              <Move delta={moves.get(row.team.id)} />
            </span>
            <div className="min-w-0 flex-1">
              <TeamName row={row} showDetails={showDetails} leader={leader} size="text-lg" />
              <p className="tv-num mt-0.5 truncate text-xs opacity-55">
                {rounds.map((r, k) => (
                  <span key={r.id}>
                    {k > 0 && "  ·  "}
                    {r.name.replace(/^Round\s*/i, "R").replace(/^Rodada\s*/i, "R")} <Score value={row.byRound[r.id]} f={f} />
                  </span>
                ))}
              </p>
            </div>
            <span className="tv-num text-2xl font-black">
              <Total row={row} f={f} animate={animate} />
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function MobileList({
  ranking,
  rounds,
  highlight,
  flashed,
  f,
  medals,
}: {
  ranking: RankingRow[];
  rounds: LiveSnapshot["rounds"];
  highlight: boolean;
  flashed: Set<string>;
  f: ScoreFormat;
  medals: boolean;
}) {
  const [q, setQ] = useState("");
  const [mine, setMine] = useState<string | null>(null);
  useEffect(() => setMine(localStorage.getItem("showlive:minha-equipe")), []);
  const pick = (id: string) => {
    const next = mine === id ? null : id;
    setMine(next);
    if (next) localStorage.setItem("showlive:minha-equipe", next);
    else localStorage.removeItem("showlive:minha-equipe");
  };
  const filtered = ranking.filter((r) => r.team.name.toLowerCase().includes(q.toLowerCase()));
  const pinned = ranking.find((r) => r.team.id === mine);

  return (
    <div>
      <label className="tv-panel tv-r-lg flex items-center gap-2 px-3 py-2.5">
        <Search size={16} className="opacity-60" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Encontre sua equipe"
          className="w-full bg-transparent text-base outline-none placeholder:text-current/40"
        />
      </label>
      {pinned && !q && (
        <div className="tv-r-lg mt-3 p-3" style={{ background: "color-mix(in oklab, var(--tv-accent) 20%, transparent)" }}>
          <p className="font-mono text-[10px] font-bold tracking-[0.2em] opacity-70">SUA EQUIPE</p>
          <p className="tv-display mt-1 text-lg font-bold">
            {pinned.rank}º · {pinned.team.name} · <span className="tv-num">{pinned.evaluated ? formatScore(pinned.score, f) : "—"}</span>
          </p>
        </div>
      )}
      <ol className="mt-3 space-y-2">
        {filtered.map((row) => {
          const leader = highlight && row.rank === 1 && row.evaluated > 0;
          return (
            <li
              key={row.team.id}
              onClick={() => pick(row.team.id)}
              className={`tv-panel tv-r-lg p-3 ${flashed.has(row.team.id) ? "tv-flash" : ""}`}
              style={leader ? { borderColor: "var(--tv-accent)" } : undefined}
            >
              <div className="flex items-center gap-3">
                <RankBadge row={row} medals={medals} highlight={highlight} size="sm" />
                <span className="tv-display flex-1 truncate font-bold">{row.team.name}</span>
                {mine === row.team.id && <span className="text-xs opacity-60">★</span>}
                <span className="tv-num text-xl font-black">{row.evaluated ? formatValue(row.score, f) : "—"}</span>
              </div>
              <div className="tv-num mt-2 flex gap-3 pl-11 text-xs opacity-60">
                {rounds.map((r) => (
                  <span key={r.id}>
                    {r.name}: <Score value={row.byRound[r.id]} f={f} />
                  </span>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-center text-xs opacity-50">Toque numa equipe para fixá-la no topo.</p>
    </div>
  );
}

function Podium({ rows, champion, f, medals }: { rows: RankingRow[]; champion?: string; f: ScoreFormat; medals: boolean }) {
  const top = rows.slice(0, 3);
  const order = [top[1], top[0], top[2]].filter(Boolean);
  const heights = ["h-44", "h-64", "h-32"];
  return (
    <div className="flex flex-col items-center">
      <p className="font-mono text-sm font-bold tracking-[0.25em] opacity-60">CLASSIFICAÇÃO FINAL</p>
      {champion && (
        <p className="mt-2 text-xl">
          Campeã dos playoffs: <b className="tv-display">{champion}</b>
        </p>
      )}
      <div className="mt-10 flex w-full max-w-5xl items-end justify-center gap-6">
        {order.map((row, k) => {
          const idx = top.indexOf(row);
          const medal = medals ? MEDALS[idx] : null;
          return (
            <div key={row.team.id} className="tv-row-enter flex flex-1 flex-col items-center gap-3" style={{ animationDelay: `${[400, 900, 0][k]}ms` }}>
              <p className="tv-display text-center text-3xl font-black leading-tight">{row.team.name}</p>
              <p className="tv-num text-2xl opacity-75">{formatScore(row.score, f)}</p>
              <div
                className={`tv-r-xl tv-num flex w-full items-start justify-center pt-5 text-7xl font-black ${heights[[1, 0, 2][idx]]} ${idx === 0 ? "tv-shimmer" : ""}`}
                style={
                  medal
                    ? { background: medal.bg, color: medal.fg }
                    : idx === 0
                      ? { background: "var(--tv-accent)", color: "var(--tv-bg)" }
                      : { background: "color-mix(in oklab, currentColor 12%, transparent)" }
                }
              >
                {row.rank}º
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function describe(a: LiveActivity, f: ScoreFormat) {
  const p = a.payload;
  const v = (n: number) => formatScore(n, p.unit ? { ...f, unit: p.unit, decimals: (p.decimals ?? f.decimals) as 0 | 1 | 2 } : f);
  switch (a.kind) {
    case "score":
      return p.points !== undefined ? `${p.team}: ${v(p.points)} · ${p.round}` : `${p.team} concluiu: ${p.round}`;
    case "score_edit":
      return p.points !== undefined ? `Nota revisada: ${p.team} · ${p.round} → ${v(p.points)}` : `Nota revisada: ${p.team} · ${p.round}`;
    case "score_void":
      return `${p.team} vai repetir: ${p.round}`;
    case "message":
    case "match":
      return p.message ?? "";
    default:
      return "";
  }
}

function Ticker({ items, accent, bg, f }: { items: LiveActivity[]; accent: string; bg: string; f: ScoreFormat }) {
  const lines = items.map((a) => describe(a, f)).filter(Boolean).slice(0, 10);
  if (!lines.length) return null;
  const doubled = [...lines, ...lines];
  return (
    <div className="tv-r-lg mt-5 flex items-center overflow-hidden" style={{ background: accent, color: bg }}>
      <span className="z-10 flex shrink-0 items-center gap-2 px-4 py-2.5 font-mono text-xs font-black tracking-[0.2em]" style={{ background: bg, color: accent }}>
        <span className="live-dot" /> AGORA
      </span>
      <div className="min-w-0 flex-1 overflow-hidden py-2.5">
        <div className="ticker-track font-semibold" style={{ ["--ticker-speed" as string]: `${Math.max(20, lines.length * 7)}s` }}>
          {doubled.map((l, i) => (
            <span key={i} className="flex items-center gap-3">
              <span className="size-1.5 rotate-45 bg-current opacity-60" />
              {l}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExtraBoard({ snapshot: s, roundId, medals }: { snapshot: LiveSnapshot; roundId: string; medals: boolean }) {
  const round = s.rounds.find((r) => r.id === roundId);
  if (!round?.extra) return null;
  const rows = computeExtraRanking(s.teams, round, s.scores).slice(0, 10);
  const ef = round.extra.scoring;
  return (
    <div className="tv-panel tv-r-xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4" style={{ background: "var(--tv-accent)", color: "var(--tv-bg)" }}>
        <span className="font-mono text-xs font-bold tracking-[0.2em]">DESAFIO EXTRA · RANKING PRÓPRIO</span>
        <span className="tv-display text-2xl font-black">{round.extra.name}</span>
      </div>
      <ol>
        {rows.map((r, i) => (
          <li key={r.team.id} className="tv-row-enter flex items-center gap-4 border-t px-6 py-3" style={{ borderColor: "var(--tv-line)", animationDelay: `${i * 45}ms` }}>
            <RankBadge row={{ rank: r.rank, evaluated: r.value === null ? 0 : 1 }} medals={medals} highlight />
            <span className="tv-display flex-1 truncate text-xl font-bold">{r.team.name}</span>
            <span className="tv-num text-3xl font-black">
              {r.value === null ? <Lock size={18} className="inline opacity-60" /> : formatScore(r.value, ef)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Waiting({ text }: { text: string }) {
  return (
    <div className="grid h-full min-h-[40vh] place-items-center text-center">
      <div>
        <span className="live-dot mx-auto block size-3" style={{ color: "var(--tv-accent)" }} />
        <p className="tv-display mt-6 text-2xl font-bold">Em instantes…</p>
        <p className="mt-2 opacity-60">{text}</p>
      </div>
    </div>
  );
}

/* ============================================================ efeitos */

/** Reordenação animada (FLIP): cada item com data-flip desliza da posição antiga para a nova. */
function useFlip<T extends HTMLElement>(rows: RankingRow[], enabled: boolean) {
  const ref = useRef<T>(null);
  const last = useRef<Map<string, number>>(new Map());
  const order = rows.map((r) => r.team.id).join(",");
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const now = new Map<string, number>();
    el.querySelectorAll<HTMLElement>("[data-flip]").forEach((n) => now.set(n.dataset.flip!, n.getBoundingClientRect().top));
    if (enabled && last.current.size) {
      el.querySelectorAll<HTMLElement>("[data-flip]").forEach((n) => {
        const before = last.current.get(n.dataset.flip!);
        const after = now.get(n.dataset.flip!);
        if (before === undefined || after === undefined) return;
        const dy = before - after;
        if (Math.abs(dy) < 2) return;
        n.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 750, easing: "cubic-bezier(.2,.8,.2,1)" });
      });
    }
    last.current = now;
  }, [order, enabled]);
  return ref;
}

/** Quantas posições cada equipe subiu (+) ou caiu (−) nos últimos segundos. */
function useRankMoves(ranking: RankingRow[]): Moves {
  const prev = useRef<Map<string, number> | null>(null);
  const [moves, setMoves] = useState<Map<string, { d: number; at: number }>>(new Map());
  const sig = ranking.map((r) => `${r.team.id}:${r.rank}`).join(",");
  useEffect(() => {
    const now = new Map(ranking.filter((r) => r.evaluated > 0).map((r) => [r.team.id, r.rank]));
    if (prev.current) {
      const t = Date.now();
      const changed: [string, { d: number; at: number }][] = [];
      for (const [id, rank] of now) {
        const before = prev.current.get(id);
        if (before !== undefined && before !== rank) changed.push([id, { d: before - rank, at: t }]);
      }
      if (changed.length) setMoves((m) => new Map([...m, ...changed]));
    }
    prev.current = now;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  useEffect(() => {
    if (!moves.size) return;
    const id = setInterval(() => {
      const t = Date.now();
      setMoves((m) => {
        const next = new Map([...m].filter(([, v]) => t - v.at < MOVE_MS));
        return next.size === m.size ? m : next;
      });
    }, 2000);
    return () => clearInterval(id);
  }, [moves.size]);
  return useMemo(() => new Map([...moves].map(([k, v]) => [k, v.d])), [moves]);
}

/** Número que conta do valor anterior até o novo. */
function useCountUp(value: number | null, enabled: boolean) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (!enabled || value === null || from.current === null || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = from.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 1100);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(start + (value - start) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, enabled]);
  return shown;
}

/** Equipes cuja nota mudou desde o último snapshot (pisca a linha). */
function useFlashedTeams(s: LiveSnapshot) {
  const prev = useRef<Map<string, number> | null>(null);
  const [flashed, setFlashed] = useState<Set<string>>(new Set());
  useEffect(() => {
    const now = new Map<string, number>();
    for (const sc of s.scores) now.set(`${sc.teamId}:${sc.roundId}`, sc.at);
    if (prev.current) {
      const changed = new Set<string>();
      for (const [k, at] of now) if (prev.current.get(k) !== at) changed.add(k.split(":")[0]);
      if (changed.size) {
        setFlashed(changed);
        const id = setTimeout(() => setFlashed(new Set()), 2500);
        prev.current = now;
        return () => clearTimeout(id);
      }
    }
    prev.current = now;
  }, [s.scores]);
  return flashed;
}

/** Fila de comemorações: uma por nota nova que chegar com o telão aberto. */
function useCelebrations(activity: LiveActivity[], enabled: boolean) {
  const lastSeen = useRef<number | null>(null);
  const [queue, setQueue] = useState<LiveActivity[]>([]);
  const [current, setCurrent] = useState<LiveActivity | null>(null);

  useEffect(() => {
    const maxId = activity.reduce((m, a) => Math.max(m, a.id), 0);
    if (lastSeen.current === null) {
      lastSeen.current = maxId;
      return;
    }
    const fresh = activity.filter((a) => a.id > lastSeen.current! && a.kind === "score").sort((a, b) => a.id - b.id);
    lastSeen.current = Math.max(lastSeen.current, maxId);
    if (enabled && fresh.length) setQueue((q) => [...q, ...fresh].slice(-5));
  }, [activity, enabled]);

  useEffect(() => {
    if (current || !queue.length) return;
    setCurrent(queue[0]);
    setQueue((q) => q.slice(1));
  }, [queue, current]);

  useEffect(() => {
    if (!current) return;
    const id = setTimeout(() => setCurrent(null), CELEBRATE_MS);
    return () => clearTimeout(id);
  }, [current]);

  return current;
}

function Celebration({
  item,
  accent,
  bg,
  text,
  secondary,
  f,
  motion,
}: {
  item: LiveActivity;
  accent: string;
  bg: string;
  text: string;
  secondary: string;
  f: ScoreFormat;
  motion: TvStyle["motion"];
}) {
  const bits = useMemo(
    () =>
      Array.from({ length: motion === "full" ? 48 : 0 }, (_, i) => ({
        left: Math.random() * 100,
        x: (Math.random() - 0.5) * 300,
        r: 360 + Math.random() * 720,
        d: 2 + Math.random() * 1.8,
        delay: Math.random() * 0.4,
        color: [accent, text, secondary, "#fabd32"][i % 4],
        round: i % 3 === 0,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item.id, motion],
  );
  const p = item.payload;
  const value = useCountUp(p.points ?? null, motion === "full");
  return (
    <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center overflow-hidden" style={{ background: "color-mix(in oklab, black 50%, transparent)" }} role="status">
      {motion === "full" && <div className="tv-rays" />}
      {bits.map((b, i) => (
        <span
          key={i}
          className={`confetti-bit ${b.round ? "rounded-full" : "rounded-sm"}`}
          style={{
            left: `${b.left}%`,
            background: b.color,
            ["--x" as string]: `${b.x}px`,
            ["--r" as string]: `${b.r}deg`,
            ["--d" as string]: `${b.d}s`,
            ["--delay" as string]: `${b.delay}s`,
          }}
        />
      ))}
      <div
        className="celebrate-in tv-r-xl relative mx-6 max-w-3xl px-10 py-9 text-center md:px-16 md:py-12"
        style={{ background: bg, color: text, boxShadow: `12px 12px 0 0 ${accent}`, border: `2px solid ${accent}` }}
      >
        <p className="font-mono text-xs font-bold tracking-[0.3em] opacity-60">{p.round?.toUpperCase()} · NOVA NOTA</p>
        <p className="tv-display mt-3 text-4xl font-black tracking-tight md:text-6xl">{p.team}</p>
        {p.points !== undefined && value !== null ? (
          <p className="tv-num mt-4 text-7xl font-black md:text-9xl" style={{ color: accent }}>
            {formatValue(value, p.unit ? { ...f, unit: p.unit, decimals: (p.decimals ?? f.decimals) as 0 | 1 | 2 } : f)}
            <span className="ml-2 text-2xl md:text-4xl">{p.unit ?? f.unit}</span>
          </p>
        ) : (
          <p className="mt-4 text-2xl opacity-80">Nota registrada — revelada ao fim da rodada.</p>
        )}
      </div>
    </div>
  );
}
