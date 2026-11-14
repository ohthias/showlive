import type { FormEvaluation, FormRubric, FormSession } from "@/components/judging/EvaluationForm";
import type { loadSessionForJudging } from "./judging";

type Loaded = NonNullable<Awaited<ReturnType<typeof loadSessionForJudging>>>;

/** Converte o que vem do banco nas props (serializáveis) da ficha. */
export function toFormProps(data: Loaded): { session: FormSession; rubrics: FormRubric[]; evaluations: FormEvaluation[] } {
  return {
    session: {
      id: data.session.id,
      status: data.session.status,
      startsAt: data.session.startsAt,
      durationMin: data.session.durationMin,
      notes: data.session.notes,
      teamName: data.session.teamName,
      teamNumber: data.session.teamNumber,
      teamOrg: data.session.teamOrg,
      roomName: data.room?.name ?? null,
    },
    rubrics: data.rubrics.map((r) => ({ id: r.id, name: r.name, description: r.description, definition: r.definition })),
    evaluations: data.evaluations.map((e) => ({
      rubricId: e.rubricId,
      scores: e.scores,
      comments: e.comments,
      feedback: e.feedback,
      status: e.status,
      submittedByLabel: e.submittedByLabel,
      updatedAt: e.updatedAt.toISOString(),
    })),
  };
}
