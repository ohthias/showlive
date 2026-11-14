import { eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { matches, scores } from "@/db/schema";
import { ChallengeBuilder } from "@/components/challenge/ChallengeBuilder";
import { ChallengeSheet } from "@/components/challenge/ChallengeSheet";
import { blankChallenge } from "@/lib/challenge";
import { loadHubEvent } from "@/lib/hub-data";

export const dynamic = "force-dynamic";

export default async function ChallengePage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { event } = await loadHubEvent(eventId, "admin");
  if (event.format === "fll_fe" && event.challenge) {
    return (
      <div className="space-y-4">
        <p className="rounded-tl-xl rounded-br-xl bg-base-100 p-4 text-sm text-base-content/70">
          Regras oficiais da <b>FLL Future Edition</b>, carregadas do RoboStage. A mesa usa exatamente esta súmula.
        </p>
        <ChallengeSheet challenge={event.challenge} eventName={event.name} />
      </div>
    );
  }
  if (event.format !== "custom" && event.format !== "alliance") notFound();
  const db = await getDb();
  const [{ n }] =
    event.format === "alliance"
      ? await db.select({ n: sql<number>`count(*)::int` }).from(matches).where(sql`${matches.eventId} = ${event.id} and ${matches.status} <> 'scheduled'`)
      : await db.select({ n: sql<number>`count(*)::int` }).from(scores).where(eq(scores.eventId, event.id));
  return (
    <ChallengeBuilder
      initial={event.challenge ?? blankChallenge("missions", event.name)}
      mode={{ kind: "event", eventId: event.id, scored: n }}
      eventName={event.name}
    />
  );
}
