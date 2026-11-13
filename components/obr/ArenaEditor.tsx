"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Copy, Map as MapIcon, Minus, Plus, Save, Sparkles, Trash2, Trophy } from "lucide-react";
import { deleteExtraChallenge, saveArenas } from "@/app/actions/challenges";
import { cornerBtn, EmptyState, Panel } from "@/components/ui/brand";
import { useConfirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import { CHALLENGE_TYPES } from "@/lib/challenge";
import { arenaMaxScore, HAZARDS, type ObrArena, type ObrLeague } from "@/lib/obr";

/**
 * Os 3 modelos de arena da competição. Cada rodada usa uma arena; a mesa só
 * consegue marcar o que existe nela.
 */
export function ArenaEditor({ eventId, league, scored }: { eventId: string; league: ObrLeague; scored: number }) {
  const [arenas, setArenas] = useState<ObrArena[]>(league.arenas);
  const [saved, setSaved] = useState(JSON.stringify(league.arenas));
  const [tab, setTab] = useState(0);
  const [pending, start] = useTransition();
  const { addToast } = useToast();
  const confirm = useConfirm();
  const dirty = JSON.stringify(arenas) !== saved;
  const a = arenas[tab];
  const patch = (p: Partial<ObrArena>) => setArenas((list) => list.map((x, i) => (i === tab ? { ...x, ...p } : x)));

  const save = async () => {
    if (scored > 0) {
      const ok = await confirm({
        title: "Já existem notas lançadas",
        message: "As notas já lançadas não são recalculadas. As mudanças nas arenas valem para as próximas rodadas.",
        confirmLabel: "Salvar mesmo assim",
      });
      if (ok === false) return;
    }
    start(async () => {
      const r = await saveArenas(eventId, arenas);
      if (!r.ok) return addToast(r.error, "error");
      setSaved(JSON.stringify(arenas));
      addToast("Arenas salvas. A mesa já usa os novos limites.", "success");
    });
  };

  return (
    <div className="space-y-6">
      <Panel
        kicker="/ OBR RESGATE · 3 RODADAS, 3 ARENAS"
        title="Modelos de arena"
        action={
          <button type="button" onClick={save} disabled={!dirty || pending} className={`btn btn-sm btn-primary ${cornerBtn}`}>
            {pending ? <span className="loading loading-spinner loading-xs" /> : <Save size={14} />} Salvar arenas
          </button>
        }
      >
        <p className="mb-4 text-sm text-base-content/65">
          Monte as arenas que serão usadas na competição. A <b>Rodada 1</b> usa a primeira, a <b>Rodada 2</b> a segunda e a <b>Rodada 3</b> a
          terceira. Classificação oficial: soma das 2 maiores notas; desempate pela menor soma de tempos.
        </p>
        <div role="tablist" className="grid gap-2 sm:grid-cols-3">
          {arenas.map((x, i) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={tab === i}
              onClick={() => setTab(i)}
              className={`rounded-tl-xl rounded-br-xl border-2 p-3 text-left transition ${
                tab === i ? "border-base-content shadow-[4px_4px_0_0_var(--color-primary)]" : "border-base-300 hover:border-base-content/30"
              }`}
            >
              <span className="font-mono text-[10px] font-bold tracking-[0.15em] text-base-content/50">RODADA {i + 1}</span>
              <span className="block font-bold">{x.name}</span>
              <span className="text-xs text-base-content/55">
                {x.sections.length} seções · máx. {arenaMaxScore(x)} pts
              </span>
            </button>
          ))}
        </div>
      </Panel>

      {a && (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <Panel kicker={`/ ARENA ${tab + 1}`} title="Identificação" action={<MapIcon size={16} className="text-base-content/40" />}>
            <label className="block">
              <span className="text-sm font-medium">Nome</span>
              <input value={a.name} maxLength={40} onChange={(e) => patch({ name: e.target.value })} className="input input-bordered mt-1 w-full font-bold" />
            </label>
            <label className="mt-4 block">
              <span className="text-sm font-medium">Descrição para a mesa (opcional)</span>
              <textarea
                value={a.description ?? ""}
                maxLength={300}
                rows={2}
                onChange={(e) => patch({ description: e.target.value || undefined })}
                placeholder="Ex.: rampa logo após a saída, gangorra antes da sala de resgate."
                className="textarea textarea-bordered mt-1 w-full"
              />
            </label>
            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="checkbox checkbox-sm" checked={a.startTile} onChange={(e) => patch({ startTile: e.target.checked })} />
              Ladrilho de saída pontua (+5)
            </label>
            <div className="mt-5 rounded-tl-xl rounded-br-xl border border-accent/50 bg-accent/10 p-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
                <input type="checkbox" className="checkbox checkbox-sm" checked={a.surpriseEnabled} onChange={(e) => patch({ surpriseEnabled: e.target.checked })} />
                <Sparkles size={14} /> Desafio Surpresa nesta arena (×1,5)
              </label>
              {a.surpriseEnabled && (
                <textarea
                  value={a.surpriseText ?? ""}
                  maxLength={400}
                  rows={2}
                  onChange={(e) => patch({ surpriseText: e.target.value || undefined })}
                  placeholder="Descreva o desafio sorteado (aparece para a mesa)."
                  className="textarea textarea-bordered textarea-sm mt-2 w-full"
                />
              )}
              <p className="mt-2 text-xs text-base-content/60">No manual oficial, o Desafio Surpresa é da etapa estadual, nas rodadas 2 e 3.</p>
            </div>
          </Panel>

          <Panel kicker="/ PERIGOS" title="O que existe no trajeto">
            <ul className="divide-y divide-base-300">
              {HAZARDS.map((h) => (
                <li key={h.key} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{h.label}</p>
                    <p className="font-mono text-xs text-base-content/55">{h.points} pts cada</p>
                  </div>
                  <Stepper value={a.hazards[h.key] ?? 0} max={40} onChange={(v) => patch({ hazards: { ...a.hazards, [h.key]: v } })} />
                </li>
              ))}
            </ul>
          </Panel>

          <Panel
            kicker="/ CHECKPOINTS"
            title="Seções entre checkpoints"
            action={
              <button type="button" className="btn btn-ghost btn-xs" disabled={a.sections.length >= 12} onClick={() => patch({ sections: [...a.sections, 5] })}>
                <Plus size={13} /> Seção
              </button>
            }
            className="xl:col-span-2"
          >
            <p className="mb-3 text-sm text-base-content/60">
              Ladrilhos de cada trecho, na ordem do percurso. Superado na 1ª tentativa vale 5 pts por ladrilho; na 2ª, 3; na 3ª, 1.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              {a.sections.map((tiles, i) => (
                <div key={i} className="rounded-tl-xl rounded-br-xl border border-base-300 bg-base-200/50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] font-bold tracking-wider text-base-content/55">SEÇÃO {i + 1}</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs btn-square text-error"
                      disabled={a.sections.length <= 1}
                      onClick={() => patch({ sections: a.sections.filter((_, k) => k !== i) })}
                      aria-label={`Remover seção ${i + 1}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <Stepper value={tiles} min={1} max={40} onChange={(v) => patch({ sections: a.sections.map((x, k) => (k === i ? v : x)) })} />
                  <p className="mt-1 text-center text-xs text-base-content/50">ladrilhos · até {tiles * 5} pts</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-dashed border-base-300 pt-4 text-sm">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Trophy size={15} className="text-primary" /> Pontuação máxima desta arena: <b className="font-mono">{arenaMaxScore(a)} pts</b>
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-xs ml-auto"
                onClick={() => {
                  const other = arenas[(tab + 1) % 3];
                  patch({ hazards: { ...other.hazards }, sections: [...other.sections] });
                }}
              >
                <Copy size={12} /> Copiar perigos/seções da {arenas[(tab + 1) % 3].name}
              </button>
            </div>
          </Panel>
        </div>
      )}

      <Extras eventId={eventId} league={league} />
    </div>
  );
}

function Extras({ eventId, league }: { eventId: string; league: ObrLeague }) {
  const [pending, start] = useTransition();
  const { addToast } = useToast();
  const confirm = useConfirm();
  return (
    <Panel
      kicker={`/ OPCIONAL · ${league.extras.length} DESAFIOS EXTRAS`}
      title="Desafios extras"
      action={
        <Link href={`/hub/${eventId}/arenas/extra/novo`} className={`btn btn-xs btn-primary ${cornerBtn}`}>
          <Plus size={13} /> Desafio extra
        </Link>
      }
    >
      <p className="mb-4 text-sm text-base-content/65">
        Provas a mais (ex.: corrida de velocidade, apresentação, desafio de programação). Cada uma vira uma rodada &quot;extra&quot; com ranking
        próprio no telão e <b>não entra</b> na classificação geral da OBR.
      </p>
      {league.extras.length === 0 ? (
        <EmptyState icon={<Sparkles size={22} />} title="Nenhum desafio extra" text="Use o construtor de desafios para criar o tipo, objetivo, regras e pontuação." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {league.extras.map((x) => (
            <li key={x.id} className="flex items-start gap-3 rounded-tl-xl rounded-br-xl border border-base-300 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-tl-lg rounded-br-lg bg-secondary/10 text-secondary">
                <Sparkles size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <Link href={`/hub/${eventId}/arenas/extra/${x.id}`} className="block truncate font-bold hover:underline">
                  {x.name}
                </Link>
                <p className="text-xs text-base-content/55">
                  {CHALLENGE_TYPES[x.type].label} · {x.items.length} itens · {x.scoring.direction === "lower" ? "menor vence" : "maior vence"}
                </p>
                {x.objective && <p className="mt-1 line-clamp-2 text-sm text-base-content/65">{x.objective}</p>}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-square text-error"
                disabled={pending}
                aria-label={`Remover ${x.name}`}
                onClick={async () => {
                  const ok = await confirm({
                    title: `Remover “${x.name}”?`,
                    message: "A rodada extra e as notas dela serão apagadas.",
                    confirmLabel: "Remover",
                    danger: true,
                  });
                  if (ok === false) return;
                  start(async () => {
                    const r = await deleteExtraChallenge(eventId, x.id);
                    if (!r.ok) addToast(r.error, "error");
                  });
                }}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Stepper({ value, min = 0, max, onChange }: { value: number; min?: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="join">
      <button type="button" className="btn join-item btn-sm btn-square" disabled={value <= min} onClick={() => onChange(value - 1)} aria-label="Menos">
        <Minus size={14} />
      </button>
      <span className="join-item grid w-11 place-items-center border-y border-base-300 bg-base-100 font-mono font-bold">{value}</span>
      <button type="button" className="btn join-item btn-sm btn-square" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="Mais">
        <Plus size={14} />
      </button>
    </div>
  );
}
