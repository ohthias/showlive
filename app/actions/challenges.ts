"use server";

import { auth } from "@clerk/nextjs/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { activity, challengeTemplates, events, rounds, scores, userPreferences } from "@/db/schema";
import { requireEventRole } from "@/lib/access";
import { run, UserError } from "@/lib/action";
import { newId, sanitizeChallenge, type Challenge } from "@/lib/challenge";
import { defaultLeague, sanitizeLeague, type ObrLeague } from "@/lib/obr";
import { nudge } from "@/lib/live-hub";
import { DEFAULT_PREFS, type UserPrefs } from "@/lib/prefs";
import { rescoreMatches } from "@/lib/matches";

function validate(input: unknown): Challenge {
  try {
    return sanitizeChallenge(input);
  } catch (err) {
    throw new UserError((err as Error).message);
  }
}

/** Salva o desafio do evento. Se já houver notas, só vale para as próximas. */
export async function saveEventChallenge(eventId: string, input: unknown) {
  return run(async () => {
    const { event } = await requireEventRole(eventId, "admin");
    if (event.format !== "custom" && event.format !== "alliance") throw new UserError("Este evento usa as regras oficiais da liga.");
    const challenge = validate(input);
    if (event.format === "alliance" && !challenge.alliance) throw new UserError("Eventos de alianças precisam da configuração das alianças.");
    if (event.format === "custom" && challenge.alliance) throw new UserError("Este evento não é de alianças.");
    const db = await getDb();
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(scores).where(eq(scores.eventId, eventId));
    await db.update(events).set({ challenge }).where(eq(events.id, eventId));
    // Alianças: o placar das partidas já lançadas é refeito com a súmula nova.
    if (event.format === "alliance") await rescoreMatches({ ...event, challenge });
    if (n > 0) {
      await db.insert(activity).values({ eventId, kind: "challenge_edit", payload: { message: `Desafio alterado com ${n} nota(s) já lançada(s)` } });
    }
    nudge(eventId);
    revalidatePath(`/hub/${eventId}`, "layout");
    return { scored: n };
  });
}

/* ------------------------------------------------------- templates */

export async function saveTemplate(templateId: string | null, input: unknown) {
  return run(async () => {
    const { userId } = await auth();
    if (!userId) throw new UserError("Entre com sua conta RoboStage.");
    const definition = validate(input);
    const db = await getDb();
    if (templateId) {
      const updated = await db
        .update(challengeTemplates)
        .set({ name: definition.name, type: definition.type, definition, updatedAt: new Date() })
        .where(and(eq(challengeTemplates.id, templateId), eq(challengeTemplates.ownerId, userId)))
        .returning({ id: challengeTemplates.id });
      if (!updated.length) throw new UserError("Template não encontrado.");
      revalidatePath("/hub/templates", "layout");
      return { id: templateId };
    }
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(challengeTemplates)
      .where(eq(challengeTemplates.ownerId, userId));
    if (n >= 50) throw new UserError("Limite de 50 templates por conta.");
    const [row] = await db
      .insert(challengeTemplates)
      .values({ ownerId: userId, name: definition.name, type: definition.type, definition })
      .returning({ id: challengeTemplates.id });
    revalidatePath("/hub/templates", "layout");
    revalidatePath("/hub");
    return { id: row.id };
  });
}

export async function deleteTemplate(templateId: string) {
  return run(async () => {
    const { userId } = await auth();
    if (!userId) throw new UserError("Entre com sua conta RoboStage.");
    const db = await getDb();
    await db.delete(challengeTemplates).where(and(eq(challengeTemplates.id, templateId), eq(challengeTemplates.ownerId, userId)));
    revalidatePath("/hub/templates", "layout");
    return null;
  });
}

export async function duplicateTemplate(templateId: string) {
  return run(async () => {
    const { userId } = await auth();
    if (!userId) throw new UserError("Entre com sua conta RoboStage.");
    const db = await getDb();
    const [tpl] = await db
      .select()
      .from(challengeTemplates)
      .where(and(eq(challengeTemplates.id, templateId), eq(challengeTemplates.ownerId, userId)))
      .limit(1);
    if (!tpl) throw new UserError("Template não encontrado.");
    const definition = { ...tpl.definition, name: `${tpl.definition.name} (cópia)`.slice(0, 60) };
    const [row] = await db
      .insert(challengeTemplates)
      .values({ ownerId: userId, name: definition.name, type: tpl.type, definition })
      .returning({ id: challengeTemplates.id });
    revalidatePath("/hub/templates", "layout");
    return { id: row.id };
  });
}

export async function listMyTemplates() {
  const { userId } = await auth();
  if (!userId) return [];
  const db = await getDb();
  return db
    .select({ id: challengeTemplates.id, name: challengeTemplates.name, type: challengeTemplates.type, updatedAt: challengeTemplates.updatedAt })
    .from(challengeTemplates)
    .where(eq(challengeTemplates.ownerId, userId))
    .orderBy(desc(challengeTemplates.updatedAt));
}

/* ---------------------------------------------------- preferências */

