import type { EventRow } from "@/db/schema";
import { CHALLENGE_TYPES } from "./challenge";
import { FLL_FORMAT, type ScoreFormat } from "./format";
import { seasonLabel } from "./missions";
import { FE_SEASON_LABEL } from "./future-edition";

type EventLike = Pick<EventRow, "format" | "season" | "challenge">;

/** Como ler as notas do evento. */
export function scoringOf(event: EventLike): ScoreFormat {
  if ((event.format === "custom" || event.format === "fll_fe" || event.format === "alliance") && event.challenge) {
    const { direction, unit, decimals } = event.challenge.scoring;
    return { direction, unit, decimals };
  }
  return FLL_FORMAT;
}

/** Rótulo curto do formato: "FLL · BioGlow" ou "Contra o tempo · Seguidor de Linha". */
export function formatLabel(event: EventLike): { kind: string; name: string } {
  if (event.format === "obr") return { kind: "OBR", name: "Resgate" };
  if (event.format === "alliance") {
    const a = event.challenge?.alliance;
    const size = a ? (a.mode === "coop" ? `cooperativo de ${a.teamsPerAlliance}` : `${a.teamsPerAlliance} × ${a.teamsPerAlliance}`) : "";
    return { kind: "Alianças", name: [event.challenge?.name ?? "Partidas", size].filter(Boolean).join(" · ") };
  }
  if (event.format === "fll_fe") return { kind: "FLL", name: FE_SEASON_LABEL };
  if (event.format === "custom" && event.challenge)
    return { kind: CHALLENGE_TYPES[event.challenge.type]?.label ?? "Desafio", name: event.challenge.name };
  return { kind: "FLL", name: seasonLabel(event.season) };
}
