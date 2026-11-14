import type { AllianceBonusRp, AllianceConfig } from "./alliance-types";

/**
 * Configuração do formato de alianças. Sem dependências do motor de
 * desafios (é usada por lib/challenge.ts ao validar um desafio).
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const num = (v: unknown, fallback: number, lo: number, hi: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? clamp(n, lo, hi) : fallback;
};
const txt = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export const ALLIANCE_LIMITS = { teams: 4, matchesPerTeam: 20, bonusRp: 6, tiebreakers: 5, dropLowest: 5 } as const;

export const DEFAULT_ALLIANCE: AllianceConfig = {
  mode: "versus",
  teamsPerAlliance: 2,
  matchesPerTeam: 5,
  penaltiesTo: "opponent",
  rp: { win: 3, tie: 1, loss: 0 },
  bonusRp: [],
  rankBy: "rp_avg",
  tiebreakers: ["avg", "high"],
  dropLowest: 0,
};

export const TIEBREAKER_LABELS: Record<string, string> = {
  avg: "Média de pontos",
  high: "Maior pontuação",
  margin: "Saldo médio",
  wins: "Vitórias",
  penalties: "Menos penalidades",
};

export function tiebreakerLabel(t: string) {
  return t.startsWith("group:") ? `Média no ${t.slice(6)}` : (TIEBREAKER_LABELS[t] ?? t);
}

export const RANK_BY_LABELS: Record<AllianceConfig["rankBy"], string> = {
  rp_avg: "Média de RP (Ranking Score)",
  rp_total: "Soma de RP",
  score_avg: "Média de pontos",
};

/** Grupos da súmula, na ordem em que aparecem (Autônomo, Teleoperado...). */
export function challengeGroups(ch: { items: { group?: string }[] }): string[] {
  return [...new Set(ch.items.map((i) => i.group).filter((g): g is string => !!g))];
}


/** Normaliza a configuração vinda do navegador ou de um template. */
export function sanitizeAlliance(raw: unknown, groups: string[]): AllianceConfig {
  const r = (raw ?? {}) as Partial<AllianceConfig>;
  const mode = r.mode === "coop" ? "coop" : "versus";
  const rpRaw = (r.rp ?? {}) as Partial<AllianceConfig["rp"]>;
  const groupSet = new Set(groups);
  const ids = new Set<string>();
  const bonusRp: AllianceBonusRp[] = (Array.isArray(r.bonusRp) ? r.bonusRp : [])
    .slice(0, ALLIANCE_LIMITS.bonusRp)
    .map((b, i) => {
      let id = String(b?.id ?? "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 30) || `b${i}`;
      while (ids.has(id)) id = `${id}_${i}`;
      ids.add(id);
      const group = b?.group && groupSet.has(String(b.group)) ? String(b.group) : null;
      return { id, label: txt(b?.label, 60) || "RP bônus", group, min: num(b?.min, 0, 0, 100000), rp: Math.round(num(b?.rp, 1, 0, 10)) };
    });
  const rankBy: AllianceConfig["rankBy"] = mode === "coop" ? "score_avg" : r.rankBy === "rp_total" || r.rankBy === "score_avg" ? r.rankBy : "rp_avg";
  const validTb = (t: unknown) => {
    const s = String(t ?? "");
    if (s.startsWith("group:")) return groupSet.has(s.slice(6));
    if (mode === "coop") return s === "avg" || s === "high";
    return s in TIEBREAKER_LABELS;
  };
  const tiebreakers = [...new Set((Array.isArray(r.tiebreakers) ? r.tiebreakers : DEFAULT_ALLIANCE.tiebreakers).map(String))]
    .filter(validTb)
    .slice(0, ALLIANCE_LIMITS.tiebreakers);

  return {
    mode,
    teamsPerAlliance: Math.round(num(r.teamsPerAlliance, 2, 1, ALLIANCE_LIMITS.teams)),
    matchesPerTeam: Math.round(num(r.matchesPerTeam, 5, 1, ALLIANCE_LIMITS.matchesPerTeam)),
    penaltiesTo: mode === "coop" ? "self" : r.penaltiesTo === "self" ? "self" : "opponent",
    rp: {
      win: num(rpRaw.win, 3, 0, 10),
      tie: num(rpRaw.tie, 1, 0, 10),
      loss: num(rpRaw.loss, 0, 0, 10),
    },
    bonusRp: mode === "coop" ? [] : bonusRp,
    rankBy,
    tiebreakers,
    dropLowest: Math.round(num(r.dropLowest, 0, 0, ALLIANCE_LIMITS.dropLowest)),
  };
}

