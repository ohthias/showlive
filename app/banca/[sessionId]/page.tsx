import { notFound, redirect } from "next/navigation";
import { EvaluationForm } from "@/components/judging/EvaluationForm";
import { getCodeJudge, judgeCanEdit, judgingSettings, loadSessionForJudging } from "@/lib/judging";
import { toFormProps } from "@/lib/judging-view";

export default async function BancaSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const ctx = await getCodeJudge();
  if (!ctx) redirect("/entrar");
  const [data, settings] = await Promise.all([loadSessionForJudging(ctx.event.id, sessionId), judgingSettings(ctx.event.id)]);
  // Avaliador por código só abre sessões da própria sala.
  if (!data || data.session.roomId !== ctx.room.id) notFound();
  return (
    <EvaluationForm
      eventId={ctx.event.id}
      {...toFormProps(data)}
      canEdit={judgeCanEdit(ctx.judge, settings.locked)}
      backHref="/banca"
      judgeLabel={ctx.judge.label}
    />
  );
}
