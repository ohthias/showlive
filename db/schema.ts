import { sql } from "drizzle-orm";
import type { Challenge } from "@/lib/challenge-types";
import type { UserPrefs } from "@/lib/prefs";
import type { ObrLeague, RoundMeta } from "@/lib/obr-types";
import {
  bigint,
  bigserial,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Banco do ShowLive — SEPARADO do banco do RoboStage.
 *
 * Não há tabela de usuários aqui: o dono e os admins de um evento são
 * identificados pelo id do Clerk ("user_xxx"), que é o mesmo da conta
 * RoboStage. Nome e e-mail são guardados como "foto" no momento do convite
 * só para exibição.
 *
 * Realtime: toda escrita que muda o que aparece ao vivo incrementa
 * `events.revision` (via gatilhos, ver drizzle/0001_realtime_triggers.sql).
 * O stream SSE só precisa comparar um número para saber se há novidade.
 */

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/* ------------------------------------------------------------------ enums */

export const eventStatusEnum = pgEnum("event_status", ["draft", "live", "finished"]);
export const eventFormatEnum = pgEnum("event_format", ["fll", "custom", "fll_fe", "obr"]);
export const memberRoleEnum = pgEnum("member_role", ["owner", "admin", "scorer"]);
export const memberStatusEnum = pgEnum("member_status", ["active", "pending"]);
export const roundKindEnum = pgEnum("round_kind", ["qualifying", "semifinal", "final", "extra"]);
export const rankingModeEnum = pgEnum("ranking_mode", ["best", "sum", "best2"]);
export const playoffFormatEnum = pgEnum("playoff_format", ["final", "semifinal"]);
export const scoreStatusEnum = pgEnum("score_status", ["approved", "pending"]);

/* ----------------------------------------------------------------- events */

export type EventTheme = {
  preset: string;
  /** [fundo, destaque, texto] */
  colors: [string, string, string];
  background: string | null;
  blur: boolean;
  logoUrl?: string | null;
  /** Estilo visual do telão (opcionais; padrões em lib/themes.ts → resolveTvStyle). */
  secondary?: string;
  bgStyle?: "solid" | "gradient" | "spotlight" | "aurora" | "mesh";
  pattern?: "none" | "dots" | "grid" | "lines" | "hex" | "circuit" | "topo";
  patternOpacity?: number;
  layout?: "table" | "cards" | "compact" | "split";
  panel?: "glass" | "solid" | "outline";
  corners?: "cut" | "round" | "sharp";
  font?: "roboto" | "space-grotesk" | "sora" | "oswald" | "bebas" | "orbitron" | "chakra";
  numFont?: "roboto-mono" | "jetbrains" | "orbitron" | "display";
  motion?: "off" | "subtle" | "full";
  medals?: boolean;
  rankMoves?: boolean;
};

export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /**
     * Código público (6 caracteres): abre o telão em /e/CODIGO.
     * Só existe enquanto o evento está AO VIVO: é gerado na ativação e
     * apagado quando o evento volta para preparação ou é encerrado.
     */
    code: text("code"),
    name: text("name").notNull(),
    ownerId: text("owner_id").notNull(),
    format: eventFormatEnum("format").notNull().default("fll"),
    /** FLL: chave em data/missions.json. Desafio personalizado: "custom". */
    season: text("season").notNull(),
    /** Definição do desafio personalizado (format = "custom"). Ver lib/challenge.ts. */
    challenge: jsonb("challenge").$type<Challenge>(),
    /** Template de origem, se o desafio veio de um. */
    templateId: uuid("template_id"),
    /** Configuração da liga OBR Resgate: as 3 arenas e os desafios extras. */
    league: jsonb("league").$type<ObrLeague>(),
    status: eventStatusEnum("status").notNull().default("draft"),
    theme: jsonb("theme").$type<EventTheme>().notNull(),

    // Cronômetro compartilhado. Ninguém "conta" o tempo no servidor: cada
    // tela calcula o restante a partir destes campos + o relógio do servidor.
    timerDurationSec: integer("timer_duration_sec").notNull().default(150),
    timerStartedAt: timestamp("timer_started_at", { withTimezone: true }),
    /** Milissegundos restantes no momento do start/pause. null = parado/zerado. */
    timerRemainingMs: integer("timer_remaining_ms"),

    revision: bigint("revision", { mode: "number" }).notNull().default(0),
    ...timestamps,
  },
  (t) => [
    unique("events_code_unique").on(t.code),
    index("events_owner_idx").on(t.ownerId),
  ],
);

