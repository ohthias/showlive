import { FLL_LEVELS } from "../rubric";
import type { RubricCriterion, RubricDefinition, RubricLevel, RubricSection } from "../rubric-types";

/**
 * Modelos prontos de rubrica. Os textos são resumos escritos para o
 * ShowLive — não reproduzem nem substituem o material oficial de nenhum
 * programa. Modelos "adaptados" seguem a estrutura pública do programa;
 * modelos "originais" foram criados para o ShowLive.
 */

export interface RubricPreset {
  id: string;
  name: string;
  description: string;
  definition: RubricDefinition;
  weight?: number;
}

export interface RubricPresetGroup {
  id: string;
  label: string;
  description: string;
  /** adapted = segue a estrutura de um programa oficial; original = criado para o ShowLive. */
  origin: "adapted" | "original";
  /** Duração sugerida da sessão de avaliação, em minutos. */
  sessionMinutes?: number;
  /** Conjunto adicionado pelo botão principal (padrão: todas). Use quando os modelos são alternativos. */
  recommended?: string[];
  presets: RubricPreset[];
}

/** Critério com descrição por nível (as "células" da rubrica, na ordem da escala). */
export const c = (id: string, label: string, description: string, hints: string[] = [], weight?: number): RubricCriterion => {
  const out: RubricCriterion = { id, label, description };
  if (hints.length) out.hints = hints;
  if (weight !== undefined && weight !== 1) out.weight = weight;
  return out;
};

export const section = (id: string, title: string, criteria: RubricCriterion[]): RubricSection => ({ id, title, criteria });

export const levels = (...labels: string[]): RubricLevel[] => labels.map((label, i) => ({ value: i + 1, label }));

export const def = (
  scale: RubricLevel[],
  sections: RubricSection[],
  opts: { commentFromLevel?: number | null; requireFeedback?: boolean } = {},
): RubricDefinition => ({
  levels: scale.map((l) => ({ ...l })),
  sections,
  commentFromLevel: opts.commentFromLevel ?? null,
  requireFeedback: opts.requireFeedback ?? false,
});

/* Escalas reutilizadas */
export const SCALE_FLL = FLL_LEVELS;
export const SCALE_4 = levels("Não demonstrado", "Parcial", "Demonstrado", "Excepcional");
export const SCALE_5 = levels("Insuficiente", "Regular", "Bom", "Ótimo", "Excelente");
export const SCALE_KIDS = levels("Começando", "Crescendo", "Brilhando");
export const SCALE_OBS = [
  { value: 0, label: "Não observado" },
  { value: 1, label: "Observado" },
  { value: 2, label: "Destaque" },
];
