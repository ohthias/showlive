"use client";

import { Trophy } from "lucide-react";
import { QrBadge } from "./QrBadge";
import { TimerDisplay } from "./TimerDisplay";
import { LiveSnapshot } from "@/lib/live/live-types";
import { Scene } from "@/lib/live/scenes";

/**
 * Disposições das cenas do telão (além da classificação em slides, que fica
 * no Telao). Recebem linhas já prontas (SceneRow), então funcionam igual para
 * rodadas e para alianças. Usam as variáveis de tema do telão (--tv-*).
 */

export interface SceneRow {
  id: string;
  rank: number;
  name: string;
  /** Número e organização. */
  sub: string | null;
  /** Valor principal já formatado ("245 pts", "2,33 RS"). null = sem nota. */
  value: string | null;
  /** Linha de apoio (notas por rodada, V-D-E). */
  detail: string | null;
  evaluated: boolean;
}

const MEDALS = [
  { bg: "linear-gradient(135deg,#ffe27a,#e0a821)", fg: "#2a1d00" },
  { bg: "linear-gradient(135deg,#f1f4f8,#aab4c0)", fg: "#1c2229" },
  { bg: "linear-gradient(135deg,#f0b27f,#b8693a)", fg: "#2a1405" },
];

function Badge({ row, medals, size }: { row: SceneRow; medals: boolean; size: string }) {
  const medal = medals && row.evaluated && row.rank <= 3 ? MEDALS[row.rank - 1] : null;
  return (
    <span
      className={`tv-r tv-num inline-grid shrink-0 place-items-center font-black ${size}`}
      style={medal ? { background: medal.bg, color: medal.fg } : row.rank === 1 && row.evaluated ? { background: "var(--tv-accent)", color: "var(--tv-bg)" } : { background: "var(--tv-soft)" }}
    >
      {row.rank}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="grid min-h-[40vh] place-items-center text-center">
      <p className="tv-display text-2xl font-bold opacity-70">{text}</p>
    </div>
  );
}

/* ------------------------------------------------------------ líderes */

