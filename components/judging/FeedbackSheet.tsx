"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, NotebookPen, Printer, RotateCcw, Trash2 } from "lucide-react";
import { deleteEvaluation, reopenEvaluation } from "@/app/actions/judging";
import { EmptyState, Tag } from "@/components/ui/brand";
import { useConfirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import type { RubricScore } from "@/lib/rubric";
import type { EvaluationComments, EvaluationFeedback, EvaluationScores, RubricDefinition } from "@/lib/rubric-types";
import { LocalTime, pct } from "./shared";

type Sheet = {
  id: string;
  sessionId: string;
  rubricName: string;
  definition: RubricDefinition;
  scores: EvaluationScores;
  comments: EvaluationComments;
  feedback: EvaluationFeedback;
  status: "draft" | "submitted";
  by: string;
  roomName: string | null;
  updatedAt: string;
  score: RubricScore;
};

export function FeedbackSheet({
  eventId,
  eventName,
  team,
  sheets,
}: {
  eventId: string;
  eventName: string;
  team: { name: string; number: string | null; organization: string | null };
  sheets: Sheet[];
}) {
  // Na versão para a equipe, os números podem ficar de fora (só níveis e comentários).
  const [showNumbers, setShowNumbers] = useState(false);
  const [pending, start] = useTransition();
  const { addToast } = useToast();
  const confirm = useConfirm();

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) addToast(r.error ?? "Erro", "error");
      else addToast(ok, "success");
    });

  const submitted = sheets.filter((s) => s.status === "submitted");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Link href={`/hub/${eventId}/avaliacao/resultados`} className="btn btn-ghost btn-sm">
          <ArrowLeft size={15} /> Resultados
        </Link>
        <div className="flex-1" />
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowNumbers((v) => !v)}>
          {showNumbers ? <EyeOff size={15} /> : <Eye size={15} />} {showNumbers ? "Ocultar pontuação" : "Mostrar pontuação"}
        </button>
        <button type="button" className="btn btn-sm btn-outline" onClick={() => window.print()} disabled={!submitted.length}>
          <Printer size={15} /> Imprimir retorno
        </button>
      </div>

      {sheets.length === 0 ? (
        <EmptyState icon={<NotebookPen size={22} />} title="Nenhuma ficha para esta equipe" />
      ) : (
        <>
          {sheets.some((s) => s.status === "draft") && (
            <div className="space-y-2 print:hidden">
              {sheets
                .filter((s) => s.status === "draft")
                .map((s) => (
                  <p key={s.id} className="flex items-center gap-2 rounded-tl-xl rounded-br-xl border border-warning/40 bg-warning/10 px-4 py-2 text-sm">
                    <b>{s.rubricName}</b> está em rascunho ({s.score.answered}/{s.score.criteria}) e não entra no resultado nem na impressão.
                    <Link href={`/hub/${eventId}/avaliacao/sessao/${s.sessionId}`} className="link ml-auto text-xs">
                      abrir ficha
                    </Link>
                  </p>
                ))}
            </div>
          )}

          <article className="feedback-sheet rounded-tl-2xl rounded-br-2xl border border-base-300 bg-base-100 p-6 print:border-0 print:p-0">
            <header className="border-b-2 border-base-content pb-3">
              <p className="kicker">/ RETORNO DA AVALIAÇÃO · {eventName.toUpperCase()}</p>
              <h1 className="text-2xl font-bold tracking-tight">
                {team.number && <span className="mr-2 font-mono text-base-content/50">#{team.number}</span>}
                {team.name}
              </h1>
              {team.organization && <p className="text-sm text-base-content/60">{team.organization}</p>}
            </header>

            {submitted.map((s, i) => (
              <section key={s.id} className={`mt-6 ${i > 0 ? "print-break" : ""}`}>
                <div className="flex flex-wrap items-baseline gap-2">
                  <h2 className="text-lg font-bold">{s.rubricName}</h2>
                  {showNumbers && (
                    <span className="font-mono text-sm text-base-content/60">
                      {s.score.total.toLocaleString("pt-BR")} / {s.score.max.toLocaleString("pt-BR")} · {pct(s.score.percent)}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-base-content/50 print:hidden">
                    {s.roomName ?? "Sem sala"} · {s.by} · <LocalTime iso={s.updatedAt} withDay />
                  </span>
                  <span className="flex gap-1 print:hidden">
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      disabled={pending}
                      onClick={() => act(() => reopenEvaluation(eventId, s.id), "Ficha devolvida para rascunho.")}
                      title="Devolver para rascunho"
                    >
                      <RotateCcw size={12} /> Reabrir
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-error"
                      disabled={pending}
                      onClick={async () => {
                        const ok = await confirm({ title: `Apagar a ficha de ${s.rubricName}?`, confirmLabel: "Apagar", danger: true });
                        if (ok !== false) act(() => deleteEvaluation(eventId, s.id), "Ficha apagada.");
                      }}
                      aria-label="Apagar ficha"
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                </div>

                <table className="table table-sm mt-2">
                  <tbody>
                    {s.definition.sections.flatMap((sec) => [
                      <tr key={`h-${sec.id}`}>
                        <th colSpan={3} className="bg-base-200/60 text-xs uppercase tracking-wider print:bg-transparent">
                          {sec.title}
                        </th>
                      </tr>,
                      ...sec.criteria.map((c) => {
                        const v = s.scores[c.id];
                        const level = s.definition.levels.find((l) => l.value === v);
                        const idx = s.definition.levels.findIndex((l) => l.value === v);
                        return (
                          <tr key={c.id} className="align-top">
                            <td className="w-1/3 font-medium">{c.label}</td>
                            <td className="w-40">
                              {level ? (
                                <Tag className="border-base-content/30">
                                  {showNumbers ? `${level.value} · ` : ""}
                                  {level.label.toUpperCase()}
                                </Tag>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="text-sm">
                              {idx >= 0 && c.hints?.[idx] && <p className="text-base-content/60">{c.hints[idx]}</p>}
                              {s.comments[c.id] && <p className="mt-1 whitespace-pre-line">“{s.comments[c.id]}”</p>}
                            </td>
                          </tr>
                        );
                      }),
                    ])}
                  </tbody>
                </table>

                {(s.feedback.strengths || s.feedback.improvements) && (
                  <div className="mt-3 grid gap-3 md:grid-cols-2 print:grid-cols-2">
                    {s.feedback.strengths && (
                      <div className="rounded-tl-xl rounded-br-xl border border-success/40 p-3">
                        <p className="kicker">PONTOS FORTES</p>
                        <p className="mt-1 whitespace-pre-line text-sm">{s.feedback.strengths}</p>
                      </div>
                    )}
                    {s.feedback.improvements && (
                      <div className="rounded-tl-xl rounded-br-xl border border-warning/50 p-3">
                        <p className="kicker">O QUE PODE MELHORAR</p>
                        <p className="mt-1 whitespace-pre-line text-sm">{s.feedback.improvements}</p>
                      </div>
                    )}
                  </div>
                )}
              </section>
            ))}
            {!submitted.length && <p className="mt-6 text-sm text-base-content/60">Nenhuma ficha enviada ainda.</p>}
          </article>
        </>
      )}
    </div>
  );
}
