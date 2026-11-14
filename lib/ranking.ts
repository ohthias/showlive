import type { LiveRound, LiveScore, LiveSettings, LiveTeam } from "./live-types";

/**
 * Classificação — funções puras, rodam igual no servidor e nas telas.
 *
 * Modo "best" (padrão FLL): vale a MELHOR nota entre as rodadas
 * classificatórias; empate é desfeito pela 2ª melhor, depois pela 3ª.
 * Modo "sum": soma das rodadas; empate pela melhor nota.
 * direction "lower" (desafios de tempo): melhor = menor.
 */

export interface RankingRow {
  team: LiveTeam;
  rank: number;
  /** Nota por rodada classificatória (undefined = não avaliada, null = oculta). */
  byRound: Record<string, number | null | undefined>;
  best: number;
  total: number;
  /** Valor usado para ordenar (melhor, soma ou soma das 2 melhores). */
  score: number;
  /** Soma dos critérios de desempate (OBR: tempos). null se não houver. */
  tbTotal: number | null;
  evaluated: number;
}

type Settings = Pick<LiveSettings, "rankingMode" | "enablePlayoffs" | "playoffFormat"> & { direction?: LiveSettings["direction"] };

export function qualifyingRounds(rounds: LiveRound[]) {
  return rounds.filter((r) => r.kind === "qualifying").sort((a, b) => a.position - b.position);
}

export function scoreIndex(scores: LiveScore[]) {
  const map = new Map<string, LiveScore>();
  for (const s of scores) map.set(`${s.teamId}:${s.roundId}`, s);
  return map;
}

/** Ordena chaves "maior é melhor"; posição ausente perde de qualquer valor. */
function compareDesc(a: number[], b: number[]) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i];
    const y = b[i];
    if (x === undefined && y === undefined) continue;
    if (x === undefined) return 1;
    if (y === undefined) return -1;
    if (x !== y) return y - x;
  }
  return 0;
}

export function computeRanking(
  teams: LiveTeam[],
  rounds: LiveRound[],
  scores: LiveScore[],
  settings: Settings,
): RankingRow[] {
  const quals = qualifyingRounds(rounds);
  // Notas pendentes de aprovação não contam na classificação.
  const idx = scoreIndex(scores.filter((s) => !s.pending));

  const rows = teams.map((team) => {
    const byRound: RankingRow["byRound"] = {};
    const visible: number[] = [];
    let evaluated = 0;
    let tbTotal: number | null = null;
    for (const r of quals) {
      const s = idx.get(`${team.id}:${r.id}`);
      if (!s) continue;
      evaluated++;
      byRound[r.id] = s.points;
      if (s.points !== null) visible.push(s.points);
      if (typeof s.tb === "number") tbTotal = (tbTotal ?? 0) + s.tb;
    }
    const lower = settings.direction === "lower";
    // "Melhor primeiro" e, para menor-vence, invertemos o sinal na chave.
    const sorted = [...visible].sort((a, b) => (lower ? a - b : b - a));
    const best = sorted[0] ?? 0;
    const total = visible.reduce((a, b) => a + b, 0);
    const sign = lower ? -1 : 1;
    const top2 = sorted.slice(0, 2).reduce((a, b) => a + b, 0);
    const score = settings.rankingMode === "sum" ? total : settings.rankingMode === "best2" ? top2 : best;
    // chave: resultado principal, depois (se houver) menor soma de tempos, depois as rodadas da melhor para a pior
    const head = visible.length ? [score * sign] : [];
    const tb = visible.length && tbTotal !== null ? [-tbTotal] : [];
    const tail = settings.rankingMode === "best" ? sorted.slice(1).map((v) => v * sign) : sorted.map((v) => v * sign);
    const key = [...head, ...tb, ...tail];
    return { team, byRound, best, total, score, tbTotal, evaluated, key };
  });

  rows.sort((a, b) => compareDesc(a.key, b.key) || a.team.name.localeCompare(b.team.name, "pt-BR"));

  let lastKey: number[] | null = null;
  let lastRank = 0;
  return rows.map((row, i) => {
    const rank = lastKey && compareDesc(lastKey, row.key) === 0 ? lastRank : i + 1;
    lastKey = row.key;
    lastRank = rank;
    const { key: _key, ...rest } = row;
    void _key;
    return { ...rest, rank };
  });
}

export interface RoundProgress {
  round: LiveRound;
  done: number;
  total: number;
  complete: boolean;
}

export function roundProgress(teams: LiveTeam[], rounds: LiveRound[], scores: LiveScore[]): RoundProgress[] {
  const idx = scoreIndex(scores);
  return qualifyingRounds(rounds).map((round) => {
    const done = teams.filter((t) => idx.has(`${t.id}:${round.id}`)).length;
    return { round, done, total: teams.length, complete: teams.length > 0 && done === teams.length };
  });
}

/** Primeira rodada classificatória que ainda tem equipe sem nota. */
export function currentRound(teams: LiveTeam[], rounds: LiveRound[], scores: LiveScore[]) {
  return roundProgress(teams, rounds, scores).find((p) => !p.complete)?.round ?? null;
}

export function isQualifyingComplete(teams: LiveTeam[], rounds: LiveRound[], scores: LiveScore[]) {
  const progress = roundProgress(teams, rounds, scores);
  return progress.length > 0 && progress.every((p) => p.complete);
}

/* ------------------------------------------------------------ playoffs */

export type PlayoffPhase = "off" | "waiting" | "semifinal" | "final" | "done";

export interface PlayoffSlot {
  team: LiveTeam;
  seed: number;
  points: number | null | undefined;
}

