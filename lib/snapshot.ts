import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { activity, eventSettings, events, matches, rounds, scores, teams, type EventRow, type EventSettingsRow } from "@/db/schema";
import { challengeGroups } from "./alliance-config";
import { DEFAULT_CAMERA } from "./screen";
import { formatLabel, scoringOf } from "./event-format";
import { computePlayoffs, roundProgress } from "./ranking";
import type { LiveSettings, LiveSnapshot } from "./live-types";

/** Evento pelo código público — só encontra eventos AO VIVO. */
export async function getEventByCode(code: string) {
  if (!code) return null;
  const db = await getDb();
  const [event] = await db
    .select()
    .from(events)
    .where(and(eq(events.code, code.toUpperCase()), eq(events.status, "live")))
    .limit(1);
  return event ?? null;
}

export async function getEventById(id: string) {
  const db = await getDb();
  const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  return event ?? null;
}

export function toLiveSettings(s: EventSettingsRow | undefined, direction: "higher" | "lower" = "higher"): LiveSettings {
  return {
    direction,
    showOnlyCurrentRound: s?.showOnlyCurrentRound ?? false,
    showMissionImages: s?.showMissionImages ?? true,
    rankingMode: s?.rankingMode ?? "best",
    enablePlayoffs: s?.enablePlayoffs ?? false,
    playoffFormat: s?.playoffFormat ?? "final",
    hideScoresUntilRoundEnds: s?.hideScoresUntilRoundEnds ?? false,
    highlightLeader: s?.highlightLeader ?? true,
    showBrackets: s?.showBrackets ?? true,
    showTicker: s?.showTicker ?? true,
    showTimer: s?.showTimer ?? false,
    celebrateScores: s?.celebrateScores ?? true,
    rowsPerPage: s?.rowsPerPage ?? 10,
    submissionsPaused: s?.submissionsPaused ?? false,
    requireTeamConfirmation: s?.requireTeamConfirmation ?? false,
    refereeEditWindowMin: s?.refereeEditWindowMin ?? 0,
    volunteersControlTimer: s?.volunteersControlTimer ?? true,
    volunteersSeeRanking: s?.volunteersSeeRanking ?? false,
    mesaNotice: s?.mesaNotice ?? null,
    requireApproval: s?.requireApproval ?? false,
    scorersCanEdit: s?.scorersCanEdit ?? false,
    showTeamDetails: s?.showTeamDetails ?? true,
    showQrCode: s?.showQrCode ?? false,
    screenMessage: s?.screenMessage ?? null,
    camera: { ...DEFAULT_CAMERA, ...(s?.camera ?? {}) },
  };
}

/**
 * Monta o estado completo do evento. Público: aplica as regras de exibição
 * NO SERVIDOR (notas ocultas nem chegam ao navegador do telão).
 */
