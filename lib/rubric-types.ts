/**
 * Avaliação por rubricas (sessões separadas da partida, como as salas de
 * avaliação da FLL e a entrevista da FTC).
 *
 * Tipos puros: usados no banco (jsonb), no servidor e no navegador.
 */

/** Um nível da escala ("1 · Iniciante", "4 · Excepcional"). */
export interface RubricLevel {
  value: number;
  label: string;
}

export interface RubricCriterion {
  id: string;
  label: string;
  /** O que o avaliador observa neste critério. */
  description?: string;
  /** Descrição de cada nível, na ordem da escala (as "células" da rubrica). */
  hints?: string[];
  /** Peso no total da rubrica (padrão 1). */
  weight?: number;
}

export interface RubricSection {
  id: string;
  title: string;
  criteria: RubricCriterion[];
}

export interface RubricDefinition {
  /** Escala em ordem crescente. */
  levels: RubricLevel[];
  sections: RubricSection[];
  /**
   * Nível a partir do qual o comentário do critério é obrigatório
   * (FLL: "Excepcional" exige justificativa). null = nunca obrigatório.
   */
  commentFromLevel: number | null;
  /** Pede "pontos fortes" e "o que melhorar" para a equipe ao enviar. */
  requireFeedback: boolean;
}

/** { criterionId: valor do nível } */
export type EvaluationScores = Record<string, number>;
/** { criterionId: comentário } */
export type EvaluationComments = Record<string, string>;
export interface EvaluationFeedback {
  strengths?: string;
  improvements?: string;
}

export type JudgingSessionStatus = "scheduled" | "in_progress" | "done" | "absent";
export type EvaluationStatus = "draft" | "submitted";
