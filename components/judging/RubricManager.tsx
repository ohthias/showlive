"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ListChecks, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { addRubricPresets, deleteRubric, moveRubric, saveRubric } from "@/app/actions/judging";
import { cornerBtn, EmptyState, Panel, Tag } from "@/components/ui/brand";
import { useConfirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import { allCriteria, blankRubric, LIMITS, rubricId, scoreRubric } from "@/lib/rubric";
import type { RubricCriterion, RubricDefinition } from "@/lib/rubric-types";

type Rubric = { id: string; name: string; description: string | null; weight: number; definition: RubricDefinition; sheets: number };
type PresetSummary = {
  id: string;
  name: string;
  description: string;
  weight: number;
  levels: string[];
  sections: { title: string; criteria: string[] }[];
};
type Group = {
  id: string;
  label: string;
  description: string;
  origin: "adapted" | "original";
  sessionMinutes: number | null;
  recommended: string[];
  presets: PresetSummary[];
};

export function RubricManager({
  eventId,
  rubrics,
  presetGroups,
  suggested,
}: {
  eventId: string;
  rubrics: Rubric[];
  presetGroups: Group[];
  suggested: string;
}) {
  const [editing, setEditing] = useState<Rubric | "new" | null>(null);
  const [pending, start] = useTransition();
  const { addToast } = useToast();
  const confirm = useConfirm();

  const addPresets = (g: Group, presetIds?: string[]) =>
    start(async () => {
      const r = await addRubricPresets(eventId, g.id, presetIds);
      if (!r.ok) return addToast(r.error, "error");
      addToast(
        `${r.data.added} rubrica(s) de ${g.label} adicionada(s).${g.origin === "adapted" ? " Revise os textos com o material da temporada." : ""}`,
        "success",
        5000,
      );
    });
  const existingNames = new Set(rubrics.map((r) => r.name.toLowerCase()));

  const remove = async (r: Rubric) => {
    const ok = await confirm({
      title: `Apagar a rubrica “${r.name}”?`,
      message: r.sheets ? `${r.sheets} ficha(s) preenchida(s) com ela serão apagadas.` : "Ela também sai das salas que a aplicavam.",
      confirmLabel: "Apagar",
      danger: true,
      typeToConfirm: r.sheets ? r.name : undefined,
    });
    if (ok === false) return;
    start(async () => {
      const res = await deleteRubric(eventId, r.id);
      if (!res.ok) addToast(res.error, "error");
    });
  };

  if (editing) {
    return (
      <RubricEditor
        eventId={eventId}
        initial={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
      />
    );
  }

  const ordered = [...presetGroups].sort((a, b) => (a.id === suggested ? -1 : b.id === suggested ? 1 : 0));

  return (
    <div className="space-y-6">
      <Panel
        kicker={`/ ${rubrics.length} RUBRICA(S)`}
        title="Rubricas do evento"
        action={
          <button type="button" className={`btn btn-sm btn-primary ${cornerBtn}`} onClick={() => setEditing("new")} disabled={rubrics.length >= LIMITS.rubricsPerEvent}>
            <Plus size={15} /> Nova rubrica
          </button>
        }
      >
        {rubrics.length === 0 ? (
          <EmptyState icon={<ListChecks size={22} />} title="Nenhuma rubrica ainda" text="Comece por um modelo abaixo ou crie a sua do zero." />
        ) : (
          <ul className="space-y-3">
            {rubrics.map((r, i) => {
              const s = scoreRubric(r.definition, {});
              return (
                <li key={r.id} className={`flex flex-wrap items-start gap-3 rounded-tl-xl rounded-br-xl border border-base-300 p-4 ${pending ? "opacity-60" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{r.name}</p>
                    {r.description && <p className="text-sm text-base-content/60">{r.description}</p>}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Tag className="border-base-content/20">{s.criteria} CRITÉRIOS</Tag>
                      <Tag className="border-base-content/20">
                        ESCALA {r.definition.levels[0].value}–{r.definition.levels.at(-1)!.value}
                      </Tag>
                      <Tag className="border-base-content/20">MÁX. {s.max}</Tag>
                      <Tag className="border-primary/40 text-primary">PESO {r.weight}</Tag>
                      {r.sheets > 0 && <Tag className="border-success/40 text-success">{r.sheets} FICHA(S)</Tag>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button type="button" className="btn btn-ghost btn-sm btn-square" disabled={i === 0 || pending} onClick={() => start(async () => void (await moveRubric(eventId, r.id, -1)))} aria-label="Subir">
                      <ArrowUp size={15} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm btn-square"
                      disabled={i === rubrics.length - 1 || pending}
                      onClick={() => start(async () => void (await moveRubric(eventId, r.id, 1)))}
                      aria-label="Descer"
                    >
                      <ArrowDown size={15} />
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm btn-square" onClick={() => setEditing(r)} aria-label={`Editar ${r.name}`}>
                      <Pencil size={15} />
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm btn-square text-error" onClick={() => remove(r)} aria-label={`Apagar ${r.name}`}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel kicker={`/ MODELOS · ${presetGroups.reduce((a, g) => a + g.presets.length, 0)} RUBRICAS PRONTAS`} title="Começar de um modelo">
        <PresetGallery groups={ordered} suggested={suggested} existing={existingNames} pending={pending} full={rubrics.length >= LIMITS.rubricsPerEvent} onAdd={addPresets} />
        <p className="mt-4 text-xs text-base-content/55">
          <b>Adaptados</b> seguem a estrutura pública do programa, com textos de apoio escritos para o ShowLive: confira com a rubrica oficial da
          temporada. <b>Originais</b> foram criados para o ShowLive. Depois de adicionar, tudo pode ser editado.
        </p>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------ modelos */

function PresetGallery({
  groups,
  suggested,
  existing,
  pending,
  full,
  onAdd,
}: {
  groups: Group[];
  suggested: string;
  existing: Set<string>;
  pending: boolean;
  full: boolean;
  onAdd: (g: Group, presetIds?: string[]) => void;
}) {
  const [filter, setFilter] = useState<"all" | "adapted" | "original">("all");
  const [openGroup, setOpenGroup] = useState<string | null>(suggested);
  const [preview, setPreview] = useState<string | null>(null);
  const visible = groups.filter((g) => filter === "all" || g.origin === filter);

  return (
    <div>
      <div role="tablist" className="mb-4 flex flex-wrap gap-1">
        {(
          [
            ["all", "Todos"],
            ["adapted", "Programas oficiais"],
            ["original", "Originais ShowLive"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={filter === k} className={`btn btn-xs ${filter === k ? "btn-neutral" : "btn-ghost"}`} onClick={() => setFilter(k)}>
            {label}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {visible.map((g) => {
          const open = openGroup === g.id;
          const missing = g.presets.filter((p) => g.recommended.includes(p.id) && !existing.has(p.name.toLowerCase()));
          const allRecommended = g.recommended.length === g.presets.length;
          return (
            <div key={g.id} className={`rounded-tl-xl rounded-br-xl border-2 ${g.id === suggested ? "border-primary/50" : "border-base-300"}`}>
              <button type="button" className="flex w-full items-start gap-3 p-4 text-left" onClick={() => setOpenGroup(open ? null : g.id)} aria-expanded={open}>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-bold">
                    {g.label}
                    <Tag className={g.origin === "adapted" ? "border-secondary/40 text-secondary" : "border-base-content/25 text-base-content/60"}>
                      {g.origin === "adapted" ? "ADAPTADO" : "ORIGINAL"}
                    </Tag>
                    {g.id === suggested && <Tag className="border-primary/40 text-primary">SUGERIDO</Tag>}
                  </p>
                  <p className="mt-1 text-xs text-base-content/60">{g.description}</p>
                  <p className="mt-1 text-[11px] text-base-content/50">
                    {g.presets.length} rubrica(s){g.sessionMinutes ? ` · sessão sugerida de ${g.sessionMinutes} min` : ""}
                  </p>
                </div>
                <ChevronDown size={18} className={`mt-1 shrink-0 transition ${open ? "rotate-180" : ""}`} />
              </button>
              {open && (
                <div className="border-t border-base-300 p-4">
                  <ul className="space-y-2">
                    {g.presets.map((p) => {
                      const added = existing.has(p.name.toLowerCase());
                      const criteria = p.sections.reduce((a, s) => a + s.criteria.length, 0);
                      const showing = preview === p.id;
                      return (
                        <li key={p.id} className="rounded-tl-lg rounded-br-lg bg-base-200/50 p-3">
                          <div className="flex flex-wrap items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold">{p.name}</p>
                              <p className="text-xs text-base-content/60">{p.description}</p>
                              <p className="mt-1 text-[11px] text-base-content/50">
                                {criteria} critérios · {p.levels.length} níveis
                                {p.weight !== 1 && ` · peso ${p.weight}${p.weight === 0 ? " (não conta no geral)" : ""}`}
                              </p>
                            </div>
                            <button type="button" className="btn btn-ghost btn-xs" onClick={() => setPreview(showing ? null : p.id)}>
                              {showing ? "Ocultar" : "Ver critérios"}
                            </button>
                            {added ? (
                              <Tag className="border-success/40 text-success">NO EVENTO</Tag>
                            ) : (
                              <button type="button" className="btn btn-outline btn-xs" disabled={pending || full} onClick={() => onAdd(g, [p.id])}>
                                <Plus size={12} /> Adicionar
                              </button>
                            )}
                          </div>
                          {showing && (
                            <div className="mt-3 space-y-2 border-t border-base-300 pt-3 text-xs">
                              <p className="text-base-content/60">Escala: {p.levels.join(" · ")}</p>
                              {p.sections.map((s) => (
                                <div key={s.title}>
                                  <p className="kicker">{s.title.toUpperCase()}</p>
                                  <ul className="ml-4 list-disc">
                                    {s.criteria.map((c) => (
                                      <li key={c}>{c}</li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {missing.length > 1 && (
                    <button type="button" className={`btn btn-sm btn-primary mt-3 ${cornerBtn}`} disabled={pending || full} onClick={() => onAdd(g, missing.map((p) => p.id))}>
                      <Sparkles size={14} /> {allRecommended ? `Adicionar as ${missing.length} rubricas` : `Adicionar o conjunto recomendado (${missing.length})`}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- editor */

function RubricEditor({ eventId, initial, onClose }: { eventId: string; initial: Rubric | null; onClose: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [weight, setWeight] = useState(initial?.weight ?? 1);
  const [def, setDef] = useState<RubricDefinition>(() => structuredClone(initial?.definition ?? blankRubric()));
  const [pending, start] = useTransition();
  const { addToast } = useToast();

  const total = allCriteria(def).length;
  const s = scoreRubric(def, {});

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await saveRubric(eventId, initial?.id ?? null, { name, description, weight, definition: def });
      if (!r.ok) return addToast(r.error, "error", 5000);
      addToast(initial ? "Rubrica atualizada." : "Rubrica criada.", "success");
      onClose();
    });
  };

  const setLevels = (levels: RubricDefinition["levels"]) =>
    setDef((d) => ({
      ...d,
      levels,
      commentFromLevel: levels.some((l) => l.value === d.commentFromLevel) ? d.commentFromLevel : null,
    }));
  const setSection = (si: number, fn: (s: RubricDefinition["sections"][number]) => RubricDefinition["sections"][number]) =>
    setDef((d) => ({ ...d, sections: d.sections.map((s, i) => (i === si ? fn(s) : s)) }));
  const setCriterion = (si: number, ci: number, patch: Partial<RubricCriterion>) =>
    setSection(si, (s) => ({ ...s, criteria: s.criteria.map((c, i) => (i === ci ? { ...c, ...patch } : c)) }));

  return (
    <form onSubmit={save} className="space-y-6 pb-24">
      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-ghost btn-sm btn-square" onClick={onClose} aria-label="Fechar editor">
          <X size={18} />
        </button>
        <div>
          <p className="kicker">/ {initial ? "EDITAR" : "NOVA"} RUBRICA</p>
          <h2 className="text-xl font-bold tracking-tight">{name || "Sem nome"}</h2>
        </div>
      </div>

      {initial && initial.sheets > 0 && (
        <p className="rounded-tl-xl rounded-br-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          Esta rubrica já tem {initial.sheets} ficha(s). Ao salvar, os totais são recalculados; respostas de critérios removidos são descartadas e
          fichas que ficarem incompletas voltam para rascunho.
        </p>
      )}

      <Panel kicker="/ 1" title="Identificação">
        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
          <label className="block">
            <span className="text-xs font-medium text-base-content/70">Nome</span>
            <input className="input input-bordered mt-1 w-full" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} required placeholder="Projeto de Inovação" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-base-content/70">Peso no geral</span>
            <input type="number" step={0.5} min={0} max={10} className="input input-bordered mt-1 w-full" value={weight} onChange={(e) => setWeight(Number(e.target.value))} />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-base-content/70">Descrição (a banca vê no topo da ficha)</span>
            <input className="input input-bordered mt-1 w-full" value={description} maxLength={240} onChange={(e) => setDescription(e.target.value)} />
          </label>
        </div>
      </Panel>

      <Panel kicker="/ 2" title="Escala">
        <div className="flex flex-wrap gap-2">
          {def.levels.map((l, i) => (
            <div key={i} className="flex items-center gap-1 rounded-tl-lg rounded-br-lg border border-base-300 p-1">
              <input
                type="number"
                className="input input-bordered input-sm w-16 font-mono"
                value={l.value}
                min={0}
                max={100}
                onChange={(e) => setLevels(def.levels.map((x, j) => (j === i ? { ...x, value: Number(e.target.value) } : x)))}
                aria-label={`Valor do nível ${i + 1}`}
              />
              <input
                className="input input-bordered input-sm w-40"
                value={l.label}
                maxLength={30}
                onChange={(e) => setLevels(def.levels.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                aria-label={`Nome do nível ${i + 1}`}
              />
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-square"
                disabled={def.levels.length <= LIMITS.levels.min}
                onClick={() => setLevels(def.levels.filter((_, j) => j !== i))}
                aria-label="Remover nível"
              >
                <X size={13} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-sm btn-outline"
            disabled={def.levels.length >= LIMITS.levels.max}
            onClick={() => {
              const next = Math.max(...def.levels.map((l) => l.value)) + 1;
              setLevels([...def.levels, { value: next, label: `Nível ${next}` }]);
            }}
          >
            <Plus size={14} /> Nível
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-base-content/70">Comentário obrigatório a partir do nível</span>
            <select
              className="select select-bordered mt-1 w-full"
              value={def.commentFromLevel ?? ""}
              onChange={(e) => setDef((d) => ({ ...d, commentFromLevel: e.target.value === "" ? null : Number(e.target.value) }))}
            >
              <option value="">Nunca obrigatório</option>
              {def.levels.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.value} · {l.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex cursor-pointer items-center gap-3 self-end rounded-tl-xl rounded-br-xl bg-base-200/70 px-4 py-3">
            <input type="checkbox" className="toggle toggle-primary toggle-sm" checked={def.requireFeedback} onChange={(e) => setDef((d) => ({ ...d, requireFeedback: e.target.checked }))} />
            <span className="text-sm">Exigir “pontos fortes” e “o que melhorar” ao enviar</span>
          </label>
        </div>
      </Panel>

      <Panel kicker={`/ 3 · ${total} CRITÉRIOS · MÁX. ${s.max}`} title="Seções e critérios">
        <div className="space-y-5">
          {def.sections.map((section, si) => (
            <div key={section.id} className="rounded-tl-xl rounded-br-xl border border-base-300 p-4">
              <div className="flex items-center gap-2">
                <input
                  className="input input-bordered input-sm flex-1 font-bold"
                  value={section.title}
                  maxLength={80}
                  onChange={(e) => setSection(si, (s) => ({ ...s, title: e.target.value }))}
                  aria-label="Título da seção"
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-square text-error"
                  disabled={def.sections.length <= 1}
                  onClick={() => setDef((d) => ({ ...d, sections: d.sections.filter((_, i) => i !== si) }))}
                  aria-label="Remover seção"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <ul className="mt-3 space-y-2">
                {section.criteria.map((c, ci) => (
                  <CriterionEditor
                    key={c.id}
                    criterion={c}
                    levels={def.levels}
                    first={ci === 0}
                    last={ci === section.criteria.length - 1}
                    onChange={(p) => setCriterion(si, ci, p)}
                    onMove={(dir) =>
                      setSection(si, (s) => {
                        const list = [...s.criteria];
                        [list[ci], list[ci + dir]] = [list[ci + dir], list[ci]];
                        return { ...s, criteria: list };
                      })
                    }
                    onRemove={() => setSection(si, (s) => ({ ...s, criteria: s.criteria.filter((_, i) => i !== ci) }))}
                  />
                ))}
              </ul>
              <button
                type="button"
                className="btn btn-ghost btn-sm mt-2"
                disabled={total >= LIMITS.criteria}
                onClick={() => setSection(si, (s) => ({ ...s, criteria: [...s.criteria, { id: rubricId(), label: "" }] }))}
              >
                <Plus size={14} /> Critério
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={def.sections.length >= LIMITS.sections}
            onClick={() => setDef((d) => ({ ...d, sections: [...d.sections, { id: rubricId("s"), title: `Seção ${d.sections.length + 1}`, criteria: [{ id: rubricId(), label: "" }] }] }))}
          >
            <Plus size={14} /> Seção
          </button>
        </div>
      </Panel>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-base-300 bg-base-100/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-2 px-4 py-3">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className={`btn btn-primary ${cornerBtn}`} disabled={pending}>
            {pending && <span className="loading loading-spinner loading-sm" />} Salvar rubrica
          </button>
        </div>
      </div>
    </form>
  );
}

function CriterionEditor({
  criterion,
  levels,
  first,
  last,
  onChange,
  onMove,
  onRemove,
}: {
  criterion: RubricCriterion;
  levels: RubricDefinition["levels"];
  first: boolean;
  last: boolean;
  onChange: (p: Partial<RubricCriterion>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-tl-lg rounded-br-lg bg-base-200/50 p-2">
      <div className="flex items-center gap-1">
        <input
          className="input input-bordered input-sm flex-1"
          placeholder="Nome do critério"
          value={criterion.label}
          maxLength={120}
          onChange={(e) => onChange({ label: e.target.value })}
          aria-label="Nome do critério"
        />
        <input
          type="number"
          step={0.5}
          min={0}
          max={10}
          className="input input-bordered input-sm w-20"
          value={criterion.weight ?? 1}
          onChange={(e) => onChange({ weight: Number(e.target.value) })}
          title="Peso"
          aria-label="Peso do critério"
        />
        <button type="button" className="btn btn-ghost btn-xs btn-square" onClick={() => setOpen((v) => !v)} aria-label="Detalhes" aria-expanded={open}>
          <ChevronDown size={14} className={open ? "rotate-180" : ""} />
        </button>
        <button type="button" className="btn btn-ghost btn-xs btn-square" disabled={first} onClick={() => onMove(-1)} aria-label="Subir critério">
          <ArrowUp size={13} />
        </button>
        <button type="button" className="btn btn-ghost btn-xs btn-square" disabled={last} onClick={() => onMove(1)} aria-label="Descer critério">
          <ArrowDown size={13} />
        </button>
        <button type="button" className="btn btn-ghost btn-xs btn-square text-error" onClick={onRemove} aria-label="Remover critério">
          <Trash2 size={13} />
        </button>
      </div>
      {open && (
        <div className="mt-2 space-y-2 pl-1">
          <input
            className="input input-bordered input-sm w-full"
            placeholder="O que a banca observa (opcional)"
            value={criterion.description ?? ""}
            maxLength={500}
            onChange={(e) => onChange({ description: e.target.value })}
          />
          <div className="grid gap-2 md:grid-cols-2">
            {levels.map((l, i) => (
              <label key={l.value} className="block">
                <span className="text-[11px] text-base-content/60">
                  {l.value} · {l.label}
                </span>
                <textarea
                  className="textarea textarea-bordered textarea-sm w-full"
                  rows={2}
                  maxLength={400}
                  value={criterion.hints?.[i] ?? ""}
                  onChange={(e) => {
                    const hints = levels.map((_, j) => criterion.hints?.[j] ?? "");
                    hints[i] = e.target.value;
                    onChange({ hints });
                  }}
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </li>
  );
}