/** As primeiras em cartões grandes; as seguintes (até topN) numa lista curta. */
export function LeadersBoard({ rows, topN, medals }: { rows: SceneRow[]; topN: number; medals: boolean }) {
  if (!rows.length) return <Empty text="As equipes ainda estão sendo cadastradas." />;
  const hero = rows.slice(0, 3);
  const rest = rows.slice(3, Math.max(3, topN));
  return (
    <div className="tv-slide">
      <div className={`grid gap-5 ${hero.length === 3 ? "grid-cols-3" : hero.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
        {hero.map((r, i) => (
          <div
            key={r.id}
            className={`tv-panel tv-r-xl tv-row-enter relative flex flex-col items-center overflow-hidden px-6 pb-8 pt-10 text-center ${i === 0 && r.evaluated ? "tv-shimmer" : ""}`}
            style={{
              animationDelay: `${[150, 0, 300][i]}ms`,
              ...(i === 0 && r.evaluated ? { borderColor: "var(--tv-accent)", background: "color-mix(in oklab, var(--tv-accent) 16%, transparent)" } : {}),
            }}
          >
            <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: i === 0 ? "var(--tv-accent)" : "var(--tv-2)" }} />
            <Badge row={r} medals={medals} size="size-20 text-4xl" />
            <p className="tv-display mt-6 line-clamp-2 text-3xl font-black leading-tight 2xl:text-4xl">{r.name}</p>
            {r.sub && <p className="mt-1 truncate font-mono text-sm opacity-55">{r.sub}</p>}
            <p className="tv-num mt-5 text-6xl font-black 2xl:text-7xl" style={{ color: r.evaluated ? "var(--tv-accent)" : undefined }}>
              {r.value ?? "—"}
            </p>
            {r.detail && <p className="tv-num mt-3 text-sm opacity-60">{r.detail}</p>}
          </div>
        ))}
      </div>
      {rest.length > 0 && (
        <ol className={`mt-5 grid gap-2 ${rest.length > 4 ? "grid-cols-2" : "grid-cols-1"}`}>
          {rest.map((r, i) => (
            <li key={r.id} className="tv-panel tv-r-lg tv-row-enter flex items-center gap-4 px-5 py-2.5" style={{ animationDelay: `${400 + i * 50}ms` }}>
              <Badge row={r} medals={medals} size="size-10 text-lg" />
              <span className="tv-display min-w-0 flex-1 truncate text-xl font-bold">{r.name}</span>
              <span className="tv-num text-2xl font-black">{r.value ?? "—"}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ----------------------------------------------------- rodada ao vivo */

export function SpotlightBoard({
  snapshot: s,
  rows,
  topN,
  roundName,
  progress,
  recent,
  clockOffset,
  medals,
}: {
  snapshot: LiveSnapshot;
  rows: SceneRow[];
  topN: number;
  roundName: string | null;
  progress: { done: number; total: number } | null;
  recent: string[];
  clockOffset: number;
  medals: boolean;
}) {
  const pct = progress && progress.total ? (progress.done / progress.total) * 100 : 0;
  return (
    <div className="tv-slide grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-6">
      <div className="flex flex-col gap-6">
        <div className="tv-panel tv-r-xl flex flex-1 flex-col items-center justify-center px-8 py-10 text-center">
          <p className="font-mono text-sm font-bold tracking-[0.3em] opacity-60">{roundName ? roundName.toUpperCase() : "CRONÔMETRO"}</p>
          <TimerDisplay timer={s.event.timer} clockOffset={clockOffset} className="tv-num mt-4 text-[clamp(6rem,14vw,14rem)] font-black leading-none" />
          {progress && (
            <div className="mt-8 w-full max-w-xl">
              <div className="h-3 overflow-hidden rounded-full" style={{ background: "var(--tv-soft)" }}>
                <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: "var(--tv-accent)" }} />
              </div>
              <p className="tv-num mt-2 font-mono text-sm opacity-60">
                {progress.done}/{progress.total} EQUIPES JOGARAM
              </p>
            </div>
          )}
        </div>
        {recent.length > 0 && (
          <div className="tv-panel tv-r-xl px-6 py-4">
            <p className="font-mono text-xs font-bold tracking-[0.2em] opacity-60">ÚLTIMAS NOTAS</p>
            <ul className="mt-2 space-y-1.5">
              {recent.slice(0, 4).map((l, i) => (
                <li key={i} className={`truncate text-lg ${i === 0 ? "font-bold" : "opacity-70"}`}>
                  {l}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="tv-panel tv-r-xl overflow-hidden">
        <p className="px-6 py-3 font-mono text-xs font-bold tracking-[0.2em]" style={{ background: "var(--tv-accent)", color: "var(--tv-bg)" }}>
          TOP {Math.min(topN, rows.length) || topN}
        </p>
        {rows.length === 0 ? (
          <p className="p-6 opacity-60">Sem equipes ainda.</p>
        ) : (
          <ol>
            {rows.slice(0, topN).map((r, i) => (
              <li key={r.id} className="tv-row-enter flex items-center gap-4 border-t px-6 py-3" style={{ borderColor: "var(--tv-line)", animationDelay: `${i * 45}ms` }}>
                <Badge row={r} medals={medals} size="size-10 text-lg" />
                <span className="tv-display min-w-0 flex-1 truncate text-xl font-bold">{r.name}</span>
                <span className="tv-num text-2xl font-black">{r.value ?? "—"}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- mensagem */

export function TitleCard({
  scene,
  eventName,
  logoUrl,
  code,
  showQr,
  showTimer,
  snapshot,
  clockOffset,
  fg,
  bg,
}: {
  scene: Scene;
  eventName: string;
  logoUrl?: string | null;
  code: string | null;
  showQr: boolean;
  showTimer: boolean;
  snapshot: LiveSnapshot;
  clockOffset: number;
  fg: string;
  bg: string;
}) {
  return (
    <div className="tv-slide flex min-h-[calc(100dvh-10rem)] flex-col items-center justify-center text-center">
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="mb-10 h-24 w-auto" />
      )}
      <p className="font-mono text-sm font-bold tracking-[0.35em] opacity-60">{eventName.toUpperCase()}</p>
      <h2 className="tv-display mt-5 max-w-6xl text-[clamp(3.5rem,9vw,9rem)] font-black leading-[0.95] tracking-tight">{scene.title || eventName}</h2>
      <span className="mt-8 block h-1.5 w-32 rounded-full" style={{ background: "linear-gradient(90deg, var(--tv-accent), var(--tv-2))" }} />
      {scene.subtitle && <p className="mt-8 max-w-4xl text-2xl opacity-75 2xl:text-3xl">{scene.subtitle}</p>}
      {showTimer && <TimerDisplay timer={snapshot.event.timer} clockOffset={clockOffset} className="tv-num mt-10 text-8xl font-black" />}
      {showQr && code && (
        <div className="mt-12 scale-125">
          <QrBadge code={code} fg={bg} bg={fg} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------- faixa sobre a câmera */

export function LowerThird({ rows, topN, medals, label }: { rows: SceneRow[]; topN: number; medals: boolean; label: string }) {
  const list = rows.slice(0, topN);
  if (!list.length) return null;
  return (
    <div className="tv-r-xl flex items-stretch overflow-hidden" style={{ background: "color-mix(in oklab, var(--tv-bg) 88%, transparent)", backdropFilter: "blur(8px)" }}>
      <span className="flex shrink-0 items-center gap-2 px-5 font-mono text-xs font-black tracking-[0.2em]" style={{ background: "var(--tv-accent)", color: "var(--tv-bg)" }}>
        <Trophy size={16} /> {label}
      </span>
      <ol className="flex min-w-0 flex-1 items-center gap-6 overflow-hidden px-5 py-3">
        {list.map((r) => (
          <li key={r.id} className="flex min-w-0 items-center gap-2.5">
            <Badge row={r} medals={medals} size="size-8 text-base" />
            <span className="tv-display truncate text-lg font-bold">{r.name}</span>
            <span className="tv-num text-lg font-black opacity-85">{r.value ?? "—"}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* --------------------------------------------------------------- pódio */

export function ScenePodium({ rows, medals, champion }: { rows: SceneRow[]; medals: boolean; champion?: string | null }) {
  const top = rows.filter((r) => r.evaluated).slice(0, 3);
  if (top.length === 0) return <Empty text="O pódio aparece quando houver notas." />;
  const order = [top[1], top[0], top[2]].filter(Boolean) as SceneRow[];
  const heights = ["h-80", "h-56", "h-40"];
  return (
    <div className="tv-slide flex min-h-[calc(100dvh-16rem)] flex-col items-center justify-center">
      <p className="font-mono text-sm font-bold tracking-[0.25em] opacity-60">CLASSIFICAÇÃO</p>
      {champion && (
        <p className="mt-2 text-xl">
          Campeã dos playoffs: <b className="tv-display">{champion}</b>
        </p>
      )}
      <div className="mt-10 flex w-full max-w-5xl items-end justify-center gap-6">
        {order.map((row) => {
          const idx = top.indexOf(row);
          const medal = medals ? MEDALS[idx] : null;
          return (
            <div key={row.id} className="tv-row-enter flex flex-1 flex-col items-center gap-3" style={{ animationDelay: `${[900, 400, 0][idx]}ms` }}>
              <p className="tv-display text-center text-4xl font-black leading-tight">{row.name}</p>
              <p className="tv-num text-3xl opacity-75">{row.value ?? ""}</p>
              <div
                className={`tv-r-xl tv-num flex w-full items-start justify-center pt-6 text-8xl font-black ${heights[idx]} ${idx === 0 ? "tv-shimmer" : ""}`}
                style={medal ? { background: medal.bg, color: medal.fg } : idx === 0 ? { background: "var(--tv-accent)", color: "var(--tv-bg)" } : { background: "var(--tv-soft)" }}
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
