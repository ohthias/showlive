import { RoomManager } from "@/components/judging/RoomManager";
import { loadHubEvent } from "@/lib/hub-data";
import { loadRooms, loadRubrics, loadSessions } from "@/lib/judging";

export const dynamic = "force-dynamic";

export default async function RoomsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { event } = await loadHubEvent(eventId, "admin");
  const [rooms, rubricRows, sessions] = await Promise.all([loadRooms(event.id), loadRubrics(event.id), loadSessions(event.id)]);
  const perRoom = new Map<string, number>();
  for (const s of sessions) if (s.roomId) perRoom.set(s.roomId, (perRoom.get(s.roomId) ?? 0) + 1);
  return (
    <RoomManager
      eventId={event.id}
      live={event.status === "live"}
      site={process.env.NEXT_PUBLIC_SHOWLIVE_URL ?? "https://showlive.robostage.com.br"}
      rubrics={rubricRows.map((r) => ({ id: r.id, name: r.name }))}
      rooms={rooms.map((r) => ({
        id: r.id,
        name: r.name,
        code: r.code,
        active: r.active,
        rubricIds: r.rubricIds,
        lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
        sessions: perRoom.get(r.id) ?? 0,
      }))}
    />
  );
}
