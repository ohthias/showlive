import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { eventSettings } from "@/db/schema";
import { ScenesManager } from "@/components/hub/ScenesManager";
import { loadHubEvent } from "@/lib/live/hub-data";
import { sanitizeScenes } from "@/lib/live/scenes";

export const dynamic = "force-dynamic";

export default async function ScenesPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { event } = await loadHubEvent(eventId, "admin");
  const db = await getDb();
  const [row] = await db.select({ scenes: eventSettings.scenes }).from(eventSettings).where(eq(eventSettings.eventId, event.id)).limit(1);
  return <ScenesManager eventId={event.id} code={event.code} live={event.status === "live"} initial={sanitizeScenes(row?.scenes)} />;
}
