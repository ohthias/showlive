import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { scores, teams } from "@/db/schema";
import { TeamsManager } from "@/components/hub/TeamsManager";
import { loadHubEvent } from "@/lib/hub-data";

export const dynamic = "force-dynamic";

export default async function TeamsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { event } = await loadHubEvent(eventId, "admin");
  const db = await getDb();
  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      number: teams.number,
      organization: teams.organization,
      scores: sql<number>`(select count(*)::int from ${scores} where ${scores.teamId} = ${teams.id})`,
    })
    .from(teams)
    .where(eq(teams.eventId, event.id))
    .orderBy(asc(teams.name));
  return <TeamsManager eventId={event.id} teams={rows} />;
}
