import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { teams } from "@/db/schema";
import { ScheduleManager } from "@/components/judging/ScheduleManager";
import { hasRole } from "@/lib/access";
import { loadHubEvent } from "@/lib/hub-data";
import { judgingSettings, loadRooms, loadRubrics, loadSessions } from "@/lib/judging";

export const dynamic = "force-dynamic";

export default async function JudgingSchedulePage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { event, role } = await loadHubEvent(eventId);
  const db = await getDb();
  const [rubricRows, rooms, sessions, teamRows, settings] = await Promise.all([
    loadRubrics(event.id),
    loadRooms(event.id),
    loadSessions(event.id),
    db.select({ id: teams.id, name: teams.name, number: teams.number }).from(teams).where(eq(teams.eventId, event.id)).orderBy(asc(teams.name)),
    judgingSettings(event.id),
  ]);
  return (
    <ScheduleManager
      eventId={event.id}
      isAdmin={hasRole(role, "admin")}
      locked={settings.locked}
      rubrics={rubricRows.map((r) => ({ id: r.id, name: r.name }))}
      rooms={rooms.map((r) => ({ id: r.id, name: r.name, rubricIds: r.rubricIds, active: r.active }))}
      sessions={sessions}
      teams={teamRows}
    />
  );
}
