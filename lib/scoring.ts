import type { Mission, RequirementRule } from "./missions";

/**
 * Motor de pontuação — portado de utils/scores.ts do RoboStage.
 *
 * Toda resposta é o ÍNDICE da opção escolhida (0, 1, 2...), nunca o valor
 * em pontos. Regras suportadas: `requires`, `when_self`,
 * `zero_whole_mission_if_false`. GP (Gracious Professionalism) não entra no
 * total do round: vai para `extras`.
 *
 * O servidor SEMPRE recalcula a nota a partir das respostas — o total que a
 * mesa mostra é só uma prévia.
 */

export type MissionResponses = { [index: number]: number };
export type RoundResponses = { [missionId: string]: MissionResponses };

function switchOptionsCount(type: Mission["type"]): number {
  return type.slice(1).filter((v) => v !== null).length;
}

export function computePoints(
  type: Mission["type"],
  points: number | number[],
  idx: number | undefined,
): number {
  if (idx === undefined || idx === null || idx < 0) return 0;
  if (Array.isArray(points)) return Number(points[idx] ?? 0);
  const flat = Number(points) || 0;
  if (type[0] === "range") return flat * idx;
  return switchOptionsCount(type) > 2 ? flat : idx === 1 ? flat : 0;
}

function buildRegistry(mission: Mission) {
  const registry = new Map<string, { index: number; type: Mission["type"] }>();
  registry.set(mission.id, { index: 0, type: mission.type });
  (mission["sub-mission"] || []).forEach((sub, i) => {
    if (sub.id) registry.set(sub.id, { index: i + 1, type: sub.type });
  });
  return registry;
}

function matchesExpected(
  idx: number | undefined,
  expected: boolean | number | [number, number],
): boolean {
  if (idx === undefined || idx === null) return false;
  if (typeof expected === "boolean") return expected ? idx === 1 : idx === 0;
  if (Array.isArray(expected)) return idx >= expected[0] && idx <= expected[1];
  return idx === Number(expected);
}

function isRuleActive(rule: RequirementRule, selfIdx: number | undefined, selfType: Mission["type"]) {
  const [, flag] = rule.condition ?? ["if", true];
  if (flag === false) return false;
  if (rule.when_self !== undefined) {
    const options = selfType.slice(1).filter((v) => v !== null);
    const wanted = options.indexOf(rule.when_self);
    if (wanted === -1 || selfIdx !== wanted) return false;
  }
  return true;
}

function requirementsMet(
  requires: RequirementRule[] | undefined,
  selfIdx: number | undefined,
  selfType: Mission["type"],
  responses: MissionResponses,
  registry: ReturnType<typeof buildRegistry>,
) {
  if (!requires?.length) return true;
  const active = requires.filter((r) => isRuleActive(r, selfIdx, selfType));
  return active.every((rule) => {
    const target = registry.get(rule.mission);
    return target ? matchesExpected(responses[target.index], rule.value) : false;
  });
}

export interface MissionBreakdown {
  mainPoints: number;
  subPoints: number[];
  total: number;
  gated: boolean;
  unmet: number[];
}

export function computeMissionBreakdown(
  mission: Mission,
  responses: MissionResponses = {},
): MissionBreakdown {
  const registry = buildRegistry(mission);
  const subs = mission["sub-mission"] || [];
  let mainPoints = computePoints(mission.type, mission.points, responses[0]);
  const unmet: number[] = [];
  let subPoints = subs.map((sub, i) => {
    const idx = responses[i + 1];
    const ok = requirementsMet(sub.requires, idx, sub.type, responses, registry);
    if (!ok && idx !== undefined) unmet.push(i);
    return ok ? computePoints(sub.type, sub.points, idx) : 0;
  });
  const gated = subs.some((sub, i) => sub.zero_whole_mission_if_false && responses[i + 1] !== 1);
  if (gated) {
    mainPoints = 0;
    subPoints = subPoints.map(() => 0);
  }
  return { mainPoints, subPoints, total: mainPoints + subPoints.reduce((a, b) => a + b, 0), gated, unmet };
}

export const NON_SCORING_MISSIONS = new Set(["GP"]);

export function sumAllMissions(missions: Mission[], responses: RoundResponses): number {
  return missions
    .filter((m) => !NON_SCORING_MISSIONS.has(m.id))
    .reduce((acc, m) => acc + computeMissionBreakdown(m, responses[m.id]).total, 0);
}

/** Remove índices fora do intervalo/inexistentes — o cliente não é confiável. */
export function sanitizeResponses(missions: Mission[], raw: unknown): RoundResponses {
  const out: RoundResponses = {};
  if (!raw || typeof raw !== "object") return out;
  const input = raw as Record<string, Record<string, unknown>>;

  const optionCount = (type: Mission["type"], points: number | number[]) => {
    if (type[0] === "range") {
      const start = Number(type[1]) || 0;
      const end = Number(type[2]) || 10;
      return end - start + 1;
    }
    const n = switchOptionsCount(type);
    if (n > 0) return n;
    return Array.isArray(points) ? points.length : 2;
  };

  for (const mission of missions) {
    const given = input[mission.id];
    if (!given || typeof given !== "object") continue;
    const parts = [
      { type: mission.type, points: mission.points },
      ...(mission["sub-mission"] || []).map((s) => ({ type: s.type, points: s.points })),
    ];
    const clean: MissionResponses = {};
    parts.forEach((part, index) => {
      const v = Number(given[index]);
      if (Number.isInteger(v) && v >= 0 && v < optionCount(part.type, part.points)) clean[index] = v;
    });
    if (Object.keys(clean).length) out[mission.id] = clean;
  }
  return out;
}

export interface RoundResult {
  points: number;
  extras: {
    gp?: { label: string; points: number };
    pt?: { remaining: number; points: number };
  };
}

export function scoreRound(missions: Mission[], responses: RoundResponses): RoundResult {
  const extras: RoundResult["extras"] = {};

  const gp = missions.find((m) => m.id === "GP");
  const gpIdx = responses.GP?.[0];
  if (gp && gpIdx !== undefined) {
    const label = String(gp.type.slice(1).filter((v) => v !== null)[gpIdx] ?? gpIdx);
    extras.gp = { label, points: computePoints(gp.type, gp.points, gpIdx) };
  }

  const pt = missions.find((m) => m.id === "PT");
  const ptIdx = responses.PT?.[0];
  if (pt && ptIdx !== undefined) {
    extras.pt = { remaining: (Number(pt.type[1]) || 0) + ptIdx, points: computePoints(pt.type, pt.points, ptIdx) };
  }

  return { points: sumAllMissions(missions, responses), extras };
}

/** Maior nota possível da temporada (usada só para barras de progresso). */
export function maxScore(missions: Mission[]): number {
  let total = 0;
  for (const m of missions) {
    if (NON_SCORING_MISSIONS.has(m.id)) continue;
    const parts = [m, ...(m["sub-mission"] || [])];
    for (const p of parts) {
      const pts = p.points;
      if (Array.isArray(pts)) total += Math.max(0, ...pts.map(Number));
      else if (p.type[0] === "range") total += (Number(pts) || 0) * ((Number(p.type[2]) || 10) - (Number(p.type[1]) || 0));
      else total += Number(pts) || 0;
    }
  }
  return total;
}
