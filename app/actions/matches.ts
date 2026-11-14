"use server";

import { and, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { activity, eventSettings, matches, teams, type EventRow, type MatchRow } from "@/db/schema";
import { getScorer, requireEventRole, requireScoreEditor, type ScorerIdentity } from "@/lib/access";
import { cleanText, run, UserError } from "@/lib/action";
import { buildMatchSchedule, scoreMatch, type AllianceConfig, type AllianceSlot, type MatchResult, type TeamMatchFlag } from "@/lib/alliance";
import { sanitizeCustomResponses, type Challenge } from "@/lib/challenge";
import { nudge } from "@/lib/live-hub";
import { getEventById } from "@/lib/snapshot";

/**
 * Partidas do formato de alianças: cronograma (hub), lançamento pela mesa,
 * correção/aprovação pela organização. O placar é sempre recalculado aqui a
 * partir das súmulas (lib/alliance.ts → scoreMatch).
 */

const refresh = (eventId: string) => {
  nudge(eventId);
  revalidatePath(`/hub/${eventId}`, "layout");
};

function allianceOf(event: EventRow): { challenge: Challenge; cfg: AllianceConfig } {
  if (event.format !== "alliance" || !event.challenge?.alliance) throw new UserError("Este evento não usa partidas de alianças.");
  return { challenge: event.challenge, cfg: event.challenge.alliance };
}

const label = (n: number) => `Q${n}`;

function sideText(m: Pick<MatchRow, "redScore" | "blueScore">, coop: boolean) {
  return coop ? `${m.redScore ?? 0} pts` : `Vermelha ${m.redScore ?? 0} × ${m.blueScore ?? 0} Azul`;
}

/* --------------------------------------------------------- cronograma */

export interface GenerateMatchesInput {
  matchesPerTeam: number;
  startIso: string | null;
  /** Minutos entre o início de uma partida e o da próxima. */
  cycleMin: number;
  /** Número de campos (as partidas alternam entre eles). */
  fields: number;
  /** Apaga as partidas ainda sem resultado antes de gerar. */
  replace: boolean;
}

export async function generateMatches(eventId: string, input: GenerateMatchesInput) {
  return run(async () => {
    const { event } = await requireEventRole(eventId, "admin");
    const { cfg } = allianceOf(event);
    const db = await getDb();
    const existing = await db.select({ id: matches.id, status: matches.status }).from(matches).where(eq(matches.eventId, eventId));
    if (existing.length && !input.replace) throw new UserError("Já existe um cronograma. Marque “substituir” para refazer (partidas com resultado são mantidas).");
    if (input.replace) await db.delete(matches).where(and(eq(matches.eventId, eventId), eq(matches.status, "scheduled")));

    const teamRows = await db.select({ id: teams.id }).from(teams).where(eq(teams.eventId, eventId));
    const perTeam = Math.round(Number(input.matchesPerTeam) || cfg.matchesPerTeam);
    if (perTeam < 1 || perTeam > 20) throw new UserError("Partidas por equipe: de 1 a 20.");
    let schedule;
    try {
      schedule = buildMatchSchedule({ teamIds: teamRows.map((t) => t.id), matchesPerTeam: perTeam, teamsPerAlliance: cfg.teamsPerAlliance, mode: cfg.mode });
    } catch (err) {
      throw new UserError((err as Error).message);
    }
    if (schedule.length > 400) throw new UserError("Cronograma grande demais (mais de 400 partidas).");

    const [{ top }] = await db.select({ top: max(matches.number) }).from(matches).where(eq(matches.eventId, eventId));
    const start = input.startIso ? new Date(input.startIso) : null;
    if (start && Number.isNaN(start.getTime())) throw new UserError("Horário inválido.");
    const cycle = Math.min(60, Math.max(1, Number(input.cycleMin) || 7));
    const fields = Math.min(8, Math.max(1, Math.round(Number(input.fields) || 1)));
    await db.insert(matches).values(
      schedule.map((m, i) => ({
        eventId,
        number: (top ?? 0) + i + 1,
        field: fields > 1 ? `Campo ${(i % fields) + 1}` : null,
        scheduledAt: start ? new Date(start.getTime() + i * cycle * 60_000) : null,
        red: m.red,
        blue: m.blue,
      })),
    );
    await db.insert(activity).values({ eventId, kind: "message", payload: { message: `Cronograma com ${schedule.length} partidas publicado` } });
    refresh(eventId);
    return { created: schedule.length };
  });
}

async function cleanSlots(eventId: string, cfg: AllianceConfig, red: string[], blue: string[]) {
  const db = await getDb();
  const valid = new Set((await db.select({ id: teams.id }).from(teams).where(eq(teams.eventId, eventId))).map((t) => t.id));
  const r = red.filter(Boolean);
  const b = cfg.mode === "versus" ? blue.filter(Boolean) : [];
  const all = [...r, ...b];
  if (all.some((id) => !valid.has(id))) throw new UserError("Equipe inválida.");
  if (new Set(all).size !== all.length) throw new UserError("Uma equipe não pode aparecer duas vezes na mesma partida.");
  if (r.length !== cfg.teamsPerAlliance || (cfg.mode === "versus" && b.length !== cfg.teamsPerAlliance))
    throw new UserError(`Cada aliança tem ${cfg.teamsPerAlliance} equipe(s).`);
  return { red: r, blue: b };
}

export interface MatchInput {
  red: string[];
  blue: string[];
  /** Equipes que jogam como surrogate (não conta para elas). */
  surrogates?: string[];
  startIso: string | null;
  field: string | null;
}

const toSlots = (ids: string[], surrogates: string[] = []): AllianceSlot[] =>
  ids.map((teamId) => (surrogates.includes(teamId) ? { teamId, surrogate: true } : { teamId }));

export async function addMatch(eventId: string, input: MatchInput) {
  return run(async () => {
    const { event } = await requireEventRole(eventId, "admin");
    const { cfg } = allianceOf(event);
    const { red, blue } = await cleanSlots(eventId, cfg, input.red, input.blue);
    const db = await getDb();
    const [{ top }] = await db.select({ top: max(matches.number) }).from(matches).where(eq(matches.eventId, eventId));
    const at = input.startIso ? new Date(input.startIso) : null;
    await db.insert(matches).values({
      eventId,
      number: (top ?? 0) + 1,
      field: cleanText(input.field, 30) || null,
      scheduledAt: at && !Number.isNaN(at.getTime()) ? at : null,
      red: toSlots(red, input.surrogates),
      blue: toSlots(blue, input.surrogates),
    });
    refresh(eventId);
    return null;
  });
}

export async function updateMatch(eventId: string, matchId: string, input: MatchInput) {
  return run(async () => {
    const { event } = await requireEventRole(eventId, "admin");
    const { cfg } = allianceOf(event);
    const { red, blue } = await cleanSlots(eventId, cfg, input.red, input.blue);
    const at = input.startIso ? new Date(input.startIso) : null;
    const db = await getDb();
    await db
      .update(matches)
      .set({
        red: toSlots(red, input.surrogates),
        blue: toSlots(blue, input.surrogates),
        field: cleanText(input.field, 30) || null,
        scheduledAt: at && !Number.isNaN(at.getTime()) ? at : null,
        updatedAt: new Date(),
      })
      .where(and(eq(matches.id, matchId), eq(matches.eventId, eventId)));
    refresh(eventId);
    return null;
  });
}

export async function deleteMatch(eventId: string, matchId: string) {
  return run(async () => {
    await requireEventRole(eventId, "admin");
    const db = await getDb();
    await db.delete(matches).where(and(eq(matches.id, matchId), eq(matches.eventId, eventId)));
    refresh(eventId);
    return null;
  });
}

/** Apaga as partidas sem resultado (e todas, se `all`). */
export async function clearMatches(eventId: string, all = false) {
  return run(async () => {
    await requireEventRole(eventId, "admin");
    const db = await getDb();
    await db.delete(matches).where(all ? eq(matches.eventId, eventId) : and(eq(matches.eventId, eventId), eq(matches.status, "scheduled")));
    refresh(eventId);
    return null;
  });
}

/* -------------------------------------------------------- resultados */

export interface MatchResultInput {
  matchId: string;
  red: unknown;
  blue: unknown;
  flags?: Record<string, string>;
  confirmed?: boolean;
}

function evaluateMatch(challenge: Challenge, cfg: AllianceConfig, match: MatchRow, input: MatchResultInput): MatchResult {
  const inMatch = new Set([...match.red, ...match.blue].map((s) => s.teamId));
  const flags: Record<string, TeamMatchFlag> = {};
  for (const [teamId, f] of Object.entries(input.flags ?? {})) if (inMatch.has(teamId) && (f === "noshow" || f === "dq")) flags[teamId] = f;
  const red = sanitizeCustomResponses(challenge, input.red);
  const blue = cfg.mode === "versus" ? sanitizeCustomResponses(challenge, input.blue) : null;
  try {
    return scoreMatch(challenge, cfg, red, blue, flags);
  } catch (err) {
    throw new UserError((err as Error).message);
  }
}

async function loadMatch(eventId: string, matchId: string) {
  const db = await getDb();
  const [m] = await db.select().from(matches).where(and(eq(matches.id, matchId), eq(matches.eventId, eventId))).limit(1);
  if (!m) throw new UserError("Partida não encontrada.");
  return m;
}

async function settingsOf(eventId: string) {
  const db = await getDb();
  const [s] = await db.select().from(eventSettings).where(eq(eventSettings.eventId, eventId)).limit(1);
  return s;
}

async function saveResult(event: EventRow, match: MatchRow, result: MatchResult, who: { by: string; label: string }, pending: boolean, confirmed: boolean, kind: "match" | "match_edit") {
  const db = await getDb();
  await db
    .update(matches)
    .set({
      result,
      redScore: result.red.score,
      blueScore: result.blue?.score ?? null,
      status: pending ? "pending" : "final",
      submittedBy: who.by,
      submittedByLabel: who.label,
      confirmedByTeams: confirmed,
      updatedAt: new Date(),
    })
    .where(eq(matches.id, match.id));
  const coop = !result.blue;
  const text = `${label(match.number)}: ${sideText({ redScore: result.red.score, blueScore: result.blue?.score ?? null }, coop)}`;
  await db.insert(activity).values({
    eventId: event.id,
    kind: pending ? "match_pending" : "match",
    payload: { message: kind === "match_edit" ? `Resultado revisado · ${text}` : text, round: label(match.number), by: who.label },
  });
}

/** Mesa (voluntário com código ou membro logado) lança o resultado de uma partida sem resultado. */
export async function submitMatch(eventId: string, input: MatchResultInput) {
  return run(async () => {
    const event = await getEventById(eventId);
    if (!event) throw new UserError("Evento não encontrado.");
    if (event.status !== "live") throw new UserError("O evento não está ao vivo.");
    const { challenge, cfg } = allianceOf(event);
    const scorer: ScorerIdentity | null = await getScorer(event);
    if (!scorer) throw new UserError("Sua sessão da mesa expirou ou o código foi desativado. Entre de novo.");
    const st = await settingsOf(eventId);
    if (st?.submissionsPaused && scorer.via === "code") throw new UserError("A organização pausou os envios. Aguarde a liberação.");
    if (st?.requireTeamConfirmation && !input.confirmed) throw new UserError("Peça para as alianças conferirem a súmula e marque a confirmação.");
    const match = await loadMatch(eventId, input.matchId);
    if (match.status !== "scheduled") throw new UserError(`${label(match.number)} já tem resultado (outra mesa enviou antes). Correções pelo hub.`);
    const result = evaluateMatch(challenge, cfg, match, input);
    const pending = !!st?.requireApproval && !(scorer.role === "admin" || scorer.role === "owner");

    // Só grava se ninguém lançou no meio do caminho.
    const db = await getDb();
    const claimed = await db
      .update(matches)
      .set({ status: pending ? "pending" : "final", updatedAt: new Date() })
      .where(and(eq(matches.id, match.id), eq(matches.status, "scheduled")))
      .returning({ id: matches.id });
    if (!claimed.length) throw new UserError(`${label(match.number)} acabou de receber resultado de outra mesa.`);
    await saveResult(event, match, result, scorer, pending, !!input.confirmed, "match");
    refresh(eventId);
    return { number: match.number, red: result.red.score, blue: result.blue?.score ?? null, pending };
  });
}

/** Organização corrige (ou lança) o resultado de qualquer partida. */
export async function editMatchResult(eventId: string, input: MatchResultInput) {
  return run(async () => {
    const { event, userId } = await requireScoreEditor(eventId);
    const { challenge, cfg } = allianceOf(event);
    const match = await loadMatch(eventId, input.matchId);
    const result = evaluateMatch(challenge, cfg, match, input);
    await saveResult(event, match, result, { by: userId, label: "Organização" }, false, match.confirmedByTeams, match.status === "scheduled" ? "match" : "match_edit");
    refresh(eventId);
    return { red: result.red.score, blue: result.blue?.score ?? null };
  });
}

export async function voidMatchResult(eventId: string, matchId: string) {
  return run(async () => {
    await requireScoreEditor(eventId);
    const db = await getDb();
    const match = await loadMatch(eventId, matchId);
    await db
      .update(matches)
      .set({ status: "scheduled", result: null, redScore: null, blueScore: null, submittedBy: null, submittedByLabel: null, confirmedByTeams: false, updatedAt: new Date() })
      .where(eq(matches.id, match.id));
    await db.insert(activity).values({ eventId, kind: "message", payload: { message: `${label(match.number)} será repetida` } });
    refresh(eventId);
    return null;
  });
}

export async function approveMatches(eventId: string, matchIds: string[] | "all") {
  return run(async () => {
    await requireScoreEditor(eventId);
    const db = await getDb();
    const pending = await db.select().from(matches).where(and(eq(matches.eventId, eventId), eq(matches.status, "pending")));
    const chosen = matchIds === "all" ? pending : pending.filter((m) => matchIds.includes(m.id));
    for (const m of chosen) {
      await db.update(matches).set({ status: "final", updatedAt: new Date() }).where(eq(matches.id, m.id));
      await db.insert(activity).values({ eventId, kind: "match", payload: { message: `${label(m.number)}: ${sideText(m, !m.result?.blue)}`, round: label(m.number) } });
    }
    refresh(eventId);
    return { approved: chosen.length };
  });
}

/** Súmulas completas de uma partida (para corrigir no hub). */
export async function getMatchDetail(eventId: string, matchId: string) {
  return run(async () => {
    await requireScoreEditor(eventId);
    const m = await loadMatch(eventId, matchId);
    return {
      red: m.result?.red.responses ?? {},
      blue: m.result?.blue?.responses ?? {},
      flags: m.result?.flags ?? {},
      by: m.submittedByLabel,
    };
  });
}
