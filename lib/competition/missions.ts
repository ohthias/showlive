import missionsData from "@/data/missions.json";

/**
 * Missões da FLL por temporada. O arquivo data/missions.json é uma cópia do
 * public/data/missions.json do RoboStage — mesmo formato, mesmo motor de
 * pontuação (lib/scoring.ts), então uma nota dada aqui bate com o Pontuador.
 */

export type MissionType = ["switch" | "range", ...(string | number | null)[]];

export interface RequirementRule {
  condition?: ["if", boolean];
  when_self?: string;
  mission: string;
  value: boolean | number | [number, number];
}

export interface SubMission {
  id?: string;
  submission: string;
  points: number | number[];
  type: MissionType;
  note?: string;
  requires?: RequirementRule[];
  zero_whole_mission_if_false?: boolean;
  manual_tracking_required?: boolean;
  manual_tracking_note?: string;
  bonus_exclusive?: boolean;
}

export interface Mission {
  id: string;
  name: string;
  mission: string;
  points: number | number[];
  equipaments?: boolean;
  type: MissionType;
  image?: string;
  ["sub-mission"]?: SubMission[];
}

export const SEASONS = [
  { id: "bioglow", label: "BioGlow", year: "2026/27" },
  { id: "unearthed", label: "Unearthed", year: "2025/26" },
  { id: "submerged", label: "Submerged", year: "2024/25" },
  { id: "masterpiece", label: "Masterpiece", year: "2023/24" },
] as const;

export type SeasonId = (typeof SEASONS)[number]["id"];

const data = missionsData as unknown as Record<string, Mission[]>;

export function isSeason(value: string): value is SeasonId {
  return SEASONS.some((s) => s.id === value);
}

export function seasonLabel(id: string): string {
  return SEASONS.find((s) => s.id === id)?.label ?? id.toUpperCase();
}

export function getMissions(season: string): Mission[] {
  return data[season] ?? [];
}