export async function buildSnapshot(event: EventRow, audience: "public" | "staff"): Promise<LiveSnapshot> {
  const db = await getDb();
  const isAlliance = event.format === "alliance" && !!event.challenge?.alliance;
  const [settingsRows, roundRows, teamRows, scoreRows, activityRows, matchRows] = await Promise.all([
    db.select().from(eventSettings).where(eq(eventSettings.eventId, event.id)).limit(1),
    db.select().from(rounds).where(eq(rounds.eventId, event.id)).orderBy(asc(rounds.position)),
    db.select().from(teams).where(eq(teams.eventId, event.id)).orderBy(asc(teams.name)),
    db
      .select({
        teamId: scores.teamId,
        roundId: scores.roundId,
        points: scores.points,
        tiebreak: scores.tiebreak,
        updatedAt: scores.updatedAt,
        by: scores.submittedByLabel,
        sb: scores.submittedBy,
        createdAt: scores.createdAt,
        status: scores.status,
        extras: scores.extras,
      })
      .from(scores)
      .where(eq(scores.eventId, event.id)),
    db.select().from(activity).where(eq(activity.eventId, event.id)).orderBy(desc(activity.id)).limit(20),
    isAlliance ? db.select().from(matches).where(eq(matches.eventId, event.id)).orderBy(asc(matches.number)) : Promise.resolve([]),
  ]);

  // Partidas: o público só vê resultados finais (pendentes de aprovação aparecem como agendadas).
  const strip = (r: NonNullable<(typeof matchRows)[number]["result"]>["red"]) => ({
    score: r.score,
    base: r.base,
    penalty: r.penalty,
    byGroup: r.byGroup,
    bonus: r.bonus,
    bonusRp: r.bonusRp,
  });
  const liveMatches = matchRows.map((m) => {
    const hidden = audience === "public" && m.status !== "final";
    return {
      id: m.id,
      number: m.number,
      field: m.field,
      at: m.scheduledAt?.getTime() ?? null,
      red: m.red,
      blue: m.blue,
      status: hidden ? ("scheduled" as const) : m.status,
      result: m.result && !hidden ? { red: strip(m.result.red), blue: m.result.blue ? strip(m.result.blue) : null, flags: m.result.flags } : null,
      updated: m.updatedAt.getTime(),
      ...(audience === "staff" ? { by: m.submittedByLabel ?? undefined, sb: m.submittedBy ?? undefined } : {}),
    };
  });

  const scoring = scoringOf(event);
  const settings = toLiveSettings(settingsRows[0], scoring.direction);
  const arenas = event.league?.arenas ?? [];
  const extras = event.league?.extras ?? [];
  const liveRounds = roundRows.map((r) => {
    const extra = r.meta?.extraId ? extras.find((x) => x.id === r.meta?.extraId) : undefined;
    return {
      id: r.id,
      name: r.name,
      position: r.position,
      kind: r.kind,
      arena: r.meta?.arenaId ? (arenas.find((a) => a.id === r.meta?.arenaId)?.name ?? null) : null,
      extra: extra
        ? {
            id: extra.id,
            name: extra.name,
            scoring: { direction: extra.scoring.direction, unit: extra.scoring.unit, decimals: extra.scoring.decimals },
          }
        : null,
    };
  });
  const liveTeams = teamRows.map((t) => ({ id: t.id, name: t.name, number: t.number, organization: t.organization }));
  // Notas pendentes de aprovação não existem para o público.
  const visibleRows = audience === "public" ? scoreRows.filter((s) => s.status === "approved") : scoreRows;
  let liveScores = visibleRows.map((s) => ({
    teamId: s.teamId,
    roundId: s.roundId,
    points: s.points as number | null,
    tb: s.tiebreak as number | null,
    at: s.updatedAt.getTime(),
    ...(audience === "staff"
      ? {
          by: s.by,
          gp: s.extras?.gp?.label ?? null,
          sb: s.sb,
          created: s.createdAt.getTime(),
          ...(s.status === "pending" ? { pending: true } : {}),
        }
      : {}),
  }));

  let liveActivity = activityRows.map((a) => ({ id: a.id, kind: a.kind, payload: a.payload, at: a.createdAt.getTime() }));

  if (audience === "public" && settings.hideScoresUntilRoundEnds) {
    const hidden = new Set<string>();
    for (const p of roundProgress(liveTeams, liveRounds, liveScores)) if (!p.complete) hidden.add(p.round.id);

    const playoffs = computePlayoffs(liveTeams, liveRounds, liveScores, settings);
    if (playoffs.semifinalRound && playoffs.semifinal.some((s) => s.points === undefined)) hidden.add(playoffs.semifinalRound.id);
    if (playoffs.finalRound && playoffs.final.some((s) => s.points === undefined)) hidden.add(playoffs.finalRound.id);

    const hiddenNames = new Set(liveRounds.filter((r) => hidden.has(r.id)).map((r) => r.name));
    liveScores = liveScores.map((s) => (hidden.has(s.roundId) ? { ...s, points: null, tb: null } : s));
    liveActivity = liveActivity.map((a) =>
      a.payload.round && hiddenNames.has(a.payload.round)
        ? { ...a, payload: { ...a.payload, points: undefined, previous: undefined } }
        : a,
    );
  }

  if (audience === "public") {
    settings.mesaNotice = null;
    // O nome de quem lançou fica só para a organização.
    liveActivity = liveActivity
      // Avisos não entram no letreiro: o telão mostra só o aviso atual (settings.screenMessage).
      .filter((a) => ["score", "score_edit", "score_void", "match"].includes(a.kind))
      .map((a) => ({ ...a, payload: { ...a.payload, by: undefined } }));
  }

  return {
    revision: event.revision,
    serverNow: Date.now(),
    audience,
    event: {
      id: event.id,
      code: event.code,
      name: event.name,
      season: event.season,
      seasonLabel: formatLabel(event).name,
      status: event.status,
      theme: event.theme,
      timer: {
        durationSec: event.timerDurationSec,
        startedAt: event.timerStartedAt?.getTime() ?? null,
        remainingMs: event.timerRemainingMs,
      },
      format: event.format,
      scoring,
      challenge: event.challenge
        ? { name: event.challenge.name, type: event.challenge.type, objective: event.challenge.objective }
        : null,
    },
    settings,
    rounds: liveRounds,
    teams: liveTeams,
    scores: liveScores,
    activity: liveActivity,
    alliance: isAlliance ? { config: event.challenge!.alliance!, groups: challengeGroups(event.challenge!) } : null,
    matches: liveMatches,
  };
}
