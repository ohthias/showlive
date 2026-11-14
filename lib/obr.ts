import type { HazardKey, ObrArena, ObrLeague, ObrResponses } from "./obr-types";
import { newId, sanitizeChallenge } from "./challenge";

export type * from "./obr-types";

/**
 * OBR Resgate — mesma pontuação do Pontuador do RoboStage
 * (utils/competitions/obr/scoring.ts), com os limites vindos da arena.
 *
 *   base = perigos + checkpoints + ladrilho de saída + chegada
 *   total = ⌈ base × 1,3^(vivas+mortas) × 1,1^invertidas × 1,5^surpresa ⌉
 *
 * Classificação oficial: soma das 2 maiores notas das 3 rodadas; desempate
 * pela menor soma dos tempos (ver lib/ranking.ts, modo "best2").
 */

export const HAZARDS: { key: HazardKey; label: string; points: number }[] = [
  { key: "intersecoes", label: "Interseção / Beco sem saída", points: 10 },
  { key: "gangorras", label: "Gangorra", points: 20 },
  { key: "obstaculos", label: "Obstáculo desviado", points: 20 },
  { key: "gaps", label: "Ladrilho com Gap(s)", points: 10 },
  { key: "rampas", label: "Ladrilho com Rampa", points: 10 },
  { key: "lombadas", label: "Ladrilho com Lombada(s)", points: 10 },
  { key: "passagens", label: "Passagem", points: 0 },
];

export const START_TILE_POINTS = 5;
export const FINISH_MAX = 60;
export const FINISH_PENALTY = 5;
export const ROUND_MAX_SECONDS = 300;
export const MAX_VIVAS = 2;
export const MAX_MORTAS = 1;

export function checkpointRate(attempt: number): number {
  if (attempt <= 0) return 0;
  if (attempt === 1) return 5;
  if (attempt === 2) return 3;
  if (attempt === 3) return 1;
  return 0;
}

const zeroHazards = (): Record<HazardKey, number> => ({
  intersecoes: 0,
  gangorras: 0,
  obstaculos: 0,
  gaps: 0,
  rampas: 0,
  lombadas: 0,
  passagens: 0,
});

export function defaultArena(n: number): ObrArena {
  const presets: Partial<Record<HazardKey, number>>[] = [
    { intersecoes: 4, gangorras: 1, obstaculos: 1, gaps: 2, rampas: 2, lombadas: 1 },
    { intersecoes: 5, gangorras: 1, obstaculos: 2, gaps: 3, rampas: 2, lombadas: 2 },
    { intersecoes: 6, gangorras: 2, obstaculos: 2, gaps: 3, rampas: 3, lombadas: 2, passagens: 1 },
  ];
  return {
    id: `arena${n + 1}`,
    name: `Arena ${String.fromCharCode(65 + n)}`,
    hazards: { ...zeroHazards(), ...(presets[n] ?? presets[0]) },
    sections: n === 0 ? [6, 6, 5] : n === 1 ? [7, 6, 6] : [7, 7, 6],
    startTile: true,
    surpriseEnabled: n > 0,
  };
}

export function defaultLeague(): ObrLeague {
  return { version: 1, arenas: [0, 1, 2].map(defaultArena), extras: [] };
}

const clampInt = (v: unknown, lo: number, hi: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
};

export function emptyResponses(arena: ObrArena): ObrResponses {
  return {
    hazards: {},
    sections: arena.sections.map(() => 0),
    falhas: 0,
    chegada: false,
    vivas: 0,
    mortas: 0,
    invertidas: 0,
    surpresa: false,
    tempo: null,
    desistiu: false,
  };
}

/** Limita tudo ao que a arena permite (o cliente não é confiável). */
export function sanitizeObrResponses(arena: ObrArena, raw: unknown): ObrResponses {
  const r = (raw ?? {}) as Partial<ObrResponses>;
  const hazards: Partial<Record<HazardKey, number>> = {};
  for (const h of HAZARDS) {
    const v = clampInt(r.hazards?.[h.key] ?? 0, 0, arena.hazards[h.key] ?? 0);
    if (v) hazards[h.key] = v;
  }
  const sections = arena.sections.map((_, i) => clampInt(r.sections?.[i] ?? 0, 0, 4));
  const vivas = clampInt(r.vivas, 0, MAX_VIVAS);
  const mortas = clampInt(r.mortas, 0, MAX_MORTAS);
  const invertidas = clampInt(r.invertidas, 0, MAX_VIVAS + MAX_MORTAS - vivas - mortas);
  const tempo = r.tempo === null || r.tempo === undefined ? null : Math.min(ROUND_MAX_SECONDS, Math.max(0, Number(r.tempo) || 0));
  return {
    hazards,
    sections,
    falhas: clampInt(r.falhas, 0, 99),
    chegada: Boolean(r.chegada),
    vivas,
    mortas,
    invertidas,
    surpresa: Boolean(r.surpresa) && arena.surpriseEnabled,
    tempo: tempo === null ? null : Math.round(tempo * 100) / 100,
    desistiu: Boolean(r.desistiu),
  };
}

