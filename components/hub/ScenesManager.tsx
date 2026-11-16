"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Crown,
  ExternalLink,
  ListOrdered,
  Pencil,
  Plus,
  Radio,
  Sparkles,
  Timer,
  Trash2,
  Trophy,
  Type,
  Video,
  type LucideIcon,
} from "lucide-react";
import { deleteScene, reorderScene, saveScene, setLiveScene } from "@/app/actions/settings";
import { Panel, Tag } from "@/components/ui/brand";
import { useToast } from "@/components/ui/Toast";
import {
  defaultScene,
  MAX_SCENES,
  newSceneId,
  SCENE_BOARDS,
  SCENE_LAYOUTS,
  type Scene,
  type SceneBoard,
  type SceneLayout,
  type ScenesState,
  type SceneToggle,
} from "@/lib/live/scenes";

const ICONS: Record<SceneLayout, LucideIcon> = {
  ranking: ListOrdered,
  leaders: Crown,
  spotlight: Timer,
  title: Type,
  camera: Video,
  podium: Trophy,
};

const W = 1600;
const H = 900;

/** Telão em miniatura: iframe em 1600×900 reduzido para caber na caixa. */
function Monitor({
  src,
  frameRef,
  onLoad,
  tone,
  label,
}: {
  src: string;
  frameRef?: React.Ref<HTMLIFrameElement>;
  onLoad?: () => void;
  tone: "preview" | "live";
  label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 font-mono text-[11px] font-bold tracking-[0.2em]">
        {tone === "live" ? (
          <span className="inline-flex items-center gap-1.5 rounded bg-error px-2 py-0.5 text-error-content">
            <span className="live-dot" /> NO AR
          </span>
        ) : (
          <span className="rounded bg-warning px-2 py-0.5 text-warning-content">PRÉVIA</span>
        )}
        <span className="truncate text-base-content/60">{label}</span>
      </div>
      <div
        ref={box}
        className={`relative aspect-video w-full overflow-hidden rounded-tl-xl rounded-br-xl border-2 bg-black ${tone === "live" ? "border-error" : "border-warning"}`}
      >
        <iframe
          ref={frameRef}
          src={src}
          title={tone === "live" ? "Telão no ar" : "Prévia da cena"}
          onLoad={onLoad}
          className="absolute left-0 top-0 origin-top-left border-0"
          style={{ width: W, height: H, transform: `scale(${scale})`, pointerEvents: "none" }}
        />
      </div>
    </div>
  );
}

