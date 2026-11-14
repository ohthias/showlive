import { Telao } from "@/components/live/Telao";
import { loadHubEvent } from "@/lib/hub-data";
import { buildSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

/** Prévia do telão para a organização — funciona mesmo fora do ar (sem código). */
export default async function PreviewPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { event } = await loadHubEvent(eventId, "scorer");
  const snapshot = await buildSnapshot(event, "public");
  return (
    <div className="fixed inset-0 z-50 overflow-auto">
      <Telao initial={snapshot} preview />
    </div>
  );
}
