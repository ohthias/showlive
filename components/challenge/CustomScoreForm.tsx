"use client";

import { useEffect, useState } from "react";
import { Flag, Minus, Plus, TimerReset } from "lucide-react";
import { itemRange, itemValue, type Challenge, type ChallengeItem, type CustomResponses } from "@/lib/challenge";
import { formatSeconds, formatValue } from "@/lib/format";
import { MissionImage } from "@/components/mesa/MissionImage";

/**
 * Súmula de um desafio personalizado. Cada tipo de item vira um controle
 * grande, pensado para toque rápido na mesa.
 */
export function CustomScoreForm({
  challenge,
  responses,
  onChange,
  showImages = true,
}: {
  challenge: Challenge;
  responses: CustomResponses;
  onChange: (next: CustomResponses) => void;
  showImages?: boolean;
}) {
  const set = (key: string, value: number | undefined) => {
    const next = { ...responses };
    if (value === undefined) delete next[key];
    else next[key] = value;
    onChange(next);
  };
  const dnf = responses.dnf === 1;
  const lower = challenge.scoring.direction === "lower";
  const f = challenge.scoring;

  return (
    <div className="space-y-4">
      {challenge.items.map((item, i) => {
        const showGroup = item.group && item.group !== challenge.items[i - 1]?.group;
        const answered = responses[item.id] !== undefined;
        const contrib = itemValue(item, responses[item.id]);
        const disabled = dnf && item.kind === "time";
        return (
          <div key={item.id}>
          {showGroup && (
            <div className="mb-3 mt-6 space-y-2 first:mt-0">
              <p className="kicker">/ {item.group}</p>
              {showImages && item.image && <MissionImage src={item.image} alt={item.group!} />}
            </div>
          )}
          <article
            className={`rounded-tl-2xl rounded-br-2xl border bg-base-100 ${answered ? "border-base-content/25" : "border-base-300"}`}
          >
            <header className="flex items-center gap-3 border-b border-base-300 px-4 py-3">
              <span
                className={`grid h-9 min-w-9 place-items-center rounded-tl-lg rounded-br-lg px-2 font-mono text-sm font-bold ${
                  answered ? "bg-base-content text-base-100" : "bg-base-200"
                }`}
              >
                {i + 1}
              </span>
              <h3 className="flex-1 text-sm font-bold sm:text-base">
                {item.label}
                {item.required && <span className="ml-1 text-error">*</span>}
              </h3>
              {item.kind !== "time" && answered && contrib !== 0 && (
                <span className="font-mono text-sm font-bold text-primary">
                  {lower ? "−" : "+"}
                  {formatValue(Math.abs(contrib), f)}
                </span>
              )}
            </header>
            <div className="p-4">
              {item.description && <p className="mb-3 text-sm text-base-content/60">{item.description}</p>}
              <ItemInput item={item} value={responses[item.id]} disabled={disabled} onChange={(v) => set(item.id, v)} />
              {item.kind === "time" && challenge.scoring.timeLimitSec && (
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={dnf}
                    onChange={(e) => set("dnf", e.target.checked ? 1 : undefined)}
                  />
                  <Flag size={14} /> Não completou — usa o tempo limite ({formatSeconds(challenge.scoring.timeLimitSec, 0)})
                </label>
              )}
            </div>
          </article>
          </div>
        );
      })}

      {challenge.penalties.length > 0 && (
        <article className="rounded-tl-2xl rounded-br-2xl border border-error/30 bg-error/5">
          <header className="border-b border-error/20 px-4 py-3">
            <h3 className="text-sm font-bold">Penalidades</h3>
          </header>
          <ul className="divide-y divide-error/15">
            {challenge.penalties.map((p) => {
              const n = responses[`pen:${p.id}`] ?? 0;
              return (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{p.label}</p>
                    <p className="font-mono text-xs text-base-content/55">
                      {p.table?.length
                        ? p.table
                            .filter((t) => t.count > 0)
                            .map((t) => `${t.count}: ${t.zeroesTotal ? "zera" : `−${t.points}`}`)
                            .join(" · ")
                        : `${lower ? "+" : "−"}${formatValue(p.points, f)} ${f.unit} cada · máx. ${p.max}`}
                    </p>
                  </div>
                  <Stepper value={n} min={0} max={p.max} onChange={(v) => set(`pen:${p.id}`, v || undefined)} />
                </li>
              );
            })}
          </ul>
        </article>
      )}
    </div>
  );
}