function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="join">
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          className={`btn join-item btn-sm ${value === o.v ? "btn-neutral" : "btn-ghost border-base-300"}`}
          onClick={() => onChange(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const TOGGLE_OPTS: { v: SceneToggle; label: string }[] = [
  { v: "auto", label: "Do evento" },
  { v: "on", label: "Mostrar" },
  { v: "off", label: "Esconder" },
];

/**
 * Cenas do telão: até 4 disposições prontas. A organização escolhe uma cena
 * na PRÉVIA, confere e coloca NO AR — como uma mesa de corte.
 */
export function ScenesManager({ eventId, code, live, initial }: { eventId: string; code: string | null; live: boolean; initial: ScenesState }) {
  const [state, setState] = useState(initial);
  const [selected, setSelected] = useState<string>(initial.activeId ?? "auto");
  const [editing, setEditing] = useState<Scene | null>(null);
  const [liveKey, setLiveKey] = useState(0);
  const [pending, start] = useTransition();
  const { addToast } = useToast();

  const byId = (id: string) => state.items.find((s) => s.id === id) ?? null;
  const previewScene: Scene | null = editing ?? (selected === "auto" ? null : byId(selected));
  const previewName = editing ? `${editing.name || "Cena nova"} (editando)` : previewScene?.name ?? "Automática";
  const liveName = state.activeId ? (byId(state.activeId)?.name ?? "Automática") : "Automática";
  const isNew = !!editing && !state.items.some((s) => s.id === editing.id);

  /* A prévia recebe a cena por postMessage (inclusive o rascunho em edição). */
  const frame = useRef<HTMLIFrameElement>(null);
  const push = useCallback(() => {
    frame.current?.contentWindow?.postMessage({ type: "showlive:scene", scene: previewScene }, window.location.origin);
  }, [previewScene]);
  useEffect(push, [push]);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.type === "showlive:preview-ready") push();
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [push]);

  const apply = (next: ScenesState, bumpLive = false) => {
    setState(next);
    if (bumpLive) setLiveKey((k) => k + 1);
  };

  const cut = (id: string | null) =>
    start(async () => {
      const r = await setLiveScene(eventId, id);
      if (!r.ok) return addToast(r.error, "error");
      apply(r.data, true);
      addToast(id ? `“${byId(id)?.name}” está no telão.` : "Telão no modo automático.", "success");
    });

  const save = (thenLive: boolean) =>
    start(async () => {
      if (!editing) return;
      const r = await saveScene(eventId, editing);
      if (!r.ok) return addToast(r.error, "error");
      let next = r.data;
      const wasLive = next.activeId === editing.id;
      if (thenLive && !wasLive) {
        const r2 = await setLiveScene(eventId, editing.id);
        if (!r2.ok) return addToast(r2.error, "error");
        next = r2.data;
      }
      apply(next, thenLive || wasLive);
      setSelected(editing.id);
      setEditing(null);
      addToast(thenLive ? "Cena salva e no telão." : wasLive ? "Cena salva — o telão já mudou." : "Cena salva.", "success");
    });

  const remove = (id: string) =>
    start(async () => {
      const wasLive = state.activeId === id;
      const r = await deleteScene(eventId, id);
      if (!r.ok) return addToast(r.error, "error");
      apply(r.data, wasLive);
      if (selected === id) setSelected("auto");
      if (editing?.id === id) setEditing(null);
      addToast(wasLive ? "Cena apagada. O telão voltou ao automático." : "Cena apagada.", "success");
    });

  const move = (id: string, dir: -1 | 1) =>
    start(async () => {
      const r = await reorderScene(eventId, id, dir);
      if (r.ok) apply(r.data);
    });

  const startNew = () => {
    if (state.items.length >= MAX_SCENES) return;
    setEditing(defaultScene("ranking", newSceneId()));
  };

  const set = <K extends keyof Scene>(k: K, v: Scene[K]) => setEditing((d) => (d ? { ...d, [k]: v } : d));
  const setLayout = (layout: SceneLayout) =>
    setEditing((d) => {
      if (!d) return d;
      const base = defaultScene(layout, d.id);
      // Nome automático acompanha a disposição até a pessoa escrever outro.
      const autoName = Object.values(SCENE_LAYOUTS).some((l) => l.name === d.name);
      return { ...base, name: autoName ? base.name : d.name };
    });

  const previewIsLive = !editing && (selected === "auto" ? state.activeId === null : state.activeId === selected);

  return (
    <div className="space-y-6">
      <Panel
        kicker="/ CENAS"
        title="Prévia e no ar"
        action={
          <a href={code ? `/e/${code}` : `/hub/${eventId}/previa`} target="_blank" className="btn btn-ghost btn-xs">
            Abrir o telão <ExternalLink size={12} />
          </a>
        }
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <Monitor src={`/hub/${eventId}/previa?scene=auto`} frameRef={frame} onLoad={push} tone="preview" label={previewName} />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {editing ? (
                <>
                  <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => save(false)}>
                    Salvar cena
                  </button>
                  <button className="btn btn-error btn-sm" disabled={pending} onClick={() => save(true)}>
                    <Radio size={14} /> Salvar e colocar no ar
                  </button>
                  <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => setEditing(null)}>
                    Cancelar
                  </button>
                </>
              ) : (
                <button className="btn btn-error btn-sm" disabled={pending || previewIsLive} onClick={() => cut(selected === "auto" ? null : selected)}>
                  <Radio size={14} /> {previewIsLive ? "Já está no ar" : "Colocar no ar"}
                </button>
              )}
            </div>
          </div>
          <div>
            <Monitor key={`${state.activeId ?? "auto"}-${liveKey}`} src={`/hub/${eventId}/previa?scene=${state.activeId ?? "auto"}`} tone="live" label={liveName} />
            <p className="mt-3 text-xs text-base-content/55">
              {live ? "Todas as telas abertas com o código do evento mudam na hora." : "O evento está fora do ar: a cena escolhida vale quando ele entrar no ar."} No
              celular o público continua vendo a lista completa com busca.
            </p>
          </div>
        </div>
      </Panel>

      <Panel kicker={`/ ${state.items.length}/${MAX_SCENES} CENAS`} title="Escolha a cena">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <SceneCard
            icon={Sparkles}
            name="Automática"
            hint="Classificação em slides, como configurado no Telão"
            selected={!editing && selected === "auto"}
            onAir={state.activeId === null}
            onSelect={() => {
              setEditing(null);
              setSelected("auto");
            }}
          />
          {state.items.map((sc, i) => (
            <SceneCard
              key={sc.id}
              icon={ICONS[sc.layout]}
              name={sc.name}
              hint={SCENE_LAYOUTS[sc.layout].label}
              selected={editing ? editing.id === sc.id : selected === sc.id}
              onAir={state.activeId === sc.id}
              onSelect={() => {
                setEditing(null);
                setSelected(sc.id);
              }}
              tools={
                <>
                  <button className="btn btn-ghost btn-xs btn-square" title="Editar" onClick={() => setEditing({ ...sc })}>
                    <Pencil size={13} />
                  </button>
                  <button className="btn btn-ghost btn-xs btn-square" title="Mover para a esquerda" disabled={i === 0 || pending} onClick={() => move(sc.id, -1)}>
                    <ArrowLeft size={13} />
                  </button>
                  <button
                    className="btn btn-ghost btn-xs btn-square"
                    title="Mover para a direita"
                    disabled={i === state.items.length - 1 || pending}
                    onClick={() => move(sc.id, 1)}
                  >
                    <ArrowRight size={13} />
                  </button>
                  <button
                    className="btn btn-ghost btn-xs btn-square text-error"
                    title="Apagar"
                    disabled={pending}
                    onClick={() => confirm(`Apagar a cena “${sc.name}”?`) && remove(sc.id)}
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              }
            />
          ))}
          {state.items.length < MAX_SCENES && !isNew && (
            <button
              type="button"
              onClick={startNew}
              className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-tl-xl rounded-br-xl border-2 border-dashed border-base-300 p-4 text-sm text-base-content/60 transition hover:border-primary hover:text-primary"
            >
              <Plus size={22} />
              Nova cena
              <span className="text-xs">
                {state.items.length}/{MAX_SCENES}
              </span>
            </button>
          )}
          {isNew && editing && <SceneCard icon={ICONS[editing.layout]} name={editing.name || "Cena nova"} hint="Rascunho" selected onAir={false} onSelect={() => {}} />}
        </div>
        {state.items.length >= MAX_SCENES && !editing && (
          <p className="mt-3 text-xs text-base-content/55">Limite de {MAX_SCENES} cenas. Edite ou apague uma para criar outra.</p>
        )}
      </Panel>

      {editing && (
        <Panel kicker={isNew ? "/ NOVA CENA" : "/ EDITAR CENA"} title={editing.name || "Cena nova"}>
          <div className="space-y-6">
            <label className="flex max-w-sm flex-col">
              <span className="mb-1.5 text-sm font-medium">Nome da cena</span>
              <input className="input input-bordered" maxLength={30} value={editing.name} onChange={(e) => set("name", e.target.value)} />
            </label>

            <div>
              <p className="mb-2 text-sm font-medium">Disposição</p>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {(Object.keys(SCENE_LAYOUTS) as SceneLayout[]).map((l) => {
                  const Icon = ICONS[l];
                  const on = editing.layout === l;
                  return (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLayout(l)}
                      className={`flex items-start gap-3 rounded-tl-xl rounded-br-xl border-2 p-3 text-left transition ${
                        on ? "border-primary bg-primary/10" : "border-base-300 hover:border-base-content/40"
                      }`}
                    >
                      <Icon size={20} className={on ? "text-primary" : "text-base-content/60"} />
                      <span>
                        <span className="block text-sm font-bold">{SCENE_LAYOUTS[l].label}</span>
                        <span className="block text-xs text-base-content/60">{SCENE_LAYOUTS[l].hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {editing.layout === "ranking" && (
                <Field label="Estilo da tabela">
                  <select className="select select-bordered select-sm" value={editing.board} onChange={(e) => set("board", e.target.value as SceneBoard)}>
                    {(Object.keys(SCENE_BOARDS) as SceneBoard[]).map((b) => (
                      <option key={b} value={b}>
                        {SCENE_BOARDS[b]}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {(editing.layout === "leaders" || editing.layout === "spotlight" || editing.layout === "camera") && (
                <Field label="Quantas equipes">
                  <Seg
                    value={editing.topN}
                    options={[3, 5, 8, 10].map((n) => ({ v: n as Scene["topN"], label: `Top ${n}` }))}
                    onChange={(v) => set("topN", v)}
                  />
                </Field>
              )}
              {editing.layout === "title" && (
                <>
                  <Field label="Título" hint="Vazio = nome do evento">
                    <input className="input input-bordered input-sm w-full" maxLength={60} value={editing.title} onChange={(e) => set("title", e.target.value)} />
                  </Field>
                  <Field label="Texto de apoio">
                    <input className="input input-bordered input-sm w-full" maxLength={140} value={editing.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
                  </Field>
                </>
              )}
              <Field label="Cronômetro">
                <Seg value={editing.showTimer} options={TOGGLE_OPTS} onChange={(v) => set("showTimer", v)} />
              </Field>
              <Field label="Letreiro de resultados">
                <Seg value={editing.showTicker} options={TOGGLE_OPTS} onChange={(v) => set("showTicker", v)} />
              </Field>
              <Field label="QR code de acesso">
                <Seg value={editing.showQr} options={TOGGLE_OPTS} onChange={(v) => set("showQr", v)} />
              </Field>
              <Field label="Cabeçalho" hint="Nome do evento, status e cronômetro no topo">
                <input type="checkbox" className="toggle toggle-primary" checked={editing.showHeader} onChange={(e) => set("showHeader", e.target.checked)} />
              </Field>
              {(editing.layout === "ranking" || editing.layout === "leaders") && (
                <Field label="Janela da câmera" hint="Usa a câmera configurada em Telão, se estiver ligada">
                  <Seg
                    value={editing.camera}
                    options={[
                      { v: "auto", label: "Se ligada" },
                      { v: "off", label: "Nunca" },
                    ]}
                    onChange={(v) => set("camera", v)}
                  />
                </Field>
              )}
            </div>
            <p className="text-xs text-base-content/55">A prévia mostra o rascunho. O telão só muda quando a cena for salva estando no ar, ou colocada no ar.</p>
          </div>
        </Panel>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      {hint && <p className="text-xs text-base-content/55">{hint}</p>}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function SceneCard({
  icon: Icon,
  name,
  hint,
  selected,
  onAir,
  onSelect,
  tools,
}: {
  icon: LucideIcon;
  name: string;
  hint: string;
  selected: boolean;
  onAir: boolean;
  onSelect: () => void;
  tools?: React.ReactNode;
}) {
  return (
    <div
      className={`relative flex min-h-32 flex-col rounded-tl-xl rounded-br-xl border-2 p-3 transition ${
        onAir ? "border-error" : selected ? "border-warning" : "border-base-300 hover:border-base-content/40"
      } ${selected ? "bg-warning/10" : "bg-base-100"}`}
    >
      <button type="button" onClick={onSelect} className="flex flex-1 flex-col items-start text-left" aria-pressed={selected}>
        <div className="flex w-full items-center gap-2">
          <Icon size={18} className="text-base-content/70" />
          {onAir && (
            <Tag className="border-error/50 bg-error text-error-content">
              <span className="live-dot" /> NO AR
            </Tag>
          )}
          {selected && !onAir && <Tag className="border-warning/50 bg-warning/30">PRÉVIA</Tag>}
        </div>
        <p className="mt-2 line-clamp-1 font-bold">{name}</p>
        <p className="line-clamp-2 text-xs text-base-content/60">{hint}</p>
      </button>
      {tools && <div className="mt-2 flex gap-0.5 border-t border-base-300 pt-1.5">{tools}</div>}
    </div>
  );
}
