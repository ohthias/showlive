"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { activity, eventSettings, events, rounds, scores, teams, type EventTheme } from "@/db/schema";
import { getScorer, requireEventRole } from "@/lib/access";
import { run, UserError } from "@/lib/action";
import { nudge } from "@/lib/live-hub";
import type { LiveSettings } from "@/lib/live-types";
import { getEventById } from "@/lib/snapshot";
import { sanitizeTheme } from "@/lib/themes";
import { timerRemaining } from "@/lib/timer";

const BOOL_KEYS = [
  "showOnlyCurrentRound",
  "showMissionImages",
  "enablePlayoffs",
  "hideScoresUntilRoundEnds",
  "highlightLeader",
  "showBrackets",
  "showTicker",
  "showTimer",
  "celebrateScores",
  "submissionsPaused",
  "requireTeamConfirmation",
  "volunteersControlTimer",
  "volunteersSeeRanking",
  "requireApproval",
  "scorersCanEdit",
  "showTeamDetails",
  "showQrCode",
] as const;

async function ensurePlayoffRounds(eventId: string, format: "final" | "semifinal") {
  const db = await getDb();
  const existing = await db.select({ kind: rounds.kind }).from(rounds).where(eq(rounds.eventId, eventId));
  const kinds = new Set(existing.map((r) => r.kind));
  const toAdd: (typeof rounds.$inferInsert)[] = [];
  if (format === "semifinal" && !kinds.has("semifinal"))
    toAdd.push({ eventId, name: "Semifinal", position: 1000, kind: "semifinal" });
  if (!kinds.has("final")) toAdd.push({ eventId, name: "Final", position: 1001, kind: "final" });
  if (toAdd.length) await db.insert(rounds).values(toAdd).onConflictDoNothing();
}

export async function updateSettings(eventId: string, patch: Partial<LiveSettings>) {
  return run(async () => {
    await requireEventRole(eventId, "admin");
    const values: Partial<typeof eventSettings.$inferInsert> = {};
    for (const key of BOOL_KEYS) if (typeof patch[key] === "boolean") values[key] = patch[key];
    if (patch.rankingMode === "best" || patch.rankingMode === "sum" || patch.rankingMode === "best2") values.rankingMode = patch.rankingMode;
    if (patch.playoffFormat === "final" || patch.playoffFormat === "semifinal") values.playoffFormat = patch.playoffFormat;
    if (patch.rowsPerPage !== undefined) values.rowsPerPage = Math.min(30, Math.max(5, Math.round(Number(patch.rowsPerPage) || 10)));
    if (patch.refereeEditWindowMin !== undefined)
      values.refereeEditWindowMin = Math.min(60, Math.max(0, Math.round(Number(patch.refereeEditWindowMin) || 0)));
    if (patch.mesaNotice !== undefined) {
      const t = String(patch.mesaNotice ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
      values.mesaNotice = t || null;
    }
    if (!Object.keys(values).length) throw new UserError("Nada para salvar.");

    const db = await getDb();
    const [saved] = await db
      .insert(eventSettings)
      .values({ eventId, ...values })
      .onConflictDoUpdate({ target: eventSettings.eventId, set: { ...values, updatedAt: new Date() } })
      .returning();

    if (saved.enablePlayoffs) await ensurePlayoffRounds(eventId, saved.playoffFormat);
    // Desligou a aprovação: as pendentes viram aprovadas (e aparecem no telão).
    if (patch.requireApproval === false) {
      const pending = await db
        .select({ id: scores.id, points: scores.points, team: teams.name, round: rounds.name })
        .from(scores)
        .innerJoin(teams, eq(teams.id, scores.teamId))
        .innerJoin(rounds, eq(rounds.id, scores.roundId))
        .where(and(eq(scores.eventId, eventId), eq(scores.status, "pending")));
      for (const p of pending) {
        await db.update(scores).set({ status: "approved", updatedAt: new Date() }).where(eq(scores.id, p.id));
        await db.insert(activity).values({ eventId, kind: "score", payload: { team: p.team, round: p.round, points: p.points, by: "Aprovada" } });
      }
    }
    if (patch.submissionsPaused !== undefined) {
      await db.insert(activity).values({
        eventId,
        kind: "message",
        payload: { message: patch.submissionsPaused ? "Envios das mesas pausados" : "Envios das mesas liberados" },
      });
    }

    nudge(eventId);
    revalidatePath(`/hub/${eventId}`, "layout");
    return null;
  });
}

export async function updateTheme(eventId: string, theme: Partial<EventTheme>) {
  return run(async () => {
    const { event } = await requireEventRole(eventId, "admin");
    const db = await getDb();
    await db.update(events).set({ theme: sanitizeTheme(theme, event.theme) }).where(eq(events.id, eventId));
    nudge(eventId);
    revalidatePath(`/hub/${eventId}`, "layout");
    return null;
  });
}

/** Mensagem rápida no letreiro do telão ("Intervalo de 15 minutos"). */
export async function postMessage(eventId: string, message: string) {
  return run(async () => {
    await requireEventRole(eventId, "admin");
    const text = message.replace(/\s+/g, " ").trim().slice(0, 140);
    if (!text) throw new UserError("Escreva a mensagem.");
    const db = await getDb();
    await db.insert(activity).values({ eventId, kind: "message", payload: { message: text } });
    // atividade não tem gatilho: força a revisão pelo próprio evento
    await db.update(events).set({ updatedAt: new Date() }).where(eq(events.id, eventId));
    nudge(eventId);
    return null;
  });
}

/**
 * Cronômetro compartilhado. Qualquer pessoa da organização ou da mesa pode
 * controlar (como na versão anterior). O servidor só guarda "quando começou"
 * e "quanto faltava"; cada tela calcula o resto.
 */
export async function controlTimer(
  eventId: string,
  action: "start" | "pause" | "reset" | "duration",
  durationSec?: number,
) {
  return run(async () => {
    const event = await getEventById(eventId);
    if (!event) throw new UserError("Evento não encontrado.");
    const scorer = await getScorer(event);
    if (!scorer) throw new UserError("Sem permissão para controlar o cronômetro.");
    if (scorer.via === "code") {
      const db0 = await getDb();
      const [st] = await db0.select({ ok: eventSettings.volunteersControlTimer }).from(eventSettings).where(eq(eventSettings.eventId, eventId)).limit(1);
      if (st && !st.ok) throw new UserError("O cronômetro é controlado pela organização neste evento.");
    }

    const now = Date.now();
    const state = {
      durationSec: event.timerDurationSec,
      startedAt: event.timerStartedAt?.getTime() ?? null,
      remainingMs: event.timerRemainingMs,
    };
    const remaining = timerRemaining(state, now);
    let set: Partial<typeof events.$inferInsert> = {};

    if (action === "start") {
      if (state.startedAt !== null && remaining > 0) return null;
      const from = remaining > 0 ? remaining : event.timerDurationSec * 1000;
      set = { timerStartedAt: new Date(now), timerRemainingMs: from };
    } else if (action === "pause") {
      if (state.startedAt === null) return null;
      set = { timerStartedAt: null, timerRemainingMs: remaining };
    } else if (action === "reset") {
      set = { timerStartedAt: null, timerRemainingMs: null };
    } else if (action === "duration") {
      const sec = Math.min(60 * 60, Math.max(10, Math.round(Number(durationSec) || 150)));
      set = { timerDurationSec: sec, timerStartedAt: null, timerRemainingMs: null };
    }

    const db = await getDb();
    await db.update(events).set(set).where(and(eq(events.id, eventId)));
    nudge(eventId);
    return null;
  });
}