export const eventSettings = pgTable("event_settings", {
  eventId: uuid("event_id")
    .primaryKey()
    .references(() => events.id, { onDelete: "cascade" }),

  // Mesa
  showOnlyCurrentRound: boolean("show_only_current_round").notNull().default(false),
  /** FLL: o árbitro vê a imagem de cada missão na súmula. */
  showMissionImages: boolean("show_mission_images").notNull().default(true),
  /** Pausa temporária dos envios da mesa (intervalo), sem tirar o evento do ar. */
  submissionsPaused: boolean("submissions_paused").notNull().default(false),
  /** A mesa precisa marcar que a equipe conferiu a súmula antes de enviar. */
  requireTeamConfirmation: boolean("require_team_confirmation").notNull().default(false),
  /** Minutos em que o voluntário pode corrigir/apagar a própria nota (0 = não pode). */
  refereeEditWindowMin: integer("referee_edit_window_min").notNull().default(0),
  /** Voluntários com código podem controlar o cronômetro. */
  volunteersControlTimer: boolean("volunteers_control_timer").notNull().default(true),
  /** A mesa mostra a classificação geral. */
  volunteersSeeRanking: boolean("volunteers_see_ranking").notNull().default(false),
  /** Aviso fixo da organização na tela das mesas. */
  mesaNotice: text("mesa_notice"),

  // Administração
  /** Notas da mesa entram pendentes; só aparecem no telão depois de aprovadas. */
  requireApproval: boolean("require_approval").notNull().default(false),
  /** Apuradores (papel "scorer") podem corrigir, apagar e aprovar notas no hub. */
  scorersCanEdit: boolean("scorers_can_edit").notNull().default(false),

  // Classificação
  rankingMode: rankingModeEnum("ranking_mode").notNull().default("best"),
  enablePlayoffs: boolean("enable_playoffs").notNull().default(false),
  playoffFormat: playoffFormatEnum("playoff_format").notNull().default("final"),

  // Telão
  hideScoresUntilRoundEnds: boolean("hide_scores_until_round_ends").notNull().default(false),
  highlightLeader: boolean("highlight_leader").notNull().default(true),
  showBrackets: boolean("show_brackets").notNull().default(true),
  showTicker: boolean("show_ticker").notNull().default(true),
  showTimer: boolean("show_timer").notNull().default(false),
  /** Mostrar número e escola das equipes no telão. */
  showTeamDetails: boolean("show_team_details").notNull().default(true),
  /** QR code no telão para o público acompanhar no celular. */
  showQrCode: boolean("show_qr_code").notNull().default(false),
  celebrateScores: boolean("celebrate_scores").notNull().default(true),
  rowsPerPage: integer("rows_per_page").notNull().default(10),

  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* -------------------------------------------------------- hub de admins */

export const eventMembers = pgTable(
  "event_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    /** null enquanto o convite estiver pendente (pessoa ainda não entrou no ShowLive). */
    userId: text("user_id"),
    email: text("email").notNull(),
    name: text("name"),
    role: memberRoleEnum("role").notNull().default("admin"),
    status: memberStatusEnum("status").notNull().default("active"),
    invitedBy: text("invited_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("event_members_event_user_unique").on(t.eventId, t.userId),
    unique("event_members_event_email_unique").on(t.eventId, t.email),
    index("event_members_user_idx").on(t.userId),
    index("event_members_email_idx").on(t.email),
  ],
);

/** Códigos da mesa de arbitragem (voluntários entram sem conta). */
export const accessCodes = pgTable(
  "access_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    /** Gerado quando o evento fica ao vivo; null fora do ar. */
    code: text("code"),
    label: text("label").notNull().default("Mesa"),
    active: boolean("active").notNull().default(true),
    /** Rodadas que esta mesa pode avaliar (null = todas). */
    allowedRoundIds: jsonb("allowed_round_ids").$type<string[]>(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("access_codes_code_unique").on(t.code),
    index("access_codes_event_idx").on(t.eventId),
  ],
);

/* ------------------------------------------------ equipes e rodadas */

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Número oficial da equipe (ex.: 12345), opcional. */
    number: text("number"),
    organization: text("organization"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("teams_event_name_unique").on(t.eventId, t.name),
    index("teams_event_idx").on(t.eventId),
  ],
);

export const rounds = pgTable(
  "rounds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull(),
    kind: roundKindEnum("kind").notNull().default("qualifying"),
    /** OBR: arena da rodada / desafio extra ligado a ela. */
    meta: jsonb("meta").$type<RoundMeta>(),
  },
  (t) => [
    unique("rounds_event_name_unique").on(t.eventId, t.name),
    index("rounds_event_idx").on(t.eventId),
  ],
);

