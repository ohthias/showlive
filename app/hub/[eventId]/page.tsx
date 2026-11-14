import { Overview } from "@/components/hub/Overview";
import { hasRole } from "@/lib/access";
import { loadHubEvent, refereeCodes } from "@/lib/hub-data";
import { buildSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

export default async function EventOverview({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { event, role } = await loadHubEvent(eventId);
  const [snapshot, codes] = await Promise.all([buildSnapshot(event, "staff"), refereeCodes(event.id)]);
  return (
    <Overview
      initial={snapshot}
      codes={codes}
      isAdmin={hasRole(role, "admin")}
      canEditScores={hasRole(role, "admin") || (role === "scorer" && snapshot.settings.scorersCanEdit)}
      site={process.env.NEXT_PUBLIC_SHOWLIVE_URL ?? "https://showlive.robostage.com.br"}
    />
  );
}
