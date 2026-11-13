"use server";

import { auth } from "@clerk/nextjs/server";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import {
  accessCodes,
  activity,
  challengeTemplates,
  eventMembers,
  eventSettings,
  events,
  rounds,
  scores,
  teams,
  userPreferences,
} from "@/db/schema";
import { blankChallenge, CHALLENGE_PRESETS, CHALLENGE_TYPES, type Challenge, type ChallengeType } from "@/lib/challenge";
import { clearLiveCodes, generateLiveCodes } from "@/lib/code-lifecycle";
import { mergePrefs } from "@/lib/prefs";
import { futureEditionChallenge } from "@/lib/future-edition";
import { defaultLeague, sanitizeLeague, type ObrLeague } from "@/lib/obr";
import { getIdentity, requireEventRole } from "@/lib/access";
import { cleanText, run, UserError } from "@/lib/action";
import { uniqueCode } from "@/lib/unique-code";
import { nudge } from "@/lib/live-hub";
import { isSeason } from "@/lib/missions";
import { THEME_PRESETS, themeForSeason } from "@/lib/themes";

export interface CreateEventInput {
  name: string;
  format: "fll" | "fll_fe" | "obr" | "custom";
  season?: string;
  /** Desafio personalizado: modelo pronto (preset), template salvo, ou em branco por tipo. */
  source?: { kind: "preset"; id: string } | { kind: "template"; id: string } | { kind: "blank"; type: ChallengeType };
  roundCount: number;
}

export async function createEvent(input: CreateEventInput) {
  return run(async () => {
    const { userId } = await auth();
    if (!userId) throw new UserError("Entre com sua conta RoboStage para criar eventos.");
    const me = await getIdentity();
    const db = await getDb();
    const [prefRow] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
    const prefs = mergePrefs(prefRow?.prefs);

    const name = cleanText(input.name, 80);
    if (name.length < 3) throw new UserError("Dê um nome com pelo menos 3 letras.");
    const roundCount = Math.min(8, Math.max(1, Math.round(Number(input.roundCount) || prefs.defaultRounds)));

    let season = "custom";
    let challenge: Challenge | null = null;
    let templateId: string | null = null;
    let league: ObrLeague | null = null;
    const format = (["fll", "fll_fe", "obr", "custom"] as const).includes(input.format) ? input.format : "fll";

    if (format === "fll_fe") {
      season = "bioglow-fe";
      challenge = futureEditionChallenge();
    } else if (format === "obr") {
      season = "obr-resgate";
      league = defaultLeague();
    } else if (format === "custom") {
      const src = input.source ?? { kind: "blank", type: "missions" as ChallengeType };
      if (src.kind === "preset") {
        const preset = CHALLENGE_PRESETS.find((p) => p.id === src.id);
        if (!preset) throw new UserError("Modelo não encontrado.");
        challenge = structuredClone(preset.challenge);
      } else if (src.kind === "template") {
        const [tpl] = await db
          .select()
          .from(challengeTemplates)
          .where(and(eq(challengeTemplates.id, src.id), eq(challengeTemplates.ownerId, userId)))
          .limit(1);
        if (!tpl) throw new UserError("Template não encontrado.");
        challenge = tpl.definition;
        templateId = tpl.id;
      } else {
        challenge = blankChallenge(src.type in CHALLENGE_TYPES ? src.type : "missions", name);
      }
    } else {
      season = input.season && isSeason(input.season) ? input.season : prefs.defaultSeason;
      if (!isSeason(season)) throw new UserError("Escolha uma temporada.");
    }

    // "season" (ou tema desconhecido) = tema da temporada FLL / padrão RoboStage.
    const preset = THEME_PRESETS.find((t) => t.id === prefs.defaultTheme);
    const theme = format === "obr" && !preset ? themeForSeason("obr") : (preset?.theme ?? themeForSeason(season));

    // Sem código: ele só é gerado quando o evento ficar ao vivo.
    const [event] = await db
      .insert(events)
      .values({
        code: null,
        name,
        ownerId: userId,
        format,
        season,
        challenge,
        templateId,
        league,
        theme,
        // OBR: rodada de 5 minutos.
        timerDurationSec: format === "obr" ? 300 : Math.min(3600, Math.max(10, prefs.defaultTimerSec)),
      })
      .returning({ id: events.id });

    await Promise.all([
      db.insert(eventSettings).values({
        eventId: event.id,
        // OBR: soma das 2 maiores notas (manual oficial).
        rankingMode: format === "obr" ? "best2" : prefs.defaultRankingMode,
        hideScoresUntilRoundEnds: prefs.defaultHideScores,
        showTimer: prefs.defaultShowTimer,
        celebrateScores: prefs.defaultCelebrate,
      }),
      db.insert(rounds).values(
        league
          ? // OBR: uma rodada por arena.
            league.arenas.map((a, i) => ({ eventId: event.id, name: `Rodada ${i + 1}`, position: i + 1, meta: { arenaId: a.id } }))
          : Array.from({ length: roundCount }, (_, i) => ({ eventId: event.id, name: `Round ${i + 1}`, position: i + 1 })),
      ),
      db.insert(eventMembers).values({
        eventId: event.id,
        userId,
        email: me?.email || `${userId}@clerk`,
        name: me?.name ?? null,
        role: "owner",
      }),
      db.insert(accessCodes).values(
        Array.from({ length: Math.min(10, Math.max(1, prefs.defaultMesaCount)) }, (_, i) => ({
          eventId: event.id,
          label: `Mesa ${i + 1}`,
          code: null,
        })),
      ),
      db.insert(activity).values({ eventId: event.id, kind: "event_created", payload: { by: me?.name } }),
    ]);

    revalidatePath("/hub");
    return { id: event.id, format };
  });
}