export interface ObrBreakdown {
  hazards: number;
  checkpoints: number;
  start: number;
  chegada: number;
  base: number;
  multiplier: number;
  multiplierParts: string[];
  total: number;
  /** Tempo considerado para desempate. */
  tempo: number;
}

export function scoreObr(arena: ObrArena, r: ObrResponses): ObrBreakdown {
  const hazards = HAZARDS.reduce((s, h) => s + h.points * Math.min(arena.hazards[h.key] ?? 0, r.hazards[h.key] ?? 0), 0);
  const checkpoints = arena.sections.reduce((s, tiles, i) => s + tiles * checkpointRate(r.sections[i] ?? 0), 0);
  const start = arena.startTile ? START_TILE_POINTS : 0;
  const chegada = r.chegada ? Math.max(0, FINISH_MAX - FINISH_PENALTY * Math.max(0, r.falhas)) : 0;
  const base = hazards + checkpoints + start + chegada;

  const vivas = Math.min(MAX_VIVAS, r.vivas);
  const mortas = Math.min(MAX_MORTAS, r.mortas);
  const inv = Math.max(0, r.invertidas);
  const surp = r.surpresa ? 1 : 0;
  // Aritmética inteira (13/10, 11/10, 15/10) — igual ao Pontuador, sem erro de ponto flutuante.
  const num = 13 ** (vivas + mortas) * 11 ** inv * 15 ** surp;
  const den = 10 ** (vivas + mortas + inv + surp);
  const total = Math.floor((base * num + den - 1) / den);

  const parts: string[] = [];
  if (vivas) parts.push(`${vivas}× viva (×1,3)`);
  if (mortas) parts.push(`${mortas}× morta (×1,3)`);
  if (inv) parts.push(`${inv}× invertida (×1,1)`);
  if (surp) parts.push("Desafio Surpresa (×1,5)");

  const tempo = r.chegada && !r.desistiu && r.tempo !== null ? Math.min(ROUND_MAX_SECONDS, r.tempo) : ROUND_MAX_SECONDS;
  return { hazards, checkpoints, start, chegada, base, multiplier: num / den, multiplierParts: parts, total, tempo };
}

/** Maior pontuação possível numa arena (referência para o admin). */
export function arenaMaxScore(arena: ObrArena): number {
  const full: ObrResponses = {
    hazards: { ...arena.hazards },
    sections: arena.sections.map(() => 1),
    falhas: 0,
    chegada: true,
    vivas: MAX_VIVAS,
    mortas: MAX_MORTAS,
    invertidas: 0,
    surpresa: arena.surpriseEnabled,
    tempo: 0,
    desistiu: false,
  };
  return scoreObr(arena, full).total;
}

/* ----------------------------------------------- validação da liga */

const txt = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export function sanitizeArena(raw: unknown, index: number): ObrArena {
  const a = (raw ?? {}) as Partial<ObrArena>;
  const hazards = zeroHazards();
  for (const h of HAZARDS) hazards[h.key] = clampInt(a.hazards?.[h.key] ?? 0, 0, 40);
  const sections = (Array.isArray(a.sections) ? a.sections : []).slice(0, 12).map((t) => clampInt(t, 1, 40));
  if (!sections.length) throw new Error(`${txt(a.name, 40) || `Arena ${index + 1}`}: adicione pelo menos uma seção de checkpoint.`);
  const arena: ObrArena = {
    id: String(a.id ?? "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || `arena${index + 1}`,
    name: txt(a.name, 40) || `Arena ${String.fromCharCode(65 + index)}`,
    hazards,
    sections,
    startTile: a.startTile !== false,
    surpriseEnabled: Boolean(a.surpriseEnabled),
  };
  const d = txt(a.description, 300);
  if (d) arena.description = d;
  const s = txt(a.surpriseText, 400);
  if (s) arena.surpriseText = s;
  return arena;
}

/** As 3 arenas são obrigatórias; os extras são opcionais. Lança Error com mensagem amigável. */
export function sanitizeLeague(raw: unknown): ObrLeague {
  const l = (raw ?? {}) as Partial<ObrLeague>;
  const arenas = (Array.isArray(l.arenas) ? l.arenas : []).slice(0, 3).map(sanitizeArena);
  if (arenas.length !== 3) throw new Error("A OBR Resgate usa 3 modelos de arena.");
  const ids = new Set<string>();
  arenas.forEach((a, i) => {
    if (ids.has(a.id)) a.id = `arena${i + 1}`;
    ids.add(a.id);
  });
  const extras = (Array.isArray(l.extras) ? l.extras : []).slice(0, 8).map((e) => ({
    ...sanitizeChallenge(e),
    id: String((e as { id?: string })?.id ?? "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || newId("x"),
  }));
  return { version: 1, arenas, extras };
}
