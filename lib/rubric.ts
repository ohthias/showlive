import type {
  EvaluationComments,
  EvaluationFeedback,
  EvaluationScores,
  RubricCriterion,
  RubricDefinition,
  RubricLevel,
} from "./rubric-types";

export type * from "./rubric-types";

/**
 * Avaliação por rubricas — funções puras (servidor e navegador).
 *
 * Uma rubrica tem uma escala (ex.: 1 a 4) e critérios agrupados em seções.
 * Total = Σ nível × peso do critério; máximo = Σ maior nível × peso.
 * O percentual (total ÷ máximo) é o que compara rubricas de tamanhos
 * diferentes na classificação geral.
 */

export const LIMITS = {
  levels: { min: 2, max: 10 },
  sections: 12,
  criteria: 60,
  rubricsPerEvent: 12,
  roomsPerEvent: 30,
  comment: 600,
  feedback: 1500,
} as const;

let seq = 0;
export const rubricId = (prefix = "c") => `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}`;

export const FLL_LEVELS: RubricLevel[] = [
  { value: 1, label: "Iniciante" },
  { value: 2, label: "Em desenvolvimento" },
  { value: 3, label: "Realizado" },
  { value: 4, label: "Excepcional" },
];

export function blankRubric(): RubricDefinition {
  return {
    levels: FLL_LEVELS.map((l) => ({ ...l })),
    sections: [{ id: rubricId("s"), title: "Critérios", criteria: [{ id: rubricId(), label: "Novo critério" }] }],
    commentFromLevel: null,
    requireFeedback: false,
  };
}

export function allCriteria(def: RubricDefinition): RubricCriterion[] {
  return def.sections.flatMap((s) => s.criteria);
}

const clean = (v: unknown, max: number) =>
  String(v ?? "")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, max);
