import type { Challenge } from "./challenge-types";

/** Perigos do trajeto (Caderno Verde da OBR). */
export type HazardKey = "intersecoes" | "gangorras" | "obstaculos" | "gaps" | "rampas" | "lombadas" | "passagens";

/**
 * Modelo de arena criado pelo admin. Define o que EXISTE na arena — a mesa
 * só consegue marcar até essas quantidades, e os checkpoints já vêm com o
 * número de ladrilhos de cada seção.
 */
export interface ObrArena {
  id: string;
  name: string;
  description?: string;
  /** Quantidade de cada perigo presente no trajeto. */
  hazards: Record<HazardKey, number>;
  /** Ladrilhos de cada seção entre checkpoints, na ordem do trajeto. */
  sections: number[];
  /** Ladrilho de saída pontua (5 pts). */
  startTile: boolean;
  /** Desafio Surpresa disponível nesta arena (multiplicador ×1,5). */
  surpriseEnabled: boolean;
  surpriseText?: string;
}

export interface ObrLeague {
  version: 1;
  arenas: ObrArena[];
  /** Desafios extras criados pelo admin (ranking próprio, fora da classificação geral). */
  extras: (Challenge & { id: string })[];
}

export interface RoundMeta {
  arenaId?: string;
  extraId?: string;
}

/** Súmula de uma rodada da OBR, como a mesa envia. */
export interface ObrResponses {
  hazards: Partial<Record<HazardKey, number>>;
  /** Para cada seção: tentativa em que o checkpoint foi superado (1, 2, 3, 4+) ou 0 = não superado. */
  sections: number[];
  falhas: number;
  chegada: boolean;
  vivas: number;
  mortas: number;
  invertidas: number;
  surpresa: boolean;
  /** Segundos; ignorado se não chegou ou desistiu. */
  tempo: number | null;
  desistiu: boolean;
}