export async function savePreferences(patch: Partial<UserPrefs>) {
  return run(async () => {
    const { userId } = await auth();
    if (!userId) throw new UserError("Entre com sua conta RoboStage.");
    const clean: Partial<UserPrefs> = {};
    for (const [k, def] of Object.entries(DEFAULT_PREFS) as [keyof UserPrefs, unknown][]) {
      const v = patch[k];
      if (v === undefined) continue;
      if (typeof def === "boolean" && typeof v === "boolean") (clean as Record<string, unknown>)[k] = v;
      if (typeof def === "number" && Number.isFinite(Number(v))) (clean as Record<string, unknown>)[k] = Number(v);
      if (typeof def === "string" && typeof v === "string") (clean as Record<string, unknown>)[k] = v.slice(0, 40);
    }
    if (clean.defaultRounds !== undefined) clean.defaultRounds = Math.min(8, Math.max(1, Math.round(clean.defaultRounds)));
    if (clean.defaultTimerSec !== undefined) clean.defaultTimerSec = Math.min(3600, Math.max(10, Math.round(clean.defaultTimerSec)));
    if (clean.defaultMesaCount !== undefined) clean.defaultMesaCount = Math.min(10, Math.max(1, Math.round(clean.defaultMesaCount)));
    if (clean.defaultFormat && !["fll", "fll_fe", "obr", "custom", "alliance"].includes(clean.defaultFormat)) delete clean.defaultFormat;
    if (clean.defaultRankingMode && !["best", "sum"].includes(clean.defaultRankingMode)) delete clean.defaultRankingMode;

    const db = await getDb();
    const [row] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
    const prefs = { ...(row?.prefs ?? {}), ...clean };
    await db
      .insert(userPreferences)
      .values({ userId, prefs })
      .onConflictDoUpdate({ target: userPreferences.userId, set: { prefs, updatedAt: new Date() } });
    revalidatePath("/hub", "layout");
    return null;
  });
}

/* --------------------------------------------- OBR: arenas e extras */

/** Mantém uma rodada "extra" para cada desafio extra da liga. */
async function syncExtraRounds(eventId: string, league: ObrLeague) {
  const db = await getDb();
  const existing = await db.select().from(rounds).where(and(eq(rounds.eventId, eventId), eq(rounds.kind, "extra")));
  const wanted = new Map(league.extras.map((x, i) => [x.id, { x, i }]));
  let removedScores = 0;
  for (const r of existing) {
    const w = r.meta?.extraId ? wanted.get(r.meta.extraId) : undefined;
    if (!w) {
      const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(scores).where(eq(scores.roundId, r.id));
      removedScores += n;
      await db.delete(rounds).where(eq(rounds.id, r.id));
    } else {
      wanted.delete(r.meta!.extraId!);
      await db
        .update(rounds)
        .set({ name: `Extra · ${w.x.name}`.slice(0, 40), position: 2000 + w.i })
        .where(eq(rounds.id, r.id));
    }
  }
  for (const { x, i } of wanted.values()) {
    await db
      .insert(rounds)
      .values({ eventId, name: `Extra · ${x.name}`.slice(0, 40), position: 2000 + i, kind: "extra", meta: { extraId: x.id } })
      .onConflictDoNothing();
  }
  return removedScores;
}

export async function saveArenas(eventId: string, arenas: unknown) {
  return run(async () => {
    const { event } = await requireEventRole(eventId, "admin");
    if (event.format !== "obr") throw new UserError("Arenas são da OBR Resgate.");
    let league: ObrLeague;
    try {
      league = sanitizeLeague({ ...(event.league ?? defaultLeague()), arenas });
    } catch (err) {
      throw new UserError((err as Error).message);
    }
    const db = await getDb();
    await db.update(events).set({ league }).where(eq(events.id, eventId));
    // garante que as 3 rodadas apontam para as 3 arenas, na ordem
    const quals = await db.select().from(rounds).where(and(eq(rounds.eventId, eventId), eq(rounds.kind, "qualifying")));
    quals.sort((a, b) => a.position - b.position);
    for (const [i, r] of quals.entries()) {
      const arena = league.arenas[i];
      if (arena && r.meta?.arenaId !== arena.id) await db.update(rounds).set({ meta: { arenaId: arena.id } }).where(eq(rounds.id, r.id));
    }
    nudge(eventId);
    revalidatePath(`/hub/${eventId}`, "layout");
    return null;
  });
}

export async function saveExtraChallenge(eventId: string, extraId: string | null, input: unknown) {
  return run(async () => {
    const { event } = await requireEventRole(eventId, "admin");
    if (event.format !== "obr") throw new UserError("Desafios extras são da OBR Resgate.");
    const challenge = validate(input);
    const league = event.league ?? defaultLeague();
    const id = extraId ?? newId("x");
    const extras = extraId
      ? league.extras.map((x) => (x.id === extraId ? { ...challenge, id } : x))
      : [...league.extras, { ...challenge, id }];
    if (extras.length > 8) throw new UserError("Limite de 8 desafios extras.");
    const next = { ...league, extras };
    const db = await getDb();
    await db.update(events).set({ league: next }).where(eq(events.id, eventId));
    await syncExtraRounds(eventId, next);
    nudge(eventId);
    revalidatePath(`/hub/${eventId}`, "layout");
    return { id };
  });
}

export async function deleteExtraChallenge(eventId: string, extraId: string) {
  return run(async () => {
    const { event } = await requireEventRole(eventId, "admin");
    if (event.format !== "obr" || !event.league) throw new UserError("Desafio não encontrado.");
    const next = { ...event.league, extras: event.league.extras.filter((x) => x.id !== extraId) };
    const db = await getDb();
    await db.update(events).set({ league: next }).where(eq(events.id, eventId));
    const removed = await syncExtraRounds(eventId, next);
    nudge(eventId);
    revalidatePath(`/hub/${eventId}`, "layout");
    return { removedScores: removed };
  });
}
