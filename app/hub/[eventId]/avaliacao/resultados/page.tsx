import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { rubricEvaluations, teams } from "@/db/schema";
import { JudgingResults } from "@/components/judging/JudgingResults";
import { loadHubEvent } from "@/lib/hub-data";
import { judgingSettings, loadRooms, loadRubrics, loadSessions } from "@/lib/judging";
import { computeRanking } from "@/lib/ranking";
import { computeAllianceRanking } from "@/lib/alliance";
import { rankOverall, rankRubric, roomRubrics } from "@/lib/rubric";
import { buildSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

export default async function JudgingResultsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { event } = await loadHubEvent(eventId, "admin");
  const db = await getDb();
  const [teamRows, rubricRows, evals, settings, snapshot, sessions, rooms] = await Promise.all([
    db.select({ id: teams.id, name: teams.name, number: teams.number }).from(teams).where(eq(teams.eventId, event.id)).orderBy(asc(teams.name)),
    loadRubrics(event.id),
    db
      .select({
        id: rubricEvaluations.id,
        teamId: rubricEvaluations.teamId,
        rubricId: rubricEvaluations.rubricId,
        total: rubricEvaluations.total,
        max: rubricEvaluations.maxTotal,
        status: rubricEvaluations.status,
      })
      .from(rubricEvaluations)
      .where(eq(rubricEvaluations.eventId, event.id)),
    judgingSettings(event.id),
    buildSnapshot(event, "staff"),
    loadSessions(event.id),
    loadRooms(event.id),
  ]);

  const evaluations = evals.map((e) => ({ ...e, percent: e.max > 0 ? Math.round((e.total / e.max) * 10000) / 100 : 0 }));
  // Partida: nota da classificação (alianças: RS/RP ou média, conforme a configuração).
  const robotScores = snapshot.alliance
    ? Object.fromEntries(
        computeAllianceRanking(snapshot.teams, snapshot.matches.map((m) => ({ ...m, final: m.status === "final" })), snapshot.alliance.config).map((r) => [
          r.team.id,
          r.played ? r.score : null,
        ]),
      )
    : Object.fromEntries(computeRanking(snapshot.teams, snapshot.rounds, snapshot.scores, snapshot.settings).map((r) => [r.team.id, r.evaluated ? r.score : null]));
  const rubricList = rubricRows.map((r) => ({ id: r.id, name: r.name, weight: r.weight }));

  const overall = rankOverall(
    teamRows,
    rubricList,
    evaluations,
    settings.includeRobotGame ? { weight: settings.robotGameWeight, scores: robotScores, direction: snapshot.settings.direction } : undefined,
  );
  const perRubric = Object.fromEntries(rubricList.map((r) => [r.id, rankRubric(teamRows, r.id, evaluations)]));

  // Pendências: fichas em rascunho e sessões sem todas as fichas enviadas.
  const roomMap = new Map(rooms.map((r) => [r.id, r]));
  const pending = sessions
    .filter((s) => s.status !== "absent")
    .map((s) => {
      const needed = roomRubrics(rubricRows, s.roomId ? roomMap.get(s.roomId)?.rubricIds : []).map((r) => r.id);
      const sent = new Set(s.sheets.filter((x) => x.status === "submitted").map((x) => x.rubricId));
      const missing = needed.filter((id) => !sent.has(id));
      return { sessionId: s.id, teamName: s.teamName, roomName: s.roomId ? (roomMap.get(s.roomId)?.name ?? "—") : "Sem sala", missing };
    })
    .filter((x) => x.missing.length);

  return (
    <JudgingResults
      eventId={event.id}
      settings={settings}
      rubrics={rubricList}
      overall={overall}
      perRubric={perRubric}
      pending={pending}
      robotUnit={snapshot.alliance ? (snapshot.alliance.config.mode === "coop" ? "pts" : "RP") : snapshot.event.scoring.unit}
      teamsWithoutSession={teamRows.filter((t) => !sessions.some((s) => s.teamId === t.id)).map((t) => t.name)}
    />
  );
}
