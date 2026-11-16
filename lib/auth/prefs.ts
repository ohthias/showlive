/**
 * Preferências do usuário (por conta RoboStage). Viram os valores padrão de
 * cada evento novo e ajustam a mesa quando ele mesmo arbitra.
 */
export interface UserPrefs {
  // Evento novo
  defaultFormat: "fll" | "fll_fe" | "obr" | "custom" | "alliance";
  defaultSeason: string;
  defaultRounds: number;
  defaultTheme: string;
  defaultTimerSec: number;
  defaultRankingMode: "best" | "sum";
  defaultHideScores: boolean;
  defaultShowTimer: boolean;
  defaultCelebrate: boolean;
  /** Quantas mesas (códigos) criar se o evento ficar ao vivo sem nenhuma. */
  defaultMesaCount: number;
  // Mesa
  mesaConfirmBeforeSend: boolean;
  mesaKeepScreenOn: boolean;
  // Hub
  hubCompactLists: boolean;
}

export const DEFAULT_PREFS: UserPrefs = {
  defaultFormat: "fll",
  defaultSeason: "bioglow",
  defaultRounds: 3,
  defaultTheme: "robostage",
  defaultTimerSec: 150,
  defaultRankingMode: "best",
  defaultHideScores: false,
  defaultShowTimer: false,
  defaultCelebrate: true,
  defaultMesaCount: 1,
  mesaConfirmBeforeSend: true,
  mesaKeepScreenOn: true,
  hubCompactLists: false,
};

export function mergePrefs(saved: Partial<UserPrefs> | null | undefined): UserPrefs {
  return { ...DEFAULT_PREFS, ...(saved ?? {}) };
}
