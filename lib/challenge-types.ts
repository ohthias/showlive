/**
 * Modelo de um desafio personalizado. Fica salvo como JSON em
 * events.challenge (o que vale para o evento) e em challenge_templates
 * (para reutilizar). Sem dependências: é importado pelo schema do banco.
 */

import type { AllianceConfig } from "./alliance-types";

export type ChallengeType = "missions" | "time" | "judged" | "measure";

/**
 * check  — Sim/Não, vale `points` se Sim
 * count  — quantidade de 0 a `max`, vale `points` cada
 * choice — uma das `options`, cada uma com seus pontos
 * scale  — nota de `min` a `max` (rubrica), multiplicada pelo peso `points`
 * number — valor medido (ex.: cm), multiplicado por `points` (fator)
 * time   — tempo em segundos (desafios contra o relógio)
 */
export type ItemKind = "check" | "count" | "choice" | "scale" | "number" | "time";

export interface ChallengeItem {
  id: string;
  label: string;
  description?: string;
  kind: ItemKind;
  points?: number;
  min?: number;
  max?: number;
  options?: { label: string; points: number }[];
  /** A mesa só envia com este item preenchido. */
  required?: boolean;
  /** Agrupa itens na súmula (ex.: "M01 · Microbiomas"). */
  group?: string;
  /** Imagem do grupo/missão (só caminhos locais /images/...). */
  image?: string;
}

export interface ChallengePenalty {
  id: string;
  label: string;
  /** Valor de cada ocorrência (sempre positivo; o sinal depende da direção). */
  points: number;
  max: number;
  /**
   * Tabela por número de ocorrências (ex.: cartões da Future Edition). Se
   * existir, substitui `points × n`; `zeroesTotal` zera o resultado.
   */
  table?: { count: number; points: number; zeroesTotal?: boolean }[];
}

export interface ChallengeScoring {
  /** higher: maior valor vence (pontos). lower: menor vence (tempo). */
  direction: "higher" | "lower";
  /** Rótulo do valor: "pts", "s", "cm"... */
  unit: string;
  decimals: 0 | 1 | 2;
  /** Tempo máximo por tentativa (s). Em "contra o tempo", quem não completa recebe esse tempo. */
  timeLimitSec?: number | null;
  /** Nota nunca fica negativa por causa de penalidades. */
  floorAtZero: boolean;
}

export interface Challenge {
  version: 1;
  type: ChallengeType;
  name: string;
  objective: string;
  rules: string[];
  items: ChallengeItem[];
  penalties: ChallengePenalty[];
  scoring: ChallengeScoring;
  /**
   * Formato de alianças (estilo FTC): presente nos eventos/templates em que a
   * súmula é preenchida por aliança em partidas vermelha × azul (ou
   * cooperativas). Ver lib/alliance.ts.
   */
  alliance?: AllianceConfig;
}

/** Respostas da mesa: { itemId: valor, "pen:penaltyId": ocorrências, "dnf": 1 }. */
export type CustomResponses = Record<string, number>;
