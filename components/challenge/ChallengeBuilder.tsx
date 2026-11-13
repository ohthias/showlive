"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Copy,
  FlaskConical,
  Gauge,
  ListChecks,
  Plus,
  Printer,
  Ruler,
  Save,
  Scale,
  Timer,
  Trash2,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { saveEventChallenge, saveExtraChallenge, saveTemplate } from "@/app/actions/challenges";
import { cornerBtn, Panel } from "@/components/ui/brand";
import { useConfirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import {
  CHALLENGE_TYPES,
  ITEM_KINDS,
  newId,
  sanitizeChallenge,
  scoreChallenge,
  type Challenge,
  type ChallengeItem,
  type ChallengeType,
  type CustomResponses,
  type ItemKind,
} from "@/lib/challenge";
import { formatScore } from "@/lib/format";
import { ChallengeSheet } from "./ChallengeSheet";
import { CustomScoreForm } from "./CustomScoreForm";

type Mode =
  | { kind: "event"; eventId: string; scored: number }
  | { kind: "template"; templateId: string | null }
  | { kind: "extra"; eventId: string; extraId: string | null };

const TYPE_ICONS: Record<ChallengeType, LucideIcon> = { missions: ListChecks, time: Timer, judged: Scale, measure: Ruler };

export function ChallengeBuilder({ initial, mode, eventName }: { initial: Challenge; mode: Mode; eventName?: string }) {
  const [ch, setCh] = useState<Challenge>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [tab, setTab] = useState<"build" | "sheet" | "test">("build");
  const [test, setTest] = useState<CustomResponses>({});
  const [pending, start] = useTransition();
  const { addToast } = useToast();
  const confirm = useConfirm();
  const router = useRouter();

  const dirty = JSON.stringify(ch) !== saved;
  const error = useMemo(() => {
    try {
      sanitizeChallenge(ch);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }, [ch]);
  const testResult = useMemo(() => scoreChallenge(ch, test), [ch, test]);

  const patch = (p: Partial<Challenge>) => setCh((c) => ({ ...c, ...p }));
  const patchItem = (id: string, p: Partial<ChallengeItem>) =>
    setCh((c) => ({ ...c, items: c.items.map((i) => (i.id === id ? { ...i, ...p } : i)) }));
  const move = <T,>(list: T[], i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  };

  const changeType = (type: ChallengeType) => {
    if (type === ch.type) return;
    const meta = CHALLENGE_TYPES[type];
    let items = ch.items
      .filter((i) => type === "time" || i.kind !== "time")
      .map((i) => (meta.kinds.includes(i.kind) ? i : { ...i, kind: meta.kinds[0] === "time" ? "check" : meta.kinds[0], points: i.points ?? 10 }));
    if (type === "time" && !items.some((i) => i.kind === "time"))
      items = [{ id: newId("t"), label: "Tempo do percurso", kind: "time", required: true }, ...items];
    if (!items.length) items = [{ id: newId(), label: "Item 1", kind: meta.kinds[0], points: 10, min: 1, max: 4 }];
    setCh((c) => ({ ...c, type, items: items as ChallengeItem[], scoring: { ...meta.scoring, floorAtZero: c.scoring.floorAtZero } }));
  };

  const addItem = () => {
    const kind = CHALLENGE_TYPES[ch.type].kinds.find((k) => k !== "time") ?? "check";
    setCh((c) => ({ ...c, items: [...c.items, defaultsFor(kind, `Item ${c.items.length + 1}`)] }));
  };

  const save = async (asTemplate = false) => {
    if (error) return addToast(error, "error");
    if (!asTemplate && mode.kind === "event" && mode.scored > 0) {
      const ok = await confirm({
        title: "Já existem notas neste evento",
        message: `${mode.scored} nota(s) foram calculadas com a versão anterior e não serão recalculadas. A mudança vale para as próximas avaliações.`,
        confirmLabel: "Salvar mesmo assim",
      });
      if (ok === false) return;
    }
    start(async () => {
      if (!asTemplate && mode.kind === "extra") {
        const r = await saveExtraChallenge(mode.eventId, mode.extraId, ch);
        if (!r.ok) return addToast(r.error, "error");
        setSaved(JSON.stringify(ch));
        addToast("Desafio extra salvo. Já aparece na mesa e no telão.", "success");
        if (!mode.extraId) router.replace(`/hub/${mode.eventId}/arenas/extra/${r.data.id}`);
        return;
      }
      if (asTemplate || mode.kind === "template") {
        const id = mode.kind === "template" && !asTemplate ? mode.templateId : null;
        const r = await saveTemplate(id, ch);
        if (!r.ok) return addToast(r.error, "error");
        addToast(asTemplate ? "Salvo nos seus templates." : "Template salvo.", "success");
        if (mode.kind === "template") {
          setSaved(JSON.stringify(ch));
          if (!mode.templateId) router.replace(`/hub/templates/${r.data.id}`);
        }
        return;
      }
      const r = await saveEventChallenge(mode.eventId, ch);
      if (!r.ok) return addToast(r.error, "error");
      setSaved(JSON.stringify(ch));
      addToast("Desafio salvo. A mesa e o telão já usam a nova versão.", "success");
    });
  };

  const Icon = TYPE_ICONS[ch.type];

  return (
    <div className="space-y-5">
      {/* barra */}
      <div className="sticky top-14 z-20 -mx-1 flex flex-wrap items-center gap-2 rounded-tl-2xl rounded-br-2xl border border-base-300 bg-base-100/95 px-3 py-2 backdrop-blur">
        <div role="tablist" className="join">
          {(
            [
              ["build", "Montar", Wrench],
              ["sheet", "Regulamento", BookOpen],
              ["test", "Testar súmula", FlaskConical],
            ] as const
          ).map(([id, label, I]) => (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`join-item btn btn-sm ${tab === id ? "btn-neutral" : "btn-ghost"}`}
            >
              <I size={14} /> {label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {error ? (
            <span className="hidden items-center gap-1 text-xs text-warning sm:inline-flex">
              <AlertTriangle size={14} /> {error}
            </span>
          ) : dirty ? (
            <span className="hidden text-xs text-base-content/55 sm:inline">Alterações não salvas</span>
          ) : null}
          {tab === "sheet" && (
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => window.print()}>
              <Printer size={14} /> Imprimir
            </button>
          )}
          {mode.kind !== "template" && (
            <button type="button" className="btn btn-sm btn-outline" disabled={pending || !!error} onClick={() => save(true)}>
              <Copy size={14} /> Salvar como template
            </button>
          )}
          <button
            type="button"
            className={`btn btn-sm btn-primary ${cornerBtn}`}
            disabled={pending || !!error || (!dirty && !(mode.kind === "template" && !mode.templateId) && !(mode.kind === "extra" && !mode.extraId))}
            onClick={() => save(false)}
          >
            {pending ? <span className="loading loading-spinner loading-xs" /> : <Save size={14} />}
            {mode.kind === "event" ? "Salvar desafio" : mode.kind === "extra" ? "Salvar desafio extra" : "Salvar template"}
          </button>
        </div>
      </div>

      {tab === "sheet" && <ChallengeSheet challenge={ch} eventName={eventName} />}

      {tab === "test" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          <CustomScoreForm challenge={ch} responses={test} onChange={setTest} />
          <aside className="lg:sticky lg:top-32 lg:self-start">
            <div className="rounded-tl-2xl rounded-br-2xl border-2 border-base-content bg-base-100 p-5 shadow-[6px_6px_0_0_var(--color-primary)]">
              <p className="kicker">/ RESULTADO DA TENTATIVA</p>
              <p className="mt-2 font-mono text-4xl font-black tabular-nums">{formatScore(testResult.value, ch.scoring)}</p>
              {testResult.penalty > 0 && <p className="mt-1 text-xs text-error">Penalidades: {formatScore(testResult.penalty, ch.scoring)}</p>}
              {testResult.missing.length > 0 && (
                <p className="mt-3 text-xs text-warning">Faltam itens obrigatórios: {testResult.missing.map((m) => m.label).join(", ")}</p>
              )}
              <button type="button" className="btn btn-ghost btn-xs mt-4" onClick={() => setTest({})}>
                Limpar teste
              </button>
            </div>
            <p className="mt-3 text-xs text-base-content/55">É exatamente o que a mesa vai ver. Nada é salvo aqui.</p>
          </aside>
        </div>
      )}

      {tab === "build" && (
        <div className="space-y-5">
          <Panel kicker="/ 1 · TIPO" title="Que tipo de desafio é?">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {(Object.keys(CHALLENGE_TYPES) as ChallengeType[]).map((t) => {
                const meta = CHALLENGE_TYPES[t];
                const I = TYPE_ICONS[t];
                const active = ch.type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => changeType(t)}
                    className={`rounded-tl-2xl rounded-br-2xl border-2 p-4 text-left transition ${
                      active ? "border-base-content bg-base-100 shadow-[4px_4px_0_0_var(--color-primary)]" : "border-base-300 hover:border-base-content/30"
                    }`}
                  >
                    <span className={`grid size-10 place-items-center rounded-tl-lg rounded-br-lg ${active ? "bg-primary text-primary-content" : "bg-base-200"}`}>
                      <I size={20} />
                    </span>
                    <span className="mt-3 block font-bold">{meta.label}</span>
                    <span className="font-mono text-[10px] tracking-wider text-base-content/50">{meta.short.toUpperCase()}</span>
                    <span className="mt-2 block text-xs leading-5 text-base-content/60">{meta.description}</span>
                  </button>
                );
              })}
            </div>
          </Panel>

          <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
            <Panel kicker="/ 2 · IDENTIDADE" title="Nome e objetivo" action={<Icon size={16} className="text-base-content/40" />}>
              <label className="block">
                <span className="text-sm font-medium">Nome do desafio</span>
                <input
                  value={ch.name}
                  maxLength={60}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="Ex.: Seguidor de Linha"
                  className="input input-bordered mt-1 w-full text-lg font-bold"
                />
              </label>
              <label className="mt-4 block">
                <span className="text-sm font-medium">Objetivo</span>
                <textarea
                  value={ch.objective}
                  maxLength={600}
                  rows={3}
                  onChange={(e) => patch({ objective: e.target.value })}
                  placeholder="O que o robô precisa fazer, em uma ou duas frases."
                  className="textarea textarea-bordered mt-1 w-full"
                />
              </label>
            </Panel>

            <Panel kicker="/ 3 · FUNCIONAMENTO" title="Como o resultado é lido" action={<Gauge size={16} className="text-base-content/40" />}>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["higher", "Maior vence"],
                    ["lower", "Menor vence"],
                  ] as const
                ).map(([d, label]) => (
                  <button
                    key={d}
                    type="button"
                    disabled={ch.type === "time"}
                    onClick={() => patch({ scoring: { ...ch.scoring, direction: d } })}
                    className={`btn ${cornerBtn} ${ch.scoring.direction === d ? "btn-neutral" : "btn-outline border-base-300"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <label>
                  <span className="text-xs font-medium">Unidade</span>
                  <input
                    value={ch.scoring.unit}
                    maxLength={8}
                    disabled={ch.type === "time"}
                    onChange={(e) => patch({ scoring: { ...ch.scoring, unit: e.target.value } })}
                    className="input input-bordered input-sm mt-1 w-full"
                  />
                </label>
                <label>
                  <span className="text-xs font-medium">Casas decimais</span>
                  <select
                    value={ch.scoring.decimals}
                    onChange={(e) => patch({ scoring: { ...ch.scoring, decimals: Number(e.target.value) as 0 | 1 | 2 } })}
                    className="select select-bordered select-sm mt-1 w-full"
                  >
                    <option value={0}>0</option>
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                  </select>
                </label>
                <label>
                  <span className="text-xs font-medium">Tempo/tentativa (s)</span>
                  <input
                    type="number"
                    min={0}
                    value={ch.scoring.timeLimitSec ?? ""}
                    onChange={(e) => patch({ scoring: { ...ch.scoring, timeLimitSec: e.target.value ? Number(e.target.value) : null } })}
                    placeholder="—"
                    className="input input-bordered input-sm mt-1 w-full"
                  />
                </label>
              </div>
              <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={ch.scoring.floorAtZero}
                  onChange={(e) => patch({ scoring: { ...ch.scoring, floorAtZero: e.target.checked } })}
                />
                Resultado nunca negativo
              </label>
              {ch.type === "time" && (
                <p className="mt-3 text-xs text-base-content/55">
                  Contra o tempo: menor vence, em segundos. Com tempo limite, a mesa pode marcar &quot;não completou&quot;.
                </p>
              )}
            </Panel>
          </div>

          <Panel
            kicker={`/ 4 · REGRAS (${ch.rules.length})`}
            title="Regras de funcionamento"
            action={
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => patch({ rules: [...ch.rules, ""] })}>
                <Plus size={13} /> Regra
              </button>
            }
          >
            {ch.rules.length === 0 && (
              <p className="text-sm text-base-content/55">Tentativas, tempo, o que invalida a rodada, como medir… Elas vão para o regulamento.</p>
            )}
            <ol className="space-y-2">
              {ch.rules.map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-2.5 w-6 font-mono text-xs font-bold text-primary">{String(i + 1).padStart(2, "0")}</span>
                  <textarea
                    value={r}
                    rows={1}
                    maxLength={300}
                    onChange={(e) => patch({ rules: ch.rules.map((x, k) => (k === i ? e.target.value : x)) })}
                    className="textarea textarea-bordered textarea-sm min-h-10 flex-1"
                    placeholder="Ex.: Cada equipe tem 3 tentativas; vale a melhor."
                  />
                  <RowTools
                    onUp={() => patch({ rules: move(ch.rules, i, -1) })}
                    onDown={() => patch({ rules: move(ch.rules, i, 1) })}
                    onDelete={() => patch({ rules: ch.rules.filter((_, k) => k !== i) })}
                  />
                </li>
              ))}
            </ol>
          </Panel>

          <Panel
            kicker={`/ 5 · PONTUAÇÃO (${ch.items.length})`}
            title="Itens da súmula"
            action={
              <button type="button" className={`btn btn-xs btn-primary ${cornerBtn}`} onClick={addItem}>
                <Plus size={13} /> Item
              </button>
            }
          >
            <ul className="space-y-3">
              {ch.items.map((item, i) => (
                <ItemEditor
                  key={item.id}
                  index={i}
                  item={item}
                  type={ch.type}
                  unit={ch.scoring.unit}
                  onChange={(p) => patchItem(item.id, p)}
                  onUp={() => patch({ items: move(ch.items, i, -1) })}
                  onDown={() => patch({ items: move(ch.items, i, 1) })}
                  onDuplicate={() =>
                    patch({ items: [...ch.items.slice(0, i + 1), { ...structuredClone(item), id: newId(), label: `${item.label} (cópia)` }, ...ch.items.slice(i + 1)] })
                  }
                  onDelete={() => patch({ items: ch.items.filter((x) => x.id !== item.id) })}
                />
              ))}
            </ul>
          </Panel>

          <Panel
            kicker={`/ 6 · PENALIDADES (${ch.penalties.length})`}
            title={ch.scoring.direction === "lower" ? "Penalidades (somam ao resultado)" : "Penalidades (descontam do resultado)"}
            action={
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => patch({ penalties: [...ch.penalties, { id: newId("p"), label: "Penalidade", points: 5, max: 3 }] })}
              >
                <Plus size={13} /> Penalidade
              </button>
            }
          >
            {ch.penalties.length === 0 && <p className="text-sm text-base-content/55">Toques no robô, saídas de pista, peças fora da área…</p>}
            <ul className="space-y-2">
              {ch.penalties.map((p, i) => (
                <li key={p.id} className="grid items-end gap-2 sm:grid-cols-[1fr_110px_90px_auto]">
                  <label>
                    <span className="text-xs">Descrição</span>
                    <input
                      value={p.label}
                      onChange={(e) => patch({ penalties: ch.penalties.map((x) => (x.id === p.id ? { ...x, label: e.target.value } : x)) })}
                      className="input input-bordered input-sm w-full"
                    />
                  </label>
                  <label>
                    <span className="text-xs">Valor ({ch.scoring.unit})</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={p.points}
                      onChange={(e) => patch({ penalties: ch.penalties.map((x) => (x.id === p.id ? { ...x, points: Number(e.target.value) } : x)) })}
                      className="input input-bordered input-sm w-full"
                    />
                  </label>
                  <label>
                    <span className="text-xs">Máx.</span>
                    <input
                      type="number"
                      min={1}
                      value={p.max}
                      onChange={(e) => patch({ penalties: ch.penalties.map((x) => (x.id === p.id ? { ...x, max: Number(e.target.value) } : x)) })}
                      className="input input-bordered input-sm w-full"
                    />
                  </label>
                  <RowTools
                    onUp={() => patch({ penalties: move(ch.penalties, i, -1) })}
                    onDown={() => patch({ penalties: move(ch.penalties, i, 1) })}
                    onDelete={() => patch({ penalties: ch.penalties.filter((x) => x.id !== p.id) })}
                  />
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </div>
  );
}

function defaultsFor(kind: ItemKind, label: string): ChallengeItem {
  const base = { id: newId(), label, kind };
  switch (kind) {
    case "check":
      return { ...base, points: 10 };
    case "count":
      return { ...base, points: 5, max: 5 };
    case "choice":
      return { ...base, options: [{ label: "Não", points: 0 }, { label: "Parcial", points: 5 }, { label: "Completo", points: 10 }] };
    case "scale":
      return { ...base, min: 1, max: 4, points: 1, required: true };
    case "number":
      return { ...base, points: 1, min: 0, max: 1000, required: true };
    case "time":
      return { ...base, required: true };
  }
}

function RowTools({ onUp, onDown, onDelete, onDuplicate }: { onUp: () => void; onDown: () => void; onDelete: () => void; onDuplicate?: () => void }) {
  return (
    <div className="flex shrink-0 items-center">
      <button type="button" className="btn btn-ghost btn-xs btn-square" onClick={onUp} aria-label="Subir">
        <ArrowUp size={13} />
      </button>
      <button type="button" className="btn btn-ghost btn-xs btn-square" onClick={onDown} aria-label="Descer">
        <ArrowDown size={13} />
      </button>
      {onDuplicate && (
        <button type="button" className="btn btn-ghost btn-xs btn-square" onClick={onDuplicate} aria-label="Duplicar">
          <Copy size={13} />
        </button>
      )}
      <button type="button" className="btn btn-ghost btn-xs btn-square text-error" onClick={onDelete} aria-label="Remover">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function ItemEditor({
  index,
  item,
  type,
  unit,
  onChange,
  onUp,
  onDown,
  onDuplicate,
  onDelete,
}: {
  index: number;
  item: ChallengeItem;
  type: ChallengeType;
  unit: string;
  onChange: (p: Partial<ChallengeItem>) => void;
  onUp: () => void;
  onDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const kinds = CHALLENGE_TYPES[type].kinds;
  const field = (label: string, key: "points" | "min" | "max", step = "any") => (
    <label>
      <span className="text-xs">{label}</span>
      <input
        type="number"
        step={step}
        value={item[key] ?? ""}
        onChange={(e) => onChange({ [key]: e.target.value === "" ? undefined : Number(e.target.value) })}
        className="input input-bordered input-sm w-full"
      />
    </label>
  );

  return (
    <li className="rounded-tl-xl rounded-br-xl border border-base-300 bg-base-200/40 p-3">
      <div className="flex items-start gap-2">
        <span className="mt-1.5 grid size-7 shrink-0 place-items-center rounded-tl-md rounded-br-md bg-base-content font-mono text-xs font-bold text-base-100">
          {index + 1}
        </span>
        <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_170px]">
          <input
            value={item.label}
            maxLength={120}
            onChange={(e) => onChange({ label: e.target.value })}
            className="input input-bordered input-sm w-full font-medium"
            placeholder="O que a mesa avalia"
          />
          <select
            value={item.kind}
            disabled={item.kind === "time"}
            onChange={(e) => onChange({ ...defaultsFor(e.target.value as ItemKind, item.label), id: item.id, description: item.description })}
            className="select select-bordered select-sm w-full"
            title={ITEM_KINDS[item.kind].hint}
          >
            {(item.kind === "time" ? ["time" as ItemKind] : kinds.filter((k) => k !== "time")).map((k) => (
              <option key={k} value={k}>
                {ITEM_KINDS[k].label}
              </option>
            ))}
          </select>
        </div>
        <RowTools onUp={onUp} onDown={onDown} onDuplicate={item.kind === "time" ? undefined : onDuplicate} onDelete={onDelete} />
      </div>

      <div className="mt-2 grid gap-2 pl-9 sm:grid-cols-4">
        {item.kind === "check" && field(`Pontos (${unit})`, "points")}
        {item.kind === "count" && (
          <>
            {field(`Por unidade (${unit})`, "points")}
            {field("Máximo", "max", "1")}
          </>
        )}
        {item.kind === "scale" && (
          <>
            {field("Nota mín.", "min", "1")}
            {field("Nota máx.", "max", "1")}
            {field("Peso", "points")}
          </>
        )}
        {item.kind === "number" && (
          <>
            {field("Mínimo", "min")}
            {field("Máximo", "max")}
            {field("Fator", "points")}
          </>
        )}
        {item.kind === "time" && <p className="text-xs text-base-content/55 sm:col-span-4">A mesa digita ou cronometra o tempo em segundos.</p>}
        <label className="flex items-end gap-2 pb-1 text-xs sm:col-start-4 sm:justify-end">
          <input type="checkbox" className="checkbox checkbox-xs" checked={!!item.required} disabled={item.kind === "time"} onChange={(e) => onChange({ required: e.target.checked })} />
          Obrigatório
        </label>
      </div>

      {item.kind === "choice" && (
        <div className="mt-2 space-y-1.5 pl-9">
          {(item.options ?? []).map((o, k) => (
            <div key={k} className="flex items-center gap-2">
              <input
                value={o.label}
                onChange={(e) => onChange({ options: item.options!.map((x, j) => (j === k ? { ...x, label: e.target.value } : x)) })}
                className="input input-bordered input-xs flex-1"
              />
              <input
                type="number"
                step="any"
                value={o.points}
                onChange={(e) => onChange({ options: item.options!.map((x, j) => (j === k ? { ...x, points: Number(e.target.value) } : x)) })}
                className="input input-bordered input-xs w-20"
              />
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-square"
                disabled={(item.options?.length ?? 0) <= 2}
                onClick={() => onChange({ options: item.options!.filter((_, j) => j !== k) })}
                aria-label="Remover opção"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => onChange({ options: [...(item.options ?? []), { label: "Opção", points: 0 }] })}>
            <Plus size={12} /> Opção
          </button>
        </div>
      )}

      <input
        value={item.description ?? ""}
        maxLength={240}
        onChange={(e) => onChange({ description: e.target.value || undefined })}
        placeholder="Descrição para a mesa (opcional)"
        className="input input-ghost input-xs mt-2 ml-9 w-[calc(100%-2.25rem)] text-base-content/70"
      />
    </li>
  );
}
