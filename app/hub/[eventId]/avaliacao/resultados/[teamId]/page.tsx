import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { judgingRooms, judgingSessions, rubricEvaluations, teams } from "@/db/schema";
import { FeedbackSheet } from "@/components/judging/FeedbackSheet";
import { loadHubEvent } from "@/lib/hub-data";
import { loadRubrics } from "@/lib/judging";
import { scoreRubric } from "@/lib/rubric";

export const dynamic = "force-dynamic";

/** Fichas de uma equipe: conferência da organização e retorno impresso para a equipe. */
export default async function TeamFeedbackPage({ params }: { params: Promise<{ eventId: string; teamId: string }> }) {
  const { eventId, teamId } = await params;
  const { event } = await loadHubEvent(eventId, "admin");
  const db = await getDb();
  const [team] = await db.select().from(teams).where(and(eq(teams.id, teamId), eq(teams.eventId, event.id))).limit(1);
  if (!team) notFound();
  const [rubricRows, sheets] = await Promise.all([
    loadRubrics(event.id),
    db
      .select({
        id: rubricEvaluations.id,
        rubricId: rubricEvaluations.rubricId,
        scores: rubricEvaluations.scores,
        comments: rubricEvaluations.comments,
        feedback: rubricEvaluations.feedback,
        status: rubricEvaluations.status,
        by: rubricEvaluations.submittedByLabel,
        updatedAt: rubricEvaluations.updatedAt,
        sessionId: rubricEvaluations.sessionId,
        roomName: judgingRooms.name,
      })
      .from(rubricEvaluations)
      .innerJoin(judgingSessions, eq(judgingSessions.id, rubricEvaluations.sessionId))
      .leftJoin(judgingRooms, eq(judgingRooms.id, judgingSessions.roomId))
      .where(and(eq(rubricEvaluations.teamId, team.id), eq(rubricEvaluations.eventId, event.id))),
  ]);
  const order = new Map(rubricRows.map((r, i) => [r.id, i]));
  return (
    <FeedbackSheet
      eventId={event.id}
      eventName={event.name}
      team={{ name: team.name, number: team.number, organization: team.organization }}
      sheets={sheets
        .sort((a, b) => (order.get(a.rubricId) ?? 0) - (order.get(b.rubricId) ?? 0))
        .map((s) => {
          const rubric = rubricRows.find((r) => r.id === s.rubricId)!;
          return {
            id: s.id,
            sessionId: s.sessionId,
            rubricName: rubric.name,
            definition: rubric.definition,
            scores: s.scores,
            comments: s.comments,
            feedback: s.feedback,
            status: s.status,
            by: s.by,
            roomName: s.roomName,
            updatedAt: s.updatedAt.toISOString(),
            score: scoreRubric(rubric.definition, s.scores),
          };
        })}
    />
  );
}
