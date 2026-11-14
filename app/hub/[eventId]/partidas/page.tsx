import { notFound } from "next/navigation";
import { MatchesManager } from "@/components/hub/MatchesManager";
import { hasRole } from "@/lib/access";
import { loadHubEvent } from "@/lib/hub-data";
import { buildSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

export default async function MatchesPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { event, role } = await loadHubEvent(eventId, "scorer");
  if (event.format !== "alliance" || !event.challenge?.alliance) notFound();
  const snapshot = await buildSnapshot(event, "staff");
  if (role === "scorer" && !snapshot.settings.scorersCanEdit) notFound();
  return <MatchesManager initial={snapshot} challenge={event.challenge} isAdmin={hasRole(role, "admin")} />;
}
