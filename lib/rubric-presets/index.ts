import { FLL_CHALLENGE } from "./fll";
import { FLL_FUTURE_EDITION } from "./future-edition";
import { FTC_GROUP } from "./ftc";
import type { RubricPresetGroup } from "./helpers";
import { SHOWLIVE_GROUPS } from "./showlive";

export type { RubricPreset, RubricPresetGroup } from "./helpers";

export const RUBRIC_PRESET_GROUPS: RubricPresetGroup[] = [FLL_CHALLENGE, FLL_FUTURE_EDITION, FTC_GROUP, ...SHOWLIVE_GROUPS];

export function findPresetGroup(id: string) {
  return RUBRIC_PRESET_GROUPS.find((g) => g.id === id) ?? null;
}

/** Grupo sugerido conforme o formato do evento. */
export function suggestedPresetGroup(format: string) {
  if (format === "fll") return "fll";
  if (format === "fll_fe") return "fll-fe";
  if (format === "obr") return "sl-engineering";
  if (format === "alliance") return "ftc";
  return "sl-shows";
}
