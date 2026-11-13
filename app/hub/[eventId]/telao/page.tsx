import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { eventSettings } from "@/db/schema";
import { ThemeEditor } from "@/components/hub/ThemeEditor";
import { loadHubEvent } from "@/lib/hub-data";
import { toLiveSettings } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

export default async function TelaoSettingsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { event } = await loadHubEvent(eventId, "admin");
  const db = await getDb();
  const [settings] = await db.select().from(eventSettings).where(eq(eventSettings.eventId, event.id)).limit(1);
  return <ThemeEditor eventId={event.id} code={event.code} theme={event.theme} settings={toLiveSettings(settings)} />;
}
