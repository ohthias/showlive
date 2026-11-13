import type { ActivityPayload, EventTheme } from "@/db/schema";
import type { ScoreFormat } from "./format";

/** Tudo o que uma tela ao vivo precisa. Serializável (vai pelo SSE). */
export interface LiveSnapshot {
  revision: number;
  /** Relógio do servidor (ms) no momento do snapshot — corrige o cronômetro. */
  serverNow: number;
  audience: "public" | "staff";
  event: {
    id: string;
    code: string | null;
    name: string;
    season: string;
    seasonLabel: string;
    status: "draft" | "live" | "finished";
    theme: EventTheme;
    timer: TimerState;
    format: "fll" | "custom" | "fll_fe" | "obr";
    /** Como ler o valor das notas (pontos, segundos, cm...). */
    scoring: ScoreFormat;
    /** Só em desafios personalizados: nome, tipo e objetivo para o telão. */
    challenge: { name: string; type: string; objective: string } | null;
  };
  settings: LiveSettings;
  rounds: LiveRound[];
  teams: LiveTeam[];
  scores: LiveScore[];
  activity: LiveActivity[];
}

export interface TimerState {
  durationSec: number;
  startedAt: number | null;
  remainingMs: number | null;
}

export interface LiveSettings {
  /** Derivado do desafio: "lower" quando menor valor vence (tempo). */
  direction: "higher" | "lower";
  showOnlyCurrentRound: boolean;
  /** FLL: imagem da missão visível para o árbitro na mesa. */
  showMissionImages: boolean;
  /** best: melhor rodada · sum: soma · best2: soma das 2 melhores (OBR). */
  rankingMode: "best" | "sum" | "best2";
  enablePlayoffs: boolean;
  playoffFormat: "final" | "semifinal";
  hideScoresUntilRoundEnds: boolean;
  highlightLeader: boolean;
  showBrackets: boolean;
  showTicker: boolean;
  showTimer: boolean;
  celebrateScores: boolean;
  rowsPerPage: number;
  // Voluntários / mesa
  submissionsPaused: boolean;
  requireTeamConfirmation: boolean;
  refereeEditWindowMin: number;
  volunteersControlTimer: boolean;
  volunteersSeeRanking: boolean;
  /** Só para staff (null no público). */
  mesaNotice: string | null;
  // Administração
  requireApproval: boolean;
  scorersCanEdit: boolean;
  // Telão
  showTeamDetails: boolean;
  showQrCode: boolean;
}

export interface LiveRound {
  id: string;
  name: string;
  position: number;
  kind: "qualifying" | "semifinal" | "final" | "extra";
  /** OBR: nome da arena da rodada. */
  arena?: string | null;
  /** Desafio extra: como ler o valor (ranking próprio). */
  extra?: { id: string; name: string; scoring: ScoreFormat } | null;
}

export interface LiveTeam {
  id: string;
  name: string;
  number: string | null;
  organization: string | null;
}

export interface LiveScore {
  teamId: string;
  roundId: string;
  /** null quando a nota existe mas está oculta para o público. */
  points: number | null;
  /** Desempate (OBR: tempo em segundos). null quando oculto. */
  tb?: number | null;
  at: number;
  /** Só staff: aguardando aprovação (não conta no ranking). */
  pending?: boolean;
  /** Só staff: id de quem lançou e quando a nota foi criada (ms). */
  sb?: string;
  created?: number;
  /** Só para staff. */
  by?: string;
  gp?: string | null;
}

export interface LiveActivity {
  id: number;
  kind: string;
  payload: ActivityPayload;
  at: number;
}
