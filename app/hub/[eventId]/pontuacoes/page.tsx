import { notFound } from "next/navigation";
import { ScoresMatrix } from "@/components/hub/ScoresMatrix";
import { loadHubEvent } from "@/lib/hub-data";
import { getMissions } from "@/lib/missions";
import { buildSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

export default async function ScoresPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { event, role } = await loadHubEvent(eventId, "scorer");
  const snapshot = await buildSnapshot(event, "staff");
  if (role === "scorer" && !snapshot.settings.scorersCanEdit) notFound();
  return <ScoresMatrix initial={snapshot} missions={event.format === "fll" ? getMissions(event.season) : []} challenge={event.format === "obr" ? null : event.challenge} />;
}