/** FLL: { missionId: { índice: opção } }. Personalizado: { itemId: valor, "pen:id": n }. */
export type ScoreResponses = Record<string, Record<number, number> | number>;
export type ScoreExtras = {
  /** Gracious Professionalism®: não soma no total, aparece só no relatório. */
  gp?: { label: string; points: number };
  /** Tokens de precisão restantes. */
  pt?: { remaining: number; points: number };
};

export const scores = pgTable(
  "scores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    roundId: uuid("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    /** Pontos (FLL) ou o valor do desafio (pontos, segundos, cm...). */
    points: doublePrecision("points").notNull(),
    /** Critério de desempate (OBR: tempo da rodada em segundos). */
    tiebreak: doublePrecision("tiebreak"),
    /** pending = aguardando aprovação da organização (não aparece para o público). */
    status: scoreStatusEnum("status").notNull().default("approved"),
    /** A equipe conferiu a súmula na mesa. */
    confirmedByTeam: boolean("confirmed_by_team").notNull().default(false),
    reviewedBy: text("reviewed_by"),
    responses: jsonb("responses").$type<ScoreResponses>().notNull().default(sql`'{}'::jsonb`),
    extras: jsonb("extras").$type<ScoreExtras>().notNull().default(sql`'{}'::jsonb`),
    /** id Clerk de quem lançou, ou "code:<id>" quando veio da mesa. */
    submittedBy: text("submitted_by").notNull(),
    /** Nome mostrado no histórico ("Mesa 1 · Ana"). */
    submittedByLabel: text("submitted_by_label").notNull(),
    ...timestamps,
  },
  (t) => [
    // Garante, no banco, que uma equipe só tem uma nota por rodada — duas
    // mesas enviando ao mesmo tempo não conseguem duplicar.
    unique("scores_team_round_unique").on(t.teamId, t.roundId),
    index("scores_event_idx").on(t.eventId),
  ],
);

/* --------------------------------------------------------- atividade */

export type ActivityPayload = {
  team?: string;
  round?: string;
  points?: number;
  previous?: number;
  by?: string;
  message?: string;
  /** Unidade/casas quando diferem das do evento (desafio extra). */
  unit?: string;
  decimals?: number;
};

/** Linha do tempo do evento: alimenta o letreiro do telão e a auditoria. */
export const activity = pgTable(
  "activity",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    payload: jsonb("payload").$type<ActivityPayload>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("activity_event_idx").on(t.eventId, t.id)],
);

/* ------------------------------------------- templates de desafio */

/** Desafios salvos pelo usuário para reutilizar em outros eventos. */
export const challengeTemplates = pgTable(
  "challenge_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    definition: jsonb("definition").$type<Challenge>().notNull(),
    ...timestamps,
  },
  (t) => [index("challenge_templates_owner_idx").on(t.ownerId)],
);

/* ------------------------------------------- preferências do usuário */

export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id").primaryKey(),
  prefs: jsonb("prefs").$type<Partial<UserPrefs>>().notNull().default(sql`'{}'::jsonb`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EventRow = typeof events.$inferSelect;
export type EventSettingsRow = typeof eventSettings.$inferSelect;
export type TeamRow = typeof teams.$inferSelect;
export type RoundRow = typeof rounds.$inferSelect;
export type ScoreRow = typeof scores.$inferSelect;
export type MemberRow = typeof eventMembers.$inferSelect;
export type AccessCodeRow = typeof accessCodes.$inferSelect;
export type ActivityRow = typeof activity.$inferSelect;
export type TemplateRow = typeof challengeTemplates.$inferSelect;