function ItemInput({
  item,
  value,
  disabled,
  onChange,
}: {
  item: ChallengeItem;
  value: number | undefined;
  disabled?: boolean;
  onChange: (v: number | undefined) => void;
}) {
  const btn = (active: boolean) =>
    `btn h-12 min-w-14 rounded-tl-lg rounded-br-lg rounded-tr-none rounded-bl-none text-base ${
      active ? "btn-primary shadow-[3px_3px_0_0_var(--color-base-content)]" : "btn-outline border-base-300 font-normal"
    }`;
  const toggle = (v: number) => onChange(value === v ? undefined : v);

  switch (item.kind) {
    case "check":
      return (
        <div className="flex gap-2" role="radiogroup">
          {["Não", "Sim"].map((l, i) => (
            <button key={l} type="button" role="radio" aria-checked={value === i} className={btn(value === i)} onClick={() => toggle(i)}>
              {l}
            </button>
          ))}
          <span className="ml-auto self-center font-mono text-xs text-base-content/50">{item.points} se Sim</span>
        </div>
      );
    case "choice":
      return (
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {(item.options ?? []).map((o, i) => (
            <button key={i} type="button" role="radio" aria-checked={value === i} className={btn(value === i)} onClick={() => toggle(i)}>
              {o.label} <span className="font-mono text-xs opacity-60">{o.points}</span>
            </button>
          ))}
        </div>
      );
    case "scale": {
      const { min, max } = itemRange(item);
      return (
        <div className="flex flex-wrap items-center gap-2" role="radiogroup">
          {Array.from({ length: max - min + 1 }, (_, k) => min + k).map((n) => (
            <button key={n} type="button" role="radio" aria-checked={value === n} className={btn(value === n)} onClick={() => toggle(n)}>
              {n}
            </button>
          ))}
          {item.points !== 1 && <span className="ml-auto font-mono text-xs text-base-content/50">peso ×{item.points}</span>}
        </div>
      );
    }
    case "count": {
      const { max } = itemRange(item);
      if (max <= 10)
        return (
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {Array.from({ length: max + 1 }, (_, n) => (
              <button key={n} type="button" role="radio" aria-checked={value === n} className={btn(value === n)} onClick={() => toggle(n)}>
                {n}
              </button>
            ))}
            <span className="ml-auto self-center font-mono text-xs text-base-content/50">{item.points} cada</span>
          </div>
        );
      return <Stepper value={value ?? 0} min={0} max={max} onChange={onChange} />;
    }
    case "number":
      return <NumberInput value={value} min={item.min} max={item.max} onChange={onChange} suffix={item.points !== 1 ? `×${item.points}` : undefined} />;
    case "time":
      return <TimeInput value={value} disabled={disabled} onChange={onChange} />;
  }
}

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="join">
      <button type="button" className="btn join-item btn-square" disabled={value <= min} onClick={() => onChange(value - 1)} aria-label="Menos">
        <Minus size={16} />
      </button>
      <span className="join-item grid w-14 place-items-center border-y border-base-300 bg-base-100 font-mono text-lg font-bold">{value}</span>
      <button type="button" className="btn join-item btn-square" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="Mais">
        <Plus size={16} />
      </button>
    </div>
  );
}

function NumberInput({
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  value: number | undefined;
  min?: number;
  max?: number;
  suffix?: string;
  onChange: (v: number | undefined) => void;
}) {
  const [text, setText] = useState(value === undefined ? "" : String(value).replace(".", ","));
  useEffect(() => {
    if (value === undefined) setText("");
  }, [value]);
  return (
    <div className="flex items-center gap-3">
      <input
        inputMode="decimal"
        value={text}
        placeholder="0"
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d.,]/g, "");
          setText(t);
          const n = Number(t.replace(",", "."));
          onChange(t === "" || !Number.isFinite(n) ? undefined : n);
        }}
        className="input input-bordered input-lg w-48 font-mono text-2xl font-bold"
      />
      <span className="text-xs text-base-content/55">
        {min !== undefined && max !== undefined && `${min} a ${max}`} {suffix}
      </span>
    </div>
  );
}

/** Tempo: digitado (m:ss.cc) ou cronometrado na hora pela mesa. */
function TimeInput({ value, disabled, onChange }: { value: number | undefined; disabled?: boolean; onChange: (v: number | undefined) => void }) {
  const [text, setText] = useState(value === undefined ? "" : formatSeconds(value));
  const [running, setRunning] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (running === null) return;
    const id = setInterval(() => setNow(performance.now()), 37);
    return () => clearInterval(id);
  }, [running]);
  useEffect(() => {
    if (value === undefined && running === null) setText("");
  }, [value, running]);

  const parse = (t: string) => {
    const m = t.trim().match(/^(?:(\d+):)?(\d+(?:[.,]\d+)?)$/);
    if (!m) return undefined;
    return (Number(m[1] ?? 0) * 60 + Number(m[2].replace(",", "."))) || undefined;
  };

  const elapsed = running !== null ? (now - running) / 1000 : null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${disabled ? "pointer-events-none opacity-40" : ""}`}>
      <input
        inputMode="decimal"
        placeholder="m:ss.cc"
        value={elapsed !== null ? formatSeconds(Math.max(0, elapsed)) : text}
        readOnly={elapsed !== null}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parse(e.target.value));
        }}
        className="input input-bordered input-lg w-44 font-mono text-2xl font-bold tabular-nums"
      />
      {running === null ? (
        <button
          type="button"
          className="btn btn-lg btn-secondary rounded-tl-lg rounded-br-lg rounded-tr-none rounded-bl-none"
          onClick={() => {
            const t = performance.now();
            setRunning(t);
            setNow(t);
          }}
        >
          <TimerReset size={18} /> Cronometrar
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-lg btn-primary rounded-tl-lg rounded-br-lg rounded-tr-none rounded-bl-none"
          onClick={() => {
            const sec = Math.round(((performance.now() - running) / 1000) * 100) / 100;
            setRunning(null);
            setText(formatSeconds(sec));
            onChange(sec);
          }}
        >
          Parar
        </button>
      )}
    </div>
  );
}
