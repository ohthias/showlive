import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { rounds } from "@/db/schema";
import { AccessManager } from "@/components/hub/AccessManager";
import { loadAccess, loadHubEvent } from "@/lib/hub-data";

export const dynamic = "force-dynamic";

export default async function AccessPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { event, userId } = await loadHubEvent(eventId, "admin");
  const { codes, members } = await loadAccess(event.id);
  const db = await getDb();
  const roundRows = (
    await db.select({ id: rounds.id, name: rounds.name, position: rounds.position }).from(rounds).where(eq(rounds.eventId, event.id))
  )
    .sort((a, b) => a.position - b.position)
    .map(({ id, name }) => ({ id, name }));
  return (
    <AccessManager
      eventId={event.id}
      publicCode={event.code}
      live={event.status === "live"}
      site={process.env.NEXT_PUBLIC_SHOWLIVE_URL ?? "https://showlive.robostage.com.br"}
      codes={codes.map((c) => ({
        id: c.id,
        code: c.code,
        label: c.label,
        active: c.active,
        lastUsedAt: c.lastUsedAt?.toISOString() ?? null,
        allowedRoundIds: c.allowedRoundIds ?? null,
      }))}
      rounds={roundRows}
      members={members.map((m) => ({ id: m.id, email: m.email, name: m.name, role: m.role, status: m.status, isMe: m.userId === userId }))}
    />
  );
}
