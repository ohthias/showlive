import { eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { scores } from "@/db/schema";
import { ArenaEditor } from "@/components/obr/ArenaEditor";
import { loadHubEvent } from "@/lib/hub-data";
import { defaultLeague } from "@/lib/obr";

export const dynamic = "force-dynamic";

export default async function ArenasPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { event } = await loadHubEvent(eventId, "admin");
  if (event.format !== "obr") notFound();
  const db = await getDb();
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(scores).where(eq(scores.eventId, event.id));
  return <ArenaEditor eventId={event.id} league={event.league ?? defaultLeague()} scored={n} />;
}
