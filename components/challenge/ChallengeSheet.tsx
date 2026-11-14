import { bestPossible, CHALLENGE_TYPES, ITEM_KINDS, type Challenge, type ChallengeItem } from "@/lib/challenge";
import { formatSeconds, formatValue } from "@/lib/format";

/** Regulamento do desafio, pronto para imprimir ou mandar para as equipes. */
export function ChallengeSheet({ challenge: ch, eventName }: { challenge: Challenge; eventName?: string }) {
  const meta = CHALLENGE_TYPES[ch.type];
  const f = ch.scoring;
  const lower = f.direction === "lower";
  const best = bestPossible(ch);

  const scoreText = (i: ChallengeItem) => {
    switch (i.kind) {
      case "check":
        return `${formatValue(i.points ?? 0, f)} ${f.unit}`;
      case "count":
        return `${formatValue(i.points ?? 0, f)} ${f.unit} cada (máx. ${i.max})`;
      case "choice":
        return (i.options ?? []).map((o) => `${o.label}: ${formatValue(o.points, f)}`).join(" · ");
      case "scale":
        return `Nota ${i.min}–${i.max}${i.points !== 1 ? ` × peso ${i.points}` : ""}`;
      case "number":
        return `Valor medido${i.points !== 1 ? ` × ${i.points}` : ""} (${i.min}–${i.max})`;
      case "time":
        return "Tempo cronometrado";
    }
  };

  return (
    <article className="challenge-sheet mx-auto max-w-3xl rounded-tl-3xl rounded-br-3xl border border-base-300 bg-base-100 p-8 print:border-0 print:p-0 sm:p-10">
      <header className="border-b-2 border-base-content pb-6">
        <p className="font-mono text-xs font-bold tracking-[0.2em] text-base-content/55">
          {eventName ? `${eventName.toUpperCase()} · ` : ""}REGULAMENTO DO DESAFIO
        </p>
        <h1 className="mt-2 text-4xl font-black tracking-tight">{ch.name || "Desafio sem nome"}</h1>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-tl-md rounded-br-md bg-primary px-2 py-1 font-bold text-primary-content">{meta.label}</span>
          <span className="rounded-tl-md rounded-br-md border border-base-300 px-2 py-1">
            {lower ? "Menor resultado vence" : "Maior resultado vence"} · unidade: {f.unit}
          </span>
          {f.timeLimitSec ? (
            <span className="rounded-tl-md rounded-br-md border border-base-300 px-2 py-1">Tempo por tentativa: {formatSeconds(f.timeLimitSec, 0)}</span>
          ) : null}
        </div>
      </header>

      {ch.objective && (
        <section className="mt-6">
          <h2 className="kicker">/ Objetivo</h2>
          <p className="mt-2 text-lg leading-relaxed">{ch.objective}</p>
        </section>
      )}

      {ch.rules.length > 0 && (
        <section className="mt-8">
          <h2 className="kicker">/ Regras de funcionamento</h2>
          <ol className="mt-3 space-y-2">
            {ch.rules.map((r, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-relaxed">
                <span className="font-mono font-bold text-primary">{String(i + 1).padStart(2, "0")}</span>
                {r}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="mt-8">
        <h2 className="kicker">/ Pontuação</h2>
        <table className="table table-sm mt-3">
          <thead>
            <tr>
              <th>Item</th>
              <th>Tipo</th>
              <th className="text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {ch.items.map((i) => (
              <tr key={i.id}>
                <td>
                  {i.group && <span className="block font-mono text-[10px] tracking-wider text-base-content/45">{i.group}</span>}
                  <span className="font-medium">{i.label}</span>
                  {i.required && <span className="text-error"> *</span>}
                  {i.description && <p className="text-xs text-base-content/55">{i.description}</p>}
                </td>
                <td className="text-xs text-base-content/60">{ITEM_KINDS[i.kind].label}</td>
                <td className="text-right font-mono text-xs">
                  {lower && i.kind !== "time" ? "− " : ""}
                  {scoreText(i)}
                </td>
              </tr>
            ))}
            {ch.penalties.map((p) => (
              <tr key={p.id} className="text-error">
                <td className="font-medium">{p.label}</td>
                <td className="text-xs">Penalidade</td>
                <td className="text-right font-mono text-xs">
                  {p.table?.length
                    ? p.table
                        .filter((t) => t.count > 0)
                        .map((t) => `${t.count}: ${t.zeroesTotal ? "zera a partida" : `−${t.points}`}`)
                        .join(" · ")
                    : `${lower ? "+" : "−"}${formatValue(p.points, f)} ${f.unit} cada (máx. ${p.max})`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-base-content/55">
          {lower
            ? "Resultado = tempo + penalidades − bônus."
            : `Resultado = soma dos itens − penalidades${best !== null ? ` (máximo teórico: ${formatValue(best, f)} ${f.unit})` : ""}.`}
          {f.floorAtZero && " O resultado nunca fica abaixo de zero."} Itens com * são obrigatórios na súmula. Classificação pela melhor
          tentativa entre as rodadas; empate desfeito pela segunda e depois pela terceira melhor.
        </p>
      </section>

      <footer className="mt-10 border-t border-base-300 pt-4 font-mono text-[10px] tracking-[0.15em] text-base-content/45">
        GERADO NO SHOWLIVE · ROBOSTAGE
      </footer>
    </article>
  );
}