export async function updateEventBasics(eventId: string, input: { name: string; season: string }) {
  return run(async () => {
    const { event } = await requireEventRole(eventId, "admin");
    const name = cleanText(input.name, 80);
    if (name.length < 3) throw new UserError("Dê um nome com pelo menos 3 letras.");
    if (event.format === "fll" && !isSeason(input.season)) throw new UserError("Temporada inválida.");
    if (event.format !== "fll") input.season = event.season;

    const db = await getDb();
    if (input.season !== event.season) {
      const [scored] = await db.select({ id: scores.id }).from(scores).where(eq(scores.eventId, eventId)).limit(1);
      if (scored) throw new UserError("Já existem notas lançadas. Zere as pontuações antes de trocar a temporada.");
    }
    await db.update(events).set({ name, season: input.season }).where(eq(events.id, eventId));
    nudge(eventId);
    revalidatePath(`/hub/${eventId}`, "layout");
    return null;
  });
}

export async function setEventStatus(eventId: string, status: "draft" | "live" | "finished") {
  return run(async () => {
    const { event } = await requireEventRole(eventId, "admin");
    if (!["draft", "live", "finished"].includes(status)) throw new UserError("Status inválido.");
    if (status === event.status) return null;
    const db = await getDb();
    if (status === "live") {
      const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(teams).where(eq(teams.eventId, eventId));
      if (!n) throw new UserError("Cadastre pelo menos uma equipe antes de colocar o evento ao vivo.");
      if (event.format === "custom" && !event.challenge) throw new UserError("Monte o desafio antes de ir ao vivo.");
      if (event.format === "obr") {
        try {
          sanitizeLeague(event.league);
        } catch (err) {
          throw new UserError(`Revise as arenas: ${(err as Error).message}`);
        }
      }
    }
    await db.update(events).set({ status }).where(eq(events.id, eventId));
    // Códigos: nascem na ativação e morrem quando o evento sai do ar.
    if (status === "live") await generateLiveCodes(eventId, event.ownerId);
    else await clearLiveCodes(eventId);
    const message = { draft: "Evento em preparação", live: "Evento ao vivo!", finished: "Evento encerrado" }[status];
    await db.insert(activity).values({ eventId, kind: "message", payload: { message } });
    nudge(eventId);
    revalidatePath(`/hub/${eventId}`, "layout");
    revalidatePath("/hub");
    return null;
  });
}

export async function regeneratePublicCode(eventId: string) {
  return run(async () => {
    const { event } = await requireEventRole(eventId, "admin");
    if (event.status !== "live") throw new UserError("O código só existe com o evento ao vivo.");
    const db = await getDb();
    const code = await uniqueCode();
    await db.update(events).set({ code }).where(eq(events.id, eventId));
    revalidatePath(`/hub/${eventId}`, "layout");
    return { code };
  });
}

export async function resetScores(eventId: string) {
  return run(async () => {
    const { userId } = await requireEventRole(eventId, "admin");
    const db = await getDb();
    await db.delete(scores).where(eq(scores.eventId, eventId));
    await db.insert(activity).values({ eventId, kind: "scores_reset", payload: { by: userId } });
    nudge(eventId);
    revalidatePath(`/hub/${eventId}`, "layout");
    return null;
  });
}

export async function deleteAllTeams(eventId: string) {
  return run(async () => {
    await requireEventRole(eventId, "admin");
    const db = await getDb();
    await db.delete(teams).where(eq(teams.eventId, eventId));
    nudge(eventId);
    revalidatePath(`/hub/${eventId}`, "layout");
    return null;
  });
}

export async function deleteEvent(eventId: string, confirmName: string) {
  return run(async () => {
    const { event } = await requireEventRole(eventId, "owner");
    if (cleanText(confirmName, 80) !== event.name) throw new UserError("Digite o nome do evento exatamente como está.");
    const db = await getDb();
    await db.delete(events).where(eq(events.id, eventId));
    nudge(eventId);
    revalidatePath("/hub");
    return null;
  });
}

/** Sai de um evento em que você é admin/apurador (o dono não pode sair). */
export async function leaveEvent(eventId: string) {
  return run(async () => {
    const { userId, role } = await requireEventRole(eventId, "scorer");
    if (role === "owner") throw new UserError("O dono não pode sair do próprio evento.");
    const db = await getDb();
    await db
      .delete(eventMembers)
      .where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.userId, userId)));
    revalidatePath("/hub");
    return null;
  });
}
