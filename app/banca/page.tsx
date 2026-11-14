import { redirect } from "next/navigation";
import { BancaHome } from "@/components/judging/BancaHome";
import { getCodeJudge, judgingSettings, loadRubrics, loadSessions } from "@/lib/judging";
import { roomRubrics } from "@/lib/rubric";

export default async function BancaPage() {
  const ctx = await getCodeJudge();
  if (!ctx) redirect("/entrar");
  const [sessions, all, settings] = await Promise.all([loadSessions(ctx.event.id, ctx.room.id), loadRubrics(ctx.event.id), judgingSettings(ctx.event.id)]);
  const applied = roomRubrics(all, ctx.room.rubricIds);
  return (
    <BancaHome
      roomName={ctx.room.name}
      locked={settings.locked}
      rubrics={applied.map((r) => ({ id: r.id, name: r.name }))}
      sessions={sessions.map((s) => ({
        id: s.id,
        teamName: s.teamName,
        teamNumber: s.teamNumber,
        teamOrg: s.teamOrg,
        startsAt: s.startsAt,
        durationMin: s.durationMin,
        status: s.status,
        sent: s.sheets.filter((x) => x.status === "submitted" && applied.some((r) => r.id === x.rubricId)).length,
      }))}
    />
  );
}
