"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, Lock, MessageSquarePlus, Save, Send, UserX } from "lucide-react";
import { saveEvaluation, setSessionStatus } from "@/app/actions/judging";
import { cornerBtn, Tag } from "@/components/ui/brand";
import { useConfirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import { allCriteria, scoreRubric, submitProblems } from "@/lib/rubric";
import type {
  EvaluationComments,
  EvaluationFeedback,
  EvaluationScores,
  JudgingSessionStatus,
  RubricDefinition,
} from "@/lib/rubric-types";
import { LocalTime, pct, SessionStatusPill } from "./shared";

export interface FormRubric {
  id: string;
  name: string;
  description: string | null;
  definition: RubricDefinition;
}

export interface FormEvaluation {
  rubricId: string;
  scores: EvaluationScores;
  comments: EvaluationComments;
  feedback: EvaluationFeedback;
  status: "draft" | "submitted";
  submittedByLabel: string;
  updatedAt: string;
}

export interface FormSession {
  id: string;
  status: JudgingSessionStatus;
  startsAt: string | null;
  durationMin: number;
  notes: string | null;
  teamName: string;
  teamNumber: string | null;
  teamOrg: string | null;
  roomName: string | null;
}

type Draft = {
  scores: EvaluationScores;
  comments: EvaluationComments;
  feedback: EvaluationFeedback;
  status: "draft" | "submitted" | "new";
  dirty: boolean;
  by?: string;
};

/**
 * Ficha de avaliação de uma sessão: uma aba por rubrica aplicada na sala.
 * Usada no hub (membros) e na sala de avaliação (avaliadores com código).
 */
export function EvaluationForm({
  eventId,
  session,
  rubrics,
  evaluations,
  canEdit,
  backHref,
  judgeLabel,
}: {
  eventId: string;
  session: FormSession;
  rubrics: FormRubric[];
  evaluations: FormEvaluation[];
  canEdit: boolean;
  backHref: string;
  judgeLabel: string;
}) {
  const router = useRouter();
  const { addToast } = useToast();
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  const [active, setActive] = useState(rubrics[0]?.id ?? "");
  const [problems, setProblems] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      rubrics.map((r) => {
        const e = evaluations.find((x) => x.rubricId === r.id);
        return [
          r.id,
          e
            ? { scores: e.scores, comments: e.comments, feedback: e.feedback, status: e.status, dirty: false, by: e.submittedByLabel }
            : { scores: {}, comments: {}, feedback: {}, status: "new", dirty: false },
        ];
      }),
    ),
  );

  const anyDirty = Object.values(drafts).some((d) => d.dirty);
  useEffect(() => {
    if (!anyDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [anyDirty]);

  const rubric = rubrics.find((r) => r.id === active);
  const draft = drafts[active];

  const patch = (fn: (d: Draft) => Draft) => setDrafts((all) => ({ ...all, [active]: { ...fn(all[active]), dirty: true } }));

  const save = (submit: boolean) => {
    if (!rubric || !draft) return;
    if (submit) {
      const p = submitProblems(rubric.definition, draft.scores, draft.comments, draft.feedback);
      if (p.length) {
        setProblems(new Set(p.map((x) => x.criterionId ?? "__feedback")));
        const first = p[0].criterionId ? document.getElementById(`crit-${p[0].criterionId}`) : document.getElementById("feedback");
        first?.scrollIntoView({ behavior: "smooth", block: "center" });
        return addToast(`${p.length} pendência(s): ${p[0].message}`, "warning", 5000);
      }
    }
    setProblems(new Set());
    start(async () => {
      const r = await saveEvaluation({
        eventId,
        sessionId: session.id,
        rubricId: rubric.id,
        scores: draft.scores,
        comments: draft.comments,
        feedback: draft.feedback,
        submit,
      });
      if (!r.ok) return addToast(r.error, "error", 5000);
      setDrafts((all) => ({ ...all, [rubric.id]: { ...all[rubric.id], status: r.data.status, dirty: false, by: judgeLabel } }));
      addToast(submit ? `${rubric.name}: ficha enviada (${pct(r.data.percent)}).` : "Rascunho salvo.", "success");
      // Próxima rubrica ainda não enviada.
      if (submit) {
        const next = rubrics.find((x) => x.id !== rubric.id && drafts[x.id]?.status !== "submitted");
        if (next) setActive(next.id);
      }
      router.refresh();
    });
  };

  const markStatus = async (status: JudgingSessionStatus) => {
    if (status === "absent") {
      const ok = await confirm({ title: `Marcar ${session.teamName} como ausente?`, message: "A sessão sai da fila desta sala.", confirmLabel: "Marcar ausente", danger: true });
      if (ok === false) return;
    }
    start(async () => {
      const r = await setSessionStatus(eventId, session.id, status);
      if (!r.ok) return addToast(r.error, "error");
      router.refresh();
    });
  };

  const score = rubric && draft ? scoreRubric(rubric.definition, draft.scores) : null;

  return (
    <div className="pb-36">
      <div className="flex flex-wrap items-start gap-3">
        <Link href={backHref} className="btn btn-ghost btn-sm btn-square" aria-label="Voltar">
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="kicker">/ SESSÃO DE AVALIAÇÃO</p>
          <h1 className="truncate text-2xl font-bold tracking-tight">
            {session.teamNumber && <span className="mr-2 font-mono text-base-content/50">#{session.teamNumber}</span>}
            {session.teamName}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-base-content/60">
            {session.teamOrg && <span>{session.teamOrg}</span>}
            {session.roomName && <span>{session.roomName}</span>}
            <span className="inline-flex items-center gap-1">
              <Clock size={12} /> <LocalTime iso={session.startsAt} fallback="sem horário" /> · {session.durationMin} min
            </span>
            <SessionStatusPill status={session.status} />
          </p>
          {session.notes && <p className="mt-2 text-sm text-base-content/70">{session.notes}</p>}
        </div>
        {canEdit && session.status !== "done" && (
          <div className="flex gap-2">
            {session.status === "absent" ? (
              <button type="button" className="btn btn-sm btn-outline" disabled={pending} onClick={() => markStatus("scheduled")}>
                Equipe chegou
              </button>
            ) : (
              <button type="button" className="btn btn-sm btn-ghost text-error" disabled={pending} onClick={() => markStatus("absent")}>
                <UserX size={15} /> Ausente
              </button>
            )}
          </div>
        )}
      </div>

      {!canEdit && (
        <div className="mt-4 flex items-center gap-2 rounded-tl-xl rounded-br-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <Lock size={16} /> As avaliações estão travadas pela organização. Você pode consultar, mas não alterar.
        </div>
      )}

      {rubrics.length === 0 ? (
        <p className="mt-8 text-sm text-base-content/60">Nenhuma rubrica configurada para esta sala. Fale com a organização.</p>
      ) : (
        <>
          <div role="tablist" className="mt-5 flex gap-1 overflow-x-auto border-b border-base-300">
            {rubrics.map((r) => {
              const d = drafts[r.id];
              const s = scoreRubric(r.definition, d.scores);
              return (
                <button
                  key={r.id}
                  role="tab"
                  type="button"
                  aria-selected={r.id === active}
                  onClick={() => {
                    setActive(r.id);
                    setProblems(new Set());
                  }}
                  className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                    r.id === active ? "border-primary text-base-content" : "border-transparent text-base-content/60 hover:text-base-content"
                  }`}
                >
                  {d.status === "submitted" && !d.dirty ? <CheckCircle2 size={15} className="text-success" /> : null}
                  {r.name}
                  <span className="font-mono text-[10px] text-base-content/45">
                    {s.answered}/{s.criteria}
                  </span>
                  {d.dirty && <span className="size-1.5 rounded-full bg-warning" title="Alterações não salvas" />}
                </button>
              );
            })}
          </div>

          {rubric && draft && (
            <div className="mt-5 space-y-6">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {rubric.description && <p className="flex-1 text-base-content/65">{rubric.description}</p>}
                {draft.status === "submitted" && (
                  <Tag className="border-success/40 bg-success/10 text-success">
                    ENVIADA{draft.by ? ` · ${draft.by.toUpperCase()}` : ""}
                  </Tag>
                )}
                {draft.status === "draft" && <Tag className="border-base-content/25 text-base-content/60">RASCUNHO</Tag>}
              </div>

              <Legend definition={rubric.definition} />

              {rubric.definition.sections.map((section) => (
                <section key={section.id}>
                  <h2 className="kicker mb-2">/ {section.title.toUpperCase()}</h2>
                  <div className="space-y-3">
                    {section.criteria.map((c) => {
                      const value = draft.scores[c.id];
                      const needsComment =
                        rubric.definition.commentFromLevel !== null && typeof value === "number" && value >= rubric.definition.commentFromLevel;
                      return (
                        <CriterionCard
                          key={c.id}
                          id={`crit-${c.id}`}
                          label={c.label}
                          description={c.description}
                          weight={c.weight}
                          hints={c.hints}
                          levels={rubric.definition.levels}
                          value={value}
                          comment={draft.comments[c.id] ?? ""}
                          needsComment={needsComment}
                          flagged={problems.has(c.id)}
                          disabled={!canEdit || pending}
                          onPick={(v) =>
                            patch((d) => {
                              const scores = { ...d.scores };
                              if (scores[c.id] === v) delete scores[c.id];
                              else scores[c.id] = v;
                              return { ...d, scores };
                            })
                          }
                          onComment={(t) => patch((d) => ({ ...d, comments: { ...d.comments, [c.id]: t } }))}
                        />
                      );
                    })}
                  </div>
                </section>
              ))}

              <section
                id="feedback"
                className={`rounded-tl-2xl rounded-br-2xl border bg-base-100 p-4 ${problems.has("__feedback") ? "border-error" : "border-base-300"}`}
              >
                <h2 className="kicker mb-3">/ RETORNO PARA A EQUIPE {rubric.definition.requireFeedback ? "· OBRIGATÓRIO" : "· OPCIONAL"}</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium">Pontos fortes</span>
                    <textarea
                      className="textarea textarea-bordered mt-1 w-full"
                      rows={4}
                      maxLength={1500}
                      disabled={!canEdit || pending}
                      value={draft.feedback.strengths ?? ""}
                      onChange={(e) => patch((d) => ({ ...d, feedback: { ...d.feedback, strengths: e.target.value } }))}
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium">O que pode melhorar</span>
                    <textarea
                      className="textarea textarea-bordered mt-1 w-full"
                      rows={4}
                      maxLength={1500}
                      disabled={!canEdit || pending}
                      value={draft.feedback.improvements ?? ""}
                      onChange={(e) => patch((d) => ({ ...d, feedback: { ...d.feedback, improvements: e.target.value } }))}
                    />
                  </label>
                </div>
              </section>
            </div>
          )}
        </>
      )}

      {rubric && draft && score && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-base-300 bg-base-100/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-base-content/55">{rubric.name}</p>
              <p className="font-mono text-sm">
                <b className="text-lg">{score.total.toLocaleString("pt-BR")}</b> / {score.max.toLocaleString("pt-BR")} · {pct(score.percent)} ·{" "}
                {score.answered}/{score.criteria} critérios
              </p>
              <progress className="progress progress-primary mt-1 h-1.5 w-full max-w-xs" value={score.answered} max={score.criteria} />
            </div>
            {canEdit && (
              <>
                <button type="button" className="btn btn-outline" disabled={pending || !draft.dirty} onClick={() => save(false)}>
                  <Save size={16} /> {draft.status === "submitted" ? "Salvar como rascunho" : "Salvar rascunho"}
                </button>
                <button
                  type="button"
                  className={`btn btn-primary ${cornerBtn}`}
                  disabled={pending || (draft.status === "submitted" && !draft.dirty)}
                  onClick={() => save(true)}
                >
                  {pending ? <span className="loading loading-spinner loading-sm" /> : <Send size={16} />}
                  {draft.status === "submitted" ? "Reenviar ficha" : "Enviar ficha"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Legend({ definition }: { definition: RubricDefinition }) {
  const n = allCriteria(definition).length;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-base-content/60">
      <span>
        {n} critério(s) · escala:
      </span>
      {definition.levels.map((l) => (
        <span key={l.value} className="rounded-tl-md rounded-br-md bg-base-200 px-2 py-0.5">
          <b className="font-mono">{l.value}</b> {l.label}
        </span>
      ))}
      {definition.commentFromLevel !== null && (
        <span className="inline-flex items-center gap-1">
          <MessageSquarePlus size={12} /> comentário obrigatório a partir de {definition.commentFromLevel}
        </span>
      )}
    </div>
  );
}

function CriterionCard({
  id,
  label,
  description,
  weight,
  hints,
  levels,
  value,
  comment,
  needsComment,
  flagged,
  disabled,
  onPick,
  onComment,
}: {
  id: string;
  label: string;
  description?: string;
  weight?: number;
  hints?: string[];
  levels: RubricDefinition["levels"];
  value: number | undefined;
  comment: string;
  needsComment: boolean;
  flagged: boolean;
  disabled: boolean;
  onPick: (v: number) => void;
  onComment: (t: string) => void;
}) {
  const [showComment, setShowComment] = useState(!!comment);
  const open = showComment || needsComment;
  const cols = useMemo(() => ({ "--cols": levels.length }) as React.CSSProperties, [levels.length]);
  const hasHints = !!hints?.some(Boolean);

  return (
    <div
      id={id}
      className={`scroll-mt-24 rounded-tl-2xl rounded-br-2xl border bg-base-100 p-4 transition ${
        flagged ? "border-error ring-2 ring-error/20" : typeof value === "number" ? "border-base-content/25" : "border-base-300"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-bold">
            {label}
            {weight !== undefined && weight !== 1 && <span className="ml-2 font-mono text-xs text-base-content/50">peso {weight}</span>}
          </p>
          {description && <p className="mt-0.5 text-sm text-base-content/60">{description}</p>}
        </div>
        {!needsComment && (
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => setShowComment((v) => !v)} disabled={disabled && !comment}>
            <MessageSquarePlus size={13} /> Comentário
          </button>
        )}
      </div>

      <div
        className={`mt-3 grid gap-2 ${
          hasHints ? "grid-cols-1 md:grid-cols-[repeat(var(--cols),minmax(0,1fr))]" : "grid-cols-[repeat(var(--cols),minmax(0,1fr))]"
        }`}
        style={cols}
      >
        {levels.map((l, i) => {
          const selected = value === l.value;
          return (
            <button
              key={l.value}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => onPick(l.value)}
              className={`flex flex-col items-start gap-1 rounded-tl-xl rounded-br-xl border-2 px-3 py-2 text-left transition disabled:cursor-not-allowed ${
                selected
                  ? "border-primary bg-primary text-primary-content"
                  : "border-base-300 bg-base-200/40 hover:border-base-content/40 hover:bg-base-200"
              }`}
            >
              <span className="flex w-full items-baseline gap-1.5">
                <span className="font-mono text-lg font-black leading-none">{l.value}</span>
                <span className="truncate text-xs font-bold">{l.label}</span>
              </span>
              {hasHints && hints?.[i] && (
                <span className={`text-xs leading-snug ${selected ? "text-primary-content/90" : "text-base-content/60"}`}>{hints[i]}</span>
              )}
            </button>
          );
        })}
      </div>

      {open && (
        <label className="mt-3 block">
          <span className={`flex items-center gap-1 text-xs ${needsComment && !comment.trim() ? "text-error" : "text-base-content/55"}`}>
            {needsComment && <AlertTriangle size={12} />}
            {needsComment ? "Justifique este nível (obrigatório)" : "Comentário (aparece no retorno para a equipe)"}
          </span>
          <textarea
            className="textarea textarea-bordered textarea-sm mt-1 w-full"
            rows={2}
            maxLength={600}
            disabled={disabled}
            value={comment}
            onChange={(e) => onComment(e.target.value)}
          />
        </label>
      )}
    </div>
  );
}
