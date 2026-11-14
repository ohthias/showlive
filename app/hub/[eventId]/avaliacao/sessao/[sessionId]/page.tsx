import { notFound } from "next/navigation";
import { EvaluationForm } from "@/components/judging/EvaluationForm";
import { loadHubEvent } from "@/lib/hub-data";
import { getJudge, judgeCanEdit, judgingSettings, loadSessionForJudging } from "@/lib/judging";
import { toFormProps } from "@/lib/judging-view";

export const dynamic = "force-dynamic";

export default async function HubSessionPage({ params }: { params: Promise<{ eventId: string; sessionId: string }> }) {
  const { eventId, sessionId } = await params;
  const { event } = await loadHubEvent(eventId);
  const [data, judge, settings] = await Promise.all([loadSessionForJudging(event.id, sessionId), getJudge(event), judgingSettings(event.id)]);
  if (!data || !judge) notFound();
  return (
    <EvaluationForm
      eventId={event.id}
      {...toFormProps(data)}
      canEdit={judgeCanEdit(judge, settings.locked)}
      backHref={`/hub/${event.id}/avaliacao`}
      judgeLabel={judge.label}
    />
  );
}