const cleanLong = (v: unknown, max: number) =>
  String(v ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
const safeId = (v: unknown, fallback: string) => {
  const s = String(v ?? "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
  return s || fallback;
};

/** Valida e normaliza uma definição vinda do navegador. Lança Error com mensagem para a tela. */
export function sanitizeRubric(input: unknown): RubricDefinition {
  const raw = (input ?? {}) as Partial<RubricDefinition>;

  const levelsRaw = Array.isArray(raw.levels) ? raw.levels : [];
  const levels: RubricLevel[] = [];
  const seenValues = new Set<number>();
  for (const l of levelsRaw.slice(0, LIMITS.levels.max)) {
    const value = Math.round(Number((l as RubricLevel)?.value));
    if (!Number.isFinite(value) || value < 0 || value > 100 || seenValues.has(value)) continue;
    seenValues.add(value);
    levels.push({ value, label: clean((l as RubricLevel).label, 30) || String(value) });
  }
  levels.sort((a, b) => a.value - b.value);
  if (levels.length < LIMITS.levels.min) throw new Error("A escala precisa de pelo menos 2 níveis com valores diferentes.");

  const ids = new Set<string>();
  const unique = (id: string) => {
    let out = id;
    while (ids.has(out)) out = `${id}_${ids.size}`;
    ids.add(out);
    return out;
  };

  let criteriaCount = 0;
  const sections = (Array.isArray(raw.sections) ? raw.sections : []).slice(0, LIMITS.sections).map((s, si) => {
    const criteria = (Array.isArray(s?.criteria) ? s.criteria : [])
      .slice(0, Math.max(0, LIMITS.criteria - criteriaCount))
      .map((c, ci): RubricCriterion | null => {
        const label = clean(c?.label, 120);
        if (!label) return null;
        const weight = Number(c?.weight ?? 1);
        const hints = Array.isArray(c?.hints) ? c.hints.slice(0, levels.length).map((h) => cleanLong(h, 400)) : [];
        const out: RubricCriterion = { id: unique(safeId(c?.id, `c${si}_${ci}`)), label };
        const description = cleanLong(c?.description, 500);
        if (description) out.description = description;
        if (hints.some(Boolean)) out.hints = hints;
        if (Number.isFinite(weight) && weight !== 1) out.weight = Math.min(10, Math.max(0, Math.round(weight * 100) / 100));
        return out;
      })
      .filter((c): c is RubricCriterion => !!c);
    criteriaCount += criteria.length;
    return { id: unique(safeId(s?.id, `s${si}`)), title: clean(s?.title, 80) || `Seção ${si + 1}`, criteria };
  }).filter((s) => s.criteria.length > 0);

  if (!criteriaCount) throw new Error("Adicione pelo menos um critério.");

  const cfl = raw.commentFromLevel;
  const commentFromLevel = cfl === null || cfl === undefined || !levels.some((l) => l.value === Number(cfl)) ? null : Number(cfl);

  return { levels, sections, commentFromLevel, requireFeedback: !!raw.requireFeedback };
}

/** Mantém só respostas de critérios que existem e com níveis válidos. */
export function sanitizeScores(def: RubricDefinition, raw: unknown): EvaluationScores {
  const valid = new Set(def.levels.map((l) => l.value));
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: EvaluationScores = {};
  for (const c of allCriteria(def)) {
    const v = Number(src[c.id]);
    if (src[c.id] !== undefined && src[c.id] !== null && valid.has(v)) out[c.id] = v;
  }
  return out;
}

export function sanitizeComments(def: RubricDefinition, raw: unknown): EvaluationComments {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: EvaluationComments = {};
  for (const c of allCriteria(def)) {
    const t = cleanLong(src[c.id], LIMITS.comment);
    if (t) out[c.id] = t;
  }
  return out;
}

export function sanitizeFeedback(raw: unknown): EvaluationFeedback {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: EvaluationFeedback = {};
  const strengths = cleanLong(src.strengths, LIMITS.feedback);
  const improvements = cleanLong(src.improvements, LIMITS.feedback);
  if (strengths) out.strengths = strengths;
  if (improvements) out.improvements = improvements;
  return out;
}

export interface RubricScore {
  total: number;
  max: number;
  /** 0–100 */
  percent: number;
  answered: number;
  criteria: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function scoreRubric(def: RubricDefinition, scores: EvaluationScores): RubricScore {
  const top = Math.max(...def.levels.map((l) => l.value));
  let total = 0;
  let max = 0;
  let answered = 0;
  const list = allCriteria(def);
  for (const c of list) {
    const w = c.weight ?? 1;
    max += top * w;
    const v = scores[c.id];
    if (typeof v === "number") {
      answered++;
      total += v * w;
    }
  }
  return { total: round2(total), max: round2(max), percent: max > 0 ? round2((total / max) * 100) : 0, answered, criteria: list.length };
}

export interface SubmitProblem {
  criterionId?: string;
  message: string;
}

/** O que falta para enviar (rascunho pode ficar incompleto). */
export function submitProblems(
  def: RubricDefinition,
  scores: EvaluationScores,
  comments: EvaluationComments,
  feedback: EvaluationFeedback,
): SubmitProblem[] {
  const out: SubmitProblem[] = [];
  for (const c of allCriteria(def)) {
    const v = scores[c.id];
    if (typeof v !== "number") out.push({ criterionId: c.id, message: `Sem nível: ${c.label}` });
    else if (def.commentFromLevel !== null && v >= def.commentFromLevel && !comments[c.id]?.trim()) {
      const lvl = def.levels.find((l) => l.value === def.commentFromLevel)?.label ?? def.commentFromLevel;
      out.push({ criterionId: c.id, message: `Justifique o nível (a partir de "${lvl}" o comentário é obrigatório): ${c.label}` });
    }
  }
  if (def.requireFeedback && (!feedback.strengths?.trim() || !feedback.improvements?.trim()))
    out.push({ message: "Preencha os pontos fortes e o que a equipe pode melhorar." });
  return out;
}

/* ------------------------------------------------------- resultados */

export interface ResultsRubric {
  id: string;
  name: string;
  weight: number;
}
export interface ResultsTeam {
  id: string;
  name: string;
  number: string | null;
}
export interface ResultsEvaluation {
  teamId: string;
  rubricId: string;
  percent: number;
  total: number;
  max: number;
  status: "draft" | "submitted";
}

export interface RubricRankingRow {
  team: ResultsTeam;
  /** Média dos percentuais das fichas enviadas (null = sem ficha enviada). */
  percent: number | null;
  total: number | null;
  max: number | null;
  sheets: number;
  rank: number | null;
}

export interface OverallRow {
  team: ResultsTeam;
  /** Percentual por rubrica (null = sem ficha enviada). */
  byRubric: Record<string, number | null>;
  robotGame: number | null;
  /** Média ponderada (0–100). Rubricas sem ficha contam 0. */
  overall: number;
  complete: boolean;
  rank: number;
}

function rankBy<T>(rows: T[], value: (r: T) => number | null, name: (r: T) => string): (T & { rank: number | null })[] {
  const sorted = [...rows].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va === null && vb === null) return name(a).localeCompare(name(b), "pt-BR");
    if (va === null) return 1;
    if (vb === null) return -1;
    return vb - va || name(a).localeCompare(name(b), "pt-BR");
  });
  let last: number | null = null;
  let lastRank = 0;
  return sorted.map((r, i) => {
    const v = value(r);
    if (v === null) return { ...r, rank: null };
    const rank = last !== null && last === v ? lastRank : i + 1;
    last = v;
    lastRank = rank;
    return { ...r, rank };
  });
}

