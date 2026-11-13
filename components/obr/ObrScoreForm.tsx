"use client";

import { useEffect, useState } from "react";
import { Flag, Minus, Plus, Sparkles, TimerReset } from "lucide-react";
import { checkpointRate, HAZARDS, MAX_MORTAS, MAX_VIVAS, scoreObr, type ObrArena, type ObrResponses } from "@/lib/obr";
import { formatSeconds } from "@/lib/format";

/**
 * Súmula da OBR Resgate para a mesa. Tudo é limitado pelo modelo de arena
 * da rodada: a mesa só marca perigos que existem e os checkpoints já vêm
 * com o número de ladrilhos de cada seção.
 */
export function ObrScoreForm({
  arena,
  value,
  onChange,
}: {
  arena: ObrArena;
  value: ObrResponses;
  onChange: (next: ObrResponses) => void;
}) {
  const set = (p: Partial<ObrResponses>) => onChange({ ...value, ...p });
  const b = scoreObr(arena, value);
  const maxInv = MAX_VIVAS + MAX_MORTAS - value.vivas - value.mortas;

  return (
    <div className="space-y-4">
      <Card title={`${arena.name} · Perigos do trajeto`} right={`${b.hazards} pts`}>
        {arena.description && <p className="mb-3 text-sm text-base-content/60">{arena.description}</p>}
        <ul className="divide-y divide-base-300">
          {HAZARDS.filter((h) => (arena.hazards[h.key] ?? 0) > 0).map((h) => (
            <li key={h.key} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{h.label}</p>
                <p className="font-mono text-xs text-base-content/55">
                  {h.points} pts · na arena: {arena.hazards[h.key]}
                </p>
              </div>
              <Stepper
                value={value.hazards[h.key] ?? 0}
                max={arena.hazards[h.key]}
                onChange={(v) => set({ hazards: { ...value.hazards, [h.key]: v } })}
              />
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Checkpoints" right={`${b.checkpoints} pts`}>
        <p className="mb-3 text-xs text-base-content/55">Em que tentativa o robô superou cada seção (1ª: 5 pts/ladrilho · 2ª: 3 · 3ª: 1).</p>
        <ol className="space-y-3">
          {arena.sections.map((tiles, i) => (
            <li key={i}>
              <p className="text-sm font-medium">
                Seção {i + 1} <span className="font-mono text-xs text-base-content/55">· {tiles} ladrilhos</span>
              </p>
              <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup">
                {[0, 1, 2, 3, 4].map((att) => {
                  const active = (value.sections[i] ?? 0) === att;
                  return (
                    <button
                      key={att}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => set({ sections: value.sections.map((x, k) => (k === i ? att : x)) })}
                      className={btn(active)}
                    >
                      {att === 0 ? "Não" : att === 4 ? "4ª+" : `${att}ª`}
                      {att > 0 && <span className="font-mono text-xs opacity-60">{tiles * checkpointRate(att)}</span>}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Card title="Chegada" right={`${b.chegada + b.start} pts`}>
        <div className="flex flex-wrap items-center gap-2">
          {[false, true].map((v) => (
            <button key={String(v)} type="button" className={btn(value.chegada === v)} onClick={() => set({ chegada: v })}>
              {v ? "Chegou à sala de resgate" : "Não chegou"}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Falhas de progresso</p>
            <p className="font-mono text-xs text-base-content/55">−5 pts cada na chegada</p>
          </div>
          <Stepper value={value.falhas} max={30} onChange={(v) => set({ falhas: v })} />
        </div>
        {arena.startTile && <p className="mt-2 text-xs text-base-content/55">Ladrilho de saída: +5 pts.</p>}
      </Card>

      <Card title="Sala de resgate" right={b.multiplier > 1 ? `×${b.multiplier.toFixed(3).replace(/0+$/, "").replace(".", ",")}` : "×1"}>
        <Row label="Vítimas vivas na área verde" hint="×1,3 cada · máx. 2">
          <Stepper value={value.vivas} max={MAX_VIVAS} onChange={(v) => set({ vivas: v, invertidas: Math.min(value.invertidas, MAX_VIVAS + MAX_MORTAS - v - value.mortas) })} />
        </Row>
        <Row label="Vítima morta na área vermelha" hint="×1,3 · máx. 1">
          <Stepper value={value.mortas} max={MAX_MORTAS} onChange={(v) => set({ mortas: v, invertidas: Math.min(value.invertidas, MAX_VIVAS + MAX_MORTAS - value.vivas - v) })} />
        </Row>
        <Row label="Vítimas na área trocada" hint="×1,1 cada">
          <Stepper value={value.invertidas} max={Math.max(0, maxInv)} onChange={(v) => set({ invertidas: v })} />
        </Row>
        {arena.surpriseEnabled && (
          <div className="mt-3 rounded-tl-xl rounded-br-xl border border-accent/50 bg-accent/10 p-3">
            <label className="flex cursor-pointer items-center gap-3">
              <input type="checkbox" className="checkbox" checked={value.surpresa} onChange={(e) => set({ surpresa: e.target.checked })} />
              <span>
                <span className="flex items-center gap-1.5 text-sm font-bold">
                  <Sparkles size={14} /> Desafio Surpresa cumprido (×1,5)
                </span>
                {arena.surpriseText && <span className="mt-0.5 block text-xs text-base-content/65">{arena.surpriseText}</span>}
              </span>
            </label>
          </div>
        )}
      </Card>

      <Card title="Tempo (desempate)" right={formatSeconds(b.tempo, 0)}>
        <TimeField value={value.tempo} disabled={!value.chegada || value.desistiu} onChange={(t) => set({ tempo: t })} />
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="checkbox checkbox-sm" checked={value.desistiu} onChange={(e) => set({ desistiu: e.target.checked })} />
          <Flag size={14} /> Equipe desistiu (vale o tempo máximo, 5:00)
        </label>
        {!value.chegada && <p className="mt-2 text-xs text-base-content/55">Sem chegada, o tempo considerado é o máximo (5:00).</p>}
      </Card>
    </div>
  );
}

const btn = (active: boolean) =>
  `btn h-11 gap-1.5 rounded-tl-lg rounded-br-lg rounded-tr-none rounded-bl-none ${
    active ? "btn-primary shadow-[3px_3px_0_0_var(--color-base-content)]" : "btn-outline border-base-300 font-normal"
  }`;

function Card({ title, right, children }: { title: string; right?: string; children: React.ReactNode }) {
  return (
    <article className="rounded-tl-2xl rounded-br-2xl border border-base-300 bg-base-100">
      <header className="flex items-center justify-between gap-3 border-b border-base-300 px-4 py-3">
        <h3 className="text-sm font-bold sm:text-base">{title}</h3>
        {right && <span className="font-mono text-sm font-bold text-primary">{right}</span>}
      </header>
      <div className="p-4">{children}</div>
    </article>
  );
}

function Row({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="font-mono text-xs text-base-content/55">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function Stepper({ value, max, onChange }: { value: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="join">
      <button type="button" className="btn join-item btn-square" disabled={value <= 0} onClick={() => onChange(value - 1)} aria-label="Menos">
        <Minus size={16} />
      </button>
      <span className="join-item grid w-14 place-items-center border-y border-base-300 bg-base-100 font-mono text-lg font-bold">{value}</span>
      <button type="button" className="btn join-item btn-square" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="Mais">
        <Plus size={16} />
      </button>
    </div>
  );
}

function TimeField({ value, disabled, onChange }: { value: number | null; disabled: boolean; onChange: (v: number | null) => void }) {
  const [text, setText] = useState(value === null ? "" : formatSeconds(value, 0));
  const [start, setStart] = useState<number | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    if (start === null) return;
    const id = setInterval(() => tick((n) => n + 1), 200);
    return () => clearInterval(id);
  }, [start]);
  useEffect(() => {
    if (value === null && start === null) setText("");
  }, [value, start]);
  const parse = (t: string) => {
    const m = t.trim().match(/^(?:(\d+):)?(\d+(?:[.,]\d+)?)$/);
    return m ? Number(m[1] ?? 0) * 60 + Number(m[2].replace(",", ".")) : null;
  };
  const running = start !== null ? (performance.now() - start) / 1000 : null;
  return (
    <div className={`flex flex-wrap items-center gap-2 ${disabled ? "pointer-events-none opacity-40" : ""}`}>
      <input
        value={running !== null ? formatSeconds(running, 0) : text}
        readOnly={running !== null}
        inputMode="decimal"
        placeholder="m:ss"
        onChange={(e) => {
          setText(e.target.value);
          onChange(parse(e.target.value));
        }}
        className="input input-bordered input-lg w-36 font-mono text-2xl font-bold tabular-nums"
      />
      {start === null ? (
        <button type="button" className={btn(false)} onClick={() => setStart(performance.now())}>
          <TimerReset size={16} /> Cronometrar
        </button>
      ) : (
        <button
          type="button"
          className={btn(true)}
          onClick={() => {
            const sec = Math.round((performance.now() - start) / 1000);
            setStart(null);
            setText(formatSeconds(sec, 0));
            onChange(sec);
          }}
        >
          Parar
        </button>
      )}
    </div>
  );
}