export interface PlayoffState {
  phase: PlayoffPhase;
  semifinalRound: LiveRound | null;
  finalRound: LiveRound | null;
  semifinal: PlayoffSlot[];
  final: PlayoffSlot[];
  champion: LiveTeam | null;
}

function rankSlots(slots: PlayoffSlot[], direction: "higher" | "lower" = "higher") {
  const val = (p: number | null | undefined) =>
    p === null || p === undefined ? -Infinity : direction === "lower" ? -p : p;
  return [...slots].sort((a, b) => val(b.points) - val(a.points) || a.seed - b.seed);
}

export function computePlayoffs(
  teams: LiveTeam[],
  rounds: LiveRound[],
  scores: LiveScore[],
  settings: Settings,
): PlayoffState {
  scores = scores.filter((s) => !s.pending);
  const semifinalRound = rounds.find((r) => r.kind === "semifinal") ?? null;
  const finalRound = rounds.find((r) => r.kind === "final") ?? null;
  const empty: PlayoffState = { phase: "off", semifinalRound, finalRound, semifinal: [], final: [], champion: null };

  if (!settings.enablePlayoffs || !finalRound) return empty;
  const useSemis = settings.playoffFormat === "semifinal" && !!semifinalRound;
  const needed = useSemis ? 4 : 2;
  if (teams.length < needed) return empty;

  if (!isQualifyingComplete(teams, rounds, scores)) return { ...empty, phase: "waiting" };

  const idx = scoreIndex(scores);
  const ranking = computeRanking(teams, rounds, scores, settings);
  const slot = (row: RankingRow, roundId: string, seed: number): PlayoffSlot => {
    const s = idx.get(`${row.team.id}:${roundId}`);
    return { team: row.team, seed, points: s ? s.points : undefined };
  };

  let finalists: RankingRow[];
  let semifinal: PlayoffSlot[] = [];

  if (useSemis) {
    semifinal = ranking.slice(0, 4).map((row, i) => slot(row, semifinalRound!.id, i + 1));
    const semiDone = semifinal.every((s) => s.points !== undefined);
    if (!semiDone) return { ...empty, phase: "semifinal", semifinal };
    const top2 = rankSlots(semifinal, settings.direction).slice(0, 2).map((s) => s.team.id);
    finalists = ranking.filter((r) => top2.includes(r.team.id));
    // mantém a ordem da semifinal (melhor nota primeiro)
    finalists.sort((a, b) => top2.indexOf(a.team.id) - top2.indexOf(b.team.id));
  } else {
    finalists = ranking.slice(0, 2);
  }

  const final = finalists.map((row) => {
    const seed = ranking.findIndex((r) => r.team.id === row.team.id) + 1;
    return slot(row, finalRound.id, seed);
  });
  const finalDone = final.every((s) => s.points !== undefined);
  if (!finalDone) return { ...empty, phase: "final", semifinal, final };

  const hidden = final.some((s) => s.points === null);
  const champion = hidden ? null : rankSlots(final, settings.direction)[0].team;
  return { ...empty, phase: "done", semifinal, final, champion };
}

/** Rodadas em que uma equipe ainda pode receber nota agora. */
export function availableRoundsForTeam(
  teamId: string,
  teams: LiveTeam[],
  rounds: LiveRound[],
  scores: LiveScore[],
  settings: Settings & Pick<LiveSettings, "showOnlyCurrentRound">,
  /** Rodadas permitidas para esta mesa (null/undefined = todas). */
  allowedRoundIds?: string[] | null,
): LiveRound[] {
  if (allowedRoundIds?.length) {
    const allowed = new Set(allowedRoundIds);
    return availableRoundsForTeam(teamId, teams, rounds, scores, settings).filter((r) => allowed.has(r.id));
  }
  const idx = scoreIndex(scores);
  const has = (roundId: string) => idx.has(`${teamId}:${roundId}`);

  const extraRounds = rounds.filter((r) => r.kind === "extra" && !has(r.id));
  const playoffs = computePlayoffs(teams, rounds, scores, settings);
  if (playoffs.phase === "semifinal" && playoffs.semifinalRound) {
    return playoffs.semifinal.some((s) => s.team.id === teamId) && !has(playoffs.semifinalRound.id)
      ? [playoffs.semifinalRound, ...extraRounds]
      : extraRounds;
  }
  if (playoffs.phase === "final" && playoffs.finalRound) {
    return playoffs.final.some((s) => s.team.id === teamId) && !has(playoffs.finalRound.id)
      ? [playoffs.finalRound, ...extraRounds]
      : extraRounds;
  }

  // Desafios extras: sempre disponíveis para quem ainda não tem nota neles.
  const extras = rounds.filter((r) => r.kind === "extra" && !has(r.id)).sort((a, b) => a.position - b.position);
  const quals = qualifyingRounds(rounds).filter((r) => !has(r.id));
  if (settings.showOnlyCurrentRound) {
    const current = currentRound(teams, rounds, scores);
    return [...(current ? quals.filter((r) => r.id === current.id) : []), ...extras];
  }
  return [...quals, ...extras];
}

/** Ranking de um desafio extra (ranking próprio, fora da classificação geral). */
export function computeExtraRanking(teams: LiveTeam[], round: LiveRound, scores: LiveScore[]) {
  const lower = round.extra?.scoring.direction === "lower";
  const rows = scores
    .filter((s) => s.roundId === round.id && !s.pending)
    .map((s) => ({ team: teams.find((t) => t.id === s.teamId)!, value: s.points }))
    .filter((r) => r.team);
  rows.sort((a, b) => {
    if (a.value === null) return 1;
    if (b.value === null) return -1;
    return lower ? a.value - b.value : b.value - a.value;
  });
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}
