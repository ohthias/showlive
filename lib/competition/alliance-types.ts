/**
 * Formato de alianças (estilo FTC): partidas com equipes agrupadas em
 * alianças. Tipos puros, sem dependências — ficam dentro do desafio
 * (`Challenge.alliance`), então vão junto para os templates.
 */

/** versus: vermelha × azul. coop: uma aliança contra o placar (estilo VEX IQ Teamwork). */
export type AllianceMode = "versus" | "coop";

/** RP extra quando a aliança atinge uma pontuação mínima (no total ou em um grupo da súmula). */
export interface AllianceBonusRp {
  id: string;
  label: string;
  /** Grupo da súmula (ex.: "Autônomo"); null = pontuação total da aliança antes das penalidades. */
  group: string | null;
  min: number;
  rp: number;
}

/**
 * Critério principal da classificação:
 *  rp_avg    — média de RP por partida (Ranking Score da FTC)
 *  rp_total  — soma de RP
 *  score_avg — média de pontos da aliança (modo cooperativo)
 */
export type AllianceRankBy = "rp_avg" | "rp_total" | "score_avg";

/**
 * Desempates, na ordem:
 *  avg       — média de pontos da aliança
 *  high      — maior pontuação
 *  margin    — saldo médio (pontos − pontos do adversário)
 *  wins      — vitórias
 *  penalties — menos penalidades cometidas (média)
 *  group:X   — média de pontos no grupo X da súmula (ex.: group:Autônomo)
 */
export type AllianceTiebreaker = string;

export interface AllianceConfig {
  mode: AllianceMode;
  /** Equipes por aliança (1 a 4). */
  teamsPerAlliance: number;
  /** Partidas por equipe no gerador de cronograma. */
  matchesPerTeam: number;
  /** opponent: penalidades viram pontos do adversário (FTC/FRC). self: descontam da própria aliança. */
  penaltiesTo: "opponent" | "self";
  /** RP por resultado (só versus). */
  rp: { win: number; tie: number; loss: number };
  bonusRp: AllianceBonusRp[];
  rankBy: AllianceRankBy;
  tiebreakers: AllianceTiebreaker[];
  /** Descarta as N piores partidas de cada equipe (só quando ela jogou mais que N). */
  dropLowest: number;
}

export type AllianceColor = "red" | "blue";

export interface AllianceSlot {
  teamId: string;
  /** Partida extra para completar o cronograma: não conta na classificação. */
  surrogate?: boolean;
}

/** Situação individual de uma equipe na partida. */
export type TeamMatchFlag = "noshow" | "dq";

/** Resultado de uma aliança, recalculado no servidor. */
export interface AllianceResult {
  responses: Record<string, number>;
  /** Pontos dos itens (antes de penalidades). */
  base: number;
  /** Penalidades cometidas por esta aliança (valor positivo). */
  penalty: number;
  /** Pontos por grupo da súmula (desempates e RP bônus). */
  byGroup: Record<string, number>;
  /** RP bônus conquistados (rótulos). */
  bonus: string[];
  bonusRp: number;
  /** Placar final da aliança. */
  score: number;
}

export interface MatchResult {
  red: AllianceResult;
  blue: AllianceResult | null;
  flags: Record<string, TeamMatchFlag>;
}
