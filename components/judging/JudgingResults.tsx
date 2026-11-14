"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, Download, FileText, Lock, LockOpen, Medal, Trophy } from "lucide-react";
import { setJudgingSettings } from "@/app/actions/judging";
import { EmptyState, Panel } from "@/components/ui/brand";
import { useToast } from "@/components/ui/Toast";
import type { OverallRow, RubricRankingRow } from "@/lib/rubric";
import { pct } from "./shared";

type Rubric = { id: string; name: string; weight: number };
type Settings = { locked: boolean; includeRobotGame: boolean; robotGameWeight: number };

export function JudgingResults({
  eventId,
  settings,
  rubrics,
  overall,
  perRubric,
  pending,
  robotUnit,
  teamsWithoutSession,
}: {
  eventId: string;
  settings: Settings;
  rubrics: Rubric[];
  overall: OverallRow[];
  perRubric: Record<string, RubricRankingRow[]>;
  pending: { sessionId: string; teamName: string; roomName: string; missing: string[] }[];
  robotUnit: string;
  teamsWithoutSession: string[];
}) {
  const [tab, setTab] = useState<string>("overall");
  const [opt, setOpt] = useOptimistic(settings);
  const [weight, setWeight] = useState(settings.robotGameWeight);
  const [busy, start] = useTransition();
  const { addToast } = useToast();
  const rubricName = new Map(rubrics.map((r) => [r.id, r.name]));

  const update = (patch: Partial<Settings>) =>
    start(async () => {
      setOpt({ ...opt, ...patch });
      const r = await setJudgingSettings(eventId, patch);
      if (!r.ok) addToast(r.error, "error");
    });

  const exportCsv = () => {
    const esc = (v: string | number | null) => {
      const s = v === null ? "" : String(v);
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = ["Posição", "Número", "Equipe", ...rubrics.map((r) => `${r.name} (%)`), ...(opt.includeRobotGame ? ["Partida (%)"] : []), "Geral (%)", "Completa"];
    const lines = overall.map((r) => [
      r.rank,
      r.team.number,
      r.team.name,
      ...rubrics.map((x) => r.byRubric[x.id]),
      ...(opt.includeRobotGame ? [r.robotGame] : []),
      r.overall,
      r.complete ? "sim" : "não",
    ]);
    // ; e BOM: abre direto no Excel em português.
    const csv = "﻿" + [head, ...lines].map((l) => l.map((v) => esc(v as string | number | null)).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "avaliacao-rubricas.csv" });
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!rubrics.length) {
    return <EmptyState icon={<Trophy size={22} />} title="Sem rubricas" text="Crie as rubricas e avalie as equipes para ver os resultados aqui." />;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-base-content/60">
        Resultados confidenciais: só admins veem esta tela. Nada da avaliação por rubricas vai para o telão. Só fichas <b>enviadas</b> contam.
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <label className={`flex cursor-pointer items-start justify-between gap-4 rounded-tl-xl rounded-br-xl px-4 py-3 ${opt.locked ? "bg-warning/15" : "bg-base-200/70"}`}>
          <span>
            <span className="flex items-center gap-1.5 text-sm font-medium">
              {opt.locked ? <Lock size={14} /> : <LockOpen size={14} />} Travar avaliações
            </span>
            <span className="mt-0.5 block text-xs text-base-content/55">Depois da deliberação: banca e apuradores não alteram mais as fichas.</span>
          </span>
          <input type="checkbox" className="toggle toggle-warning" checked={opt.locked} disabled={busy} onChange={(e) => update({ locked: e.target.checked })} />
        </label>
        <div className="rounded-tl-xl rounded-br-xl bg-base-200/70 px-4 py-3">
          <label className="flex cursor-pointer items-start justify-between gap-4">
            <span>
              <span className="block text-sm font-medium">Incluir a partida no geral</span>
              <span className="mt-0.5 block text-xs text-base-content/55">Nota da equipe na classificação ÷ melhor nota do evento (como o prêmio de campeão da FLL).</span>
            </span>
            <input type="checkbox" className="toggle toggle-primary" checked={opt.includeRobotGame} disabled={busy} onChange={(e) => update({ includeRobotGame: e.target.checked })} />
          </label>
          {opt.includeRobotGame && (
            <div className="mt-2 flex items-center gap-2 text-xs">
              Peso da partida
              <input
                type="number"
                min={0}
                max={10}
                step={0.5}
                className="input input-bordered input-xs w-20"
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                onBlur={() => weight !== opt.robotGameWeight && update({ robotGameWeight: weight })}
              />
              <span className="text-base-content/55">rubricas: {rubrics.map((r) => `${r.name} ${r.weight}`).join(" · ")}</span>
            </div>
          )}
        </div>
      </div>

      {(pending.length > 0 || teamsWithoutSession.length > 0) && (
        <Panel kicker={`/ ${pending.length + teamsWithoutSession.length} PENDÊNCIA(S)`} title="Antes de fechar os resultados">
          <ul className="space-y-1.5 text-sm">
            {teamsWithoutSession.length > 0 && (
              <li className="flex items-start gap-2">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warning" />
                <span>
                  <b>Sem sessão agendada:</b> {teamsWithoutSession.join(", ")}
                </span>
              </li>
            )}
            {pending.map((p) => (
              <li key={p.sessionId} className="flex items-start gap-2">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warning" />
                <span className="flex-1">
                  <b>{p.teamName}</b> ({p.roomName}) — falta enviar: {p.missing.map((id) => rubricName.get(id) ?? "?").join(", ")}
                </span>
                <Link href={`/hub/${eventId}/avaliacao/sessao/${p.sessionId}`} className="link text-xs">
                  abrir
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel
        kicker="/ CLASSIFICAÇÃO"
        title={tab === "overall" ? "Geral da avaliação" : rubricName.get(tab)}
        action={
          <button type="button" className="btn btn-sm btn-outline" onClick={exportCsv}>
            <Download size={14} /> CSV
          </button>
        }
      >
        <div role="tablist" className="mb-4 flex flex-wrap gap-1">
          <button type="button" role="tab" aria-selected={tab === "overall"} className={`btn btn-xs ${tab === "overall" ? "btn-neutral" : "btn-ghost"}`} onClick={() => setTab("overall")}>
            <Trophy size={12} /> Geral
          </button>
          {rubrics.map((r) => (
            <button key={r.id} type="button" role="tab" aria-selected={tab === r.id} className={`btn btn-xs ${tab === r.id ? "btn-neutral" : "btn-ghost"}`} onClick={() => setTab(r.id)}>
              {r.name}
            </button>
          ))}
        </div>

        {tab === "overall" ? (
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th className="w-10">#</th>
                  <th>Equipe</th>
                  {rubrics.map((r) => (
                    <th key={r.id} className="text-right">
                      {r.name}
                    </th>
                  ))}
                  {opt.includeRobotGame && <th className="text-right">Partida</th>}
                  <th className="text-right">Geral</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {overall.map((r) => (
                  <tr key={r.team.id} className={r.complete ? "" : "text-base-content/55"}>
                    <td className="font-mono font-bold">{r.rank <= 3 && r.complete ? <Medal size={15} className="inline text-primary" /> : null} {r.rank}</td>
                    <td>
                      {r.team.number && <span className="mr-1.5 font-mono text-xs text-base-content/50">#{r.team.number}</span>}
                      {r.team.name}
                      {!r.complete && <span className="ml-2 text-[10px] uppercase">incompleta</span>}
                    </td>
                    {rubrics.map((x) => (
                      <td key={x.id} className="text-right font-mono">
                        {pct(r.byRubric[x.id])}
                      </td>
                    ))}
                    {opt.includeRobotGame && <td className="text-right font-mono">{pct(r.robotGame)}</td>}
                    <td className="text-right font-mono font-bold">{pct(r.overall)}</td>
                    <td className="text-right">
                      <Link href={`/hub/${eventId}/avaliacao/resultados/${r.team.id}`} className="btn btn-ghost btn-xs" title="Fichas e retorno da equipe">
                        <FileText size={13} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-base-content/55">
              Geral = média ponderada dos percentuais{opt.includeRobotGame ? ` (partida em ${robotUnit} normalizada pela melhor nota)` : ""}. Rubrica sem ficha enviada conta 0%.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th className="w-10">#</th>
                  <th>Equipe</th>
                  <th className="text-right">Pontos</th>
                  <th className="text-right">%</th>
                  <th className="text-right">Fichas</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(perRubric[tab] ?? []).map((r) => (
                  <tr key={r.team.id} className={r.percent === null ? "text-base-content/50" : ""}>
                    <td className="font-mono font-bold">{r.rank ?? "—"}</td>
                    <td>
                      {r.team.number && <span className="mr-1.5 font-mono text-xs text-base-content/50">#{r.team.number}</span>}
                      {r.team.name}
                    </td>
                    <td className="text-right font-mono">{r.total === null ? "—" : `${r.total.toLocaleString("pt-BR")} / ${r.max?.toLocaleString("pt-BR")}`}</td>
                    <td className="text-right font-mono font-bold">{pct(r.percent)}</td>
                    <td className="text-right font-mono">{r.sheets}</td>
                    <td className="text-right">
                      <Link href={`/hub/${eventId}/avaliacao/resultados/${r.team.id}`} className="btn btn-ghost btn-xs" title="Fichas e retorno da equipe">
                        <FileText size={13} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
