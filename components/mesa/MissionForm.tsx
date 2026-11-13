"use client";

import { memo } from "react";
import { AlertTriangle, Ban } from "lucide-react";
import type { Mission } from "@/lib/missions";
import { MissionImage } from "./MissionImage";
import { computeMissionBreakdown, NON_SCORING_MISSIONS, type MissionResponses, type RoundResponses } from "@/lib/scoring";

type OnSelect = (missionId: string, index: number, idx: number) => void;

/**
 * Súmula da partida. Mesmas regras e mesma convenção (índice da opção) do
 * FormMission do RoboStage; visual adaptado para toque rápido na mesa.
 */
export function MissionForm({
  missions,
  responses,
  onSelect,
  showImages = true,
}: {
  missions: Mission[];
  responses: RoundResponses;
  onSelect: OnSelect;
  /** Definido pela organização do evento (Configurações → mesa). */
  showImages?: boolean;
}) {
  return (
    <div className="space-y-4">
      {missions.map((m) => (
        <MissionCard key={m.id} mission={m} responses={responses[m.id]} onSelect={onSelect} showImage={showImages} />
      ))}
    </div>
  );
}

const MissionCard = memo(function MissionCard({
  mission,
  responses = {},
  onSelect,
  showImage,
}: {
  mission: Mission;
  responses?: MissionResponses;
  onSelect: OnSelect;
  showImage: boolean;
}) {
  const { mainPoints, subPoints, gated, unmet, total } = computeMissionBreakdown(mission, responses);
  const subs = mission["sub-mission"] || [];
  const nonScoring = NON_SCORING_MISSIONS.has(mission.id);
  const answered = Object.keys(responses).length > 0;

  return (
    <article
      id={`m-${mission.id}`}
      className={`scroll-mt-28 rounded-tl-2xl rounded-br-2xl border bg-base-100 transition-colors ${
        answered ? "border-base-content/25" : "border-base-300"
      }`}
    >
      <header className="flex items-center gap-3 border-b border-base-300 px-4 py-3">
        <span
          className={`grid h-9 min-w-12 place-items-center rounded-tl-lg rounded-br-lg px-2 font-mono text-sm font-bold ${
            answered ? "bg-base-content text-base-100" : "bg-base-200"
          }`}
        >
          {mission.id}
        </span>
        <h3 className="flex-1 text-sm font-bold uppercase tracking-tight sm:text-base">{mission.name}</h3>
        {mission.equipaments && (
          <span className="tooltip tooltip-left" data-tip="Sem equipamento tocando no fim da partida">
            <Ban size={18} className="text-warning" />
          </span>
        )}
        {!nonScoring && (
          <span className={`font-mono text-sm font-bold tabular-nums ${total ? "text-primary" : "text-base-content/40"}`}>
            {total} pts
          </span>
        )}
      </header>

      <div className="space-y-4 p-4">
        {showImage && mission.image && <MissionImage src={mission.image} alt={`${mission.id} · ${mission.name}`} />}
        {gated && (
          <p className="flex items-center gap-2 rounded-tl-lg rounded-br-lg bg-warning/15 px-3 py-2 text-xs font-medium">
            <AlertTriangle size={14} className="text-warning" /> Condição obrigatória não cumprida: a missão inteira vale 0.
          </p>
        )}

        {mission.mission && (
          <Part
            text={mission.mission}
            points={nonScoring ? null : mainPoints}
            type={mission.type}
            value={responses[0]}
            onPick={(idx) => onSelect(mission.id, 0, idx)}
          />
        )}

        {subs.map((sub, i) => (
          <div key={sub.id ?? i} className="border-t border-dashed border-base-300 pt-4">
            <Part
              text={sub.submission}
              note={sub.note}
              points={sub.points === 0 ? null : subPoints[i]}
              type={sub.type}
              value={responses[i + 1]}
              onPick={(idx) => onSelect(mission.id, i + 1, idx)}
              badges={
                <>
                  {sub.zero_whole_mission_if_false && <span className="badge badge-error badge-sm">Obrigatório</span>}
                  {sub.bonus_exclusive && <span className="badge badge-ghost badge-sm">Bônus exclusivo</span>}
                  {sub.manual_tracking_required && (
                    <span className="badge badge-warning badge-sm" title={sub.manual_tracking_note}>
                      Acompanhar ao vivo
                    </span>
                  )}
                </>
              }
              warning={!gated && unmet.includes(i) ? "Condição não cumprida — este bônus não pontua." : undefined}
            />
          </div>
        ))}
      </div>
    </article>
  );
});

function Part({
  text,
  note,
  points,
  type,
  value,
  onPick,
  badges,
  warning,
}: {
  text: string;
  note?: string;
  points: number | null;
  type: Mission["type"];
  value: number | undefined;
  onPick: (idx: number) => void;
  badges?: React.ReactNode;
  warning?: string;
}) {
  const options =
    type[0] === "range"
      ? Array.from({ length: (Number(type[2]) || 10) - (Number(type[1]) || 0) + 1 }, (_, i) => String((Number(type[1]) || 0) + i))
      : (() => {
          const labels = type.slice(1).filter((v) => v !== null).map(String);
          return labels.length ? labels : ["Não", "Sim"];
        })();

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm leading-6 sm:text-[15px]">{text}</p>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">{badges}</div>
      </div>
      {note && <p className="mt-1 text-xs text-base-content/55">{note}</p>}
      {warning && <p className="mt-1 text-xs font-medium text-warning">{warning}</p>}
      <div className="mt-2.5 flex flex-wrap items-center gap-2" role="radiogroup">
        {options.map((label, idx) => {
          const active = value === idx;
          return (
            <button
              key={idx}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onPick(idx)}
              className={`btn h-12 min-w-14 rounded-tl-lg rounded-br-lg rounded-tr-none rounded-bl-none text-base ${
                active ? "btn-primary shadow-[3px_3px_0_0_var(--color-base-content)]" : "btn-outline border-base-300 font-normal"
              }`}
            >
              {label}
            </button>
          );
        })}
        {points !== null && value !== undefined && (
          <span className="ml-auto font-mono text-xs text-base-content/55">+{points}</span>
        )}
      </div>
    </div>
  );
}