/** Classificação de uma rubrica: só fichas enviadas contam; várias fichas da mesma equipe viram média. */
export function rankRubric(teams: ResultsTeam[], rubricIdToRank: string, evaluations: ResultsEvaluation[]): RubricRankingRow[] {
  const rows = teams.map((team) => {
    const mine = evaluations.filter((e) => e.teamId === team.id && e.rubricId === rubricIdToRank && e.status === "submitted");
    if (!mine.length) return { team, percent: null, total: null, max: null, sheets: 0 };
    const avg = (f: (e: ResultsEvaluation) => number) => round2(mine.reduce((a, e) => a + f(e), 0) / mine.length);
    return { team, percent: avg((e) => e.percent), total: avg((e) => e.total), max: avg((e) => e.max), sheets: mine.length };
  });
  return rankBy(rows, (r) => r.percent, (r) => r.team.name);
}

/**
 * Classificação geral da avaliação: média ponderada dos percentuais de cada
 * rubrica (peso da rubrica) e, opcionalmente, da partida (nota da equipe em
 * relação à melhor do evento, peso configurável).
 */
export function rankOverall(
  teams: ResultsTeam[],
  rubrics: ResultsRubric[],
  evaluations: ResultsEvaluation[],
  robotGame?: { weight: number; scores: Record<string, number | null>; direction: "higher" | "lower" },
): OverallRow[] {
  const per = new Map(rubrics.map((r) => [r.id, new Map(rankRubric(teams, r.id, evaluations).map((x) => [x.team.id, x.percent]))]));

  let rg: Map<string, number | null> | null = null;
  if (robotGame && robotGame.weight > 0) {
    const vals = Object.values(robotGame.scores).filter((v): v is number => typeof v === "number" && v > 0);
    const best = vals.length ? (robotGame.direction === "lower" ? Math.min(...vals) : Math.max(...vals)) : 0;
    rg = new Map(
      teams.map((t) => {
        const v = robotGame.scores[t.id];
        if (typeof v !== "number" || !best) return [t.id, null];
        if (v <= 0) return [t.id, 0];
        return [t.id, round2(robotGame.direction === "lower" ? (best / v) * 100 : (v / best) * 100)];
      }),
    );
  }

  const totalWeight = rubrics.reduce((a, r) => a + Math.max(0, r.weight), 0) + (rg ? robotGame!.weight : 0);
  const rows = teams.map((team) => {
    const byRubric: Record<string, number | null> = {};
    let acc = 0;
    let complete = true;
    for (const r of rubrics) {
      const p = per.get(r.id)?.get(team.id) ?? null;
      byRubric[r.id] = p;
      if (p === null) complete = false;
      acc += (p ?? 0) * Math.max(0, r.weight);
    }
    const robot = rg ? (rg.get(team.id) ?? null) : null;
    if (rg) acc += (robot ?? 0) * robotGame!.weight;
    const overall = totalWeight > 0 ? round2(acc / totalWeight) : 0;
    return { team, byRubric, robotGame: robot, overall, complete };
  });
  return rankBy(rows, (r) => r.overall, (r) => r.team.name).map((r) => ({ ...r, rank: r.rank ?? 0 }));
}

/* -------------------------------------------------------- cronograma */

export interface ScheduleInput {
  /** Equipes na ordem desejada. */
  teamIds: string[];
  roomIds: string[];
  /** Início do primeiro horário (ms desde a época). */
  startMs: number;
  durationMin: number;
  /** Intervalo entre sessões na mesma sala (troca, deliberação). */
  gapMin: number;
}

export interface ScheduleSlot {
  teamId: string;
  roomId: string;
  startsAt: Date;
  durationMin: number;
}

/**
 * Distribui as equipes pelas salas em ondas: na 1ª onda cada sala recebe uma
 * equipe no mesmo horário, na 2ª onda o horário avança (duração + intervalo)...
 */
export function buildSchedule({ teamIds, roomIds, startMs, durationMin, gapMin }: ScheduleInput): ScheduleSlot[] {
  if (!roomIds.length || !teamIds.length) return [];
  const step = (Math.max(1, durationMin) + Math.max(0, gapMin)) * 60_000;
  return teamIds.map((teamId, i) => ({
    teamId,
    roomId: roomIds[i % roomIds.length],
    startsAt: new Date(startMs + Math.floor(i / roomIds.length) * step),
    durationMin: Math.max(1, durationMin),
  }));
}

/** Rubricas que uma sala aplica (lista vazia = todas, na ordem do evento). */
export function roomRubrics<T extends { id: string }>(all: T[], roomRubricIds: string[] | null | undefined): T[] {
  if (!roomRubricIds?.length) return all;
  const set = new Set(roomRubricIds);
  return all.filter((r) => set.has(r.id));
}
