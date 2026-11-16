import { Telao } from "@/components/live/Telao";
import { loadHubEvent } from "@/lib/live/hub-data";
import { buildSnapshot } from "@/lib/live/snapshot";

export const dynamic = "force-dynamic";

/**
 * Prévia do telão para a organização — funciona mesmo fora do ar (sem código).
 * `?scene=<id>` mostra uma cena específica; `?scene=auto`, o modo automático.
 * A aba Cenas também manda a cena em edição por postMessage.
 */
export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ scene?: string }>;
}) {
  const { eventId } = await params;
  const { scene } = await searchParams;
  const { event } = await loadHubEvent(eventId, "scorer");
  const snapshot = await buildSnapshot(event, "public");
  const forceScene = scene && /^(auto|[a-z0-9]{4,16})$/.test(scene) ? scene : undefined;
  return (
    <div className="fixed inset-0 z-50 overflow-auto">
      <Telao initial={snapshot} preview forceScene={forceScene} />
    </div>
  );
}
