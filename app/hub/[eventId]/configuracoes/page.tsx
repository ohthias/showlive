import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { eventSettings, rounds, scores, teams } from "@/db/schema";
import { EventSettingsForm } from "@/components/hub/EventSettingsForm";
import { loadHubEvent } from "@/lib/hub-data";
import { toLiveSettings } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { event, role } = await loadHubEvent(eventId, "admin");
  const db = await getDb();
  const [roundRows, [settings], [{ n: teamCount }]] = await Promise.all([
    db
      .select({
        id: rounds.id,
        name: rounds.name,
        kind: rounds.kind,
        meta: rounds.meta,
        scores: sql<number>`(select count(*)::int from ${scores} where ${scores.roundId} = ${rounds.id})`,
      })
      .from(rounds)
      .where(eq(rounds.eventId, event.id))
      .orderBy(asc(rounds.position)),
    db.select().from(eventSettings).where(eq(eventSettings.eventId, event.id)).limit(1),
    db.select({ n: sql<number>`count(*)::int` }).from(teams).where(eq(teams.eventId, event.id)),
  ]);

  return (
    <EventSettingsForm
      event={{ id: event.id, name: event.name, season: event.season, format: event.format, challengeName: event.challenge?.name ?? null }}
      rounds={roundRows.map(({ meta, ...r }) => ({ ...r, arena: meta?.arenaId ? (event.league?.arenas.find((a) => a.id === meta.arenaId)?.name ?? null) : null }))}
      settings={toLiveSettings(settings, event.challenge?.scoring.direction ?? "higher")}
      teamCount={teamCount}
      isOwner={role === "owner"}
    />
  );
}
