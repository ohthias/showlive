import "server-only";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { accessCodes, challengeTemplates, eventMembers, events, scores, teams, userPreferences } from "@/db/schema";
import { mergePrefs } from "./prefs";
import { AccessError, requireEventRole, type MemberRole } from "./access";

export async function listMyEvents(userId: string) {
  const db = await getDb();
  const rows = await db
    .select({
      id: events.id,
      name: events.name,
      code: events.code,
      season: events.season,
      status: events.status,
      theme: events.theme,
      format: events.format,
      challenge: events.challenge,
      updatedAt: events.updatedAt,
      role: eventMembers.role,
    })
    .from(eventMembers)
    .innerJoin(events, eq(events.id, eventMembers.eventId))
    .where(sql`${eventMembers.userId} = ${userId} and ${eventMembers.status} = 'active'`)
    .orderBy(desc(events.updatedAt));

  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [teamCounts, scoreCounts] = await Promise.all([
    db
      .select({ eventId: teams.eventId, n: sql<number>`count(*)::int` })
      .from(teams)
      .where(inArray(teams.eventId, ids))
      .groupBy(teams.eventId),
    db
      .select({ eventId: scores.eventId, n: sql<number>`count(*)::int` })
      .from(scores)
      .where(inArray(scores.eventId, ids))
      .groupBy(scores.eventId),
  ]);
  const tc = new Map(teamCounts.map((r) => [r.eventId, r.n]));
  const sc = new Map(scoreCounts.map((r) => [r.eventId, r.n]));
  return rows.map((r) => ({ ...r, teams: tc.get(r.id) ?? 0, scores: sc.get(r.id) ?? 0 }));
}

/** Carrega o evento para as páginas do hub (memoizado por requisição). */
export const loadHubEvent = cache(async (eventId: string, min: MemberRole = "scorer") => {
  const { userId } = await auth();
  if (!userId) redirect("/");
  try {
    return await requireEventRole(eventId, min);
  } catch (err) {
    if (err instanceof AccessError) notFound();
    throw err;
  }
});

export async function loadAccess(eventId: string) {
  const db = await getDb();
  const [codes, members] = await Promise.all([
    db.select().from(accessCodes).where(eq(accessCodes.eventId, eventId)).orderBy(asc(accessCodes.createdAt)),
    db.select().from(eventMembers).where(eq(eventMembers.eventId, eventId)).orderBy(asc(eventMembers.createdAt)),
  ]);
  return { codes, members };
}

export async function refereeCodes(eventId: string) {
  const db = await getDb();
  return db
    .select({ id: accessCodes.id, code: accessCodes.code, label: accessCodes.label, active: accessCodes.active })
    .from(accessCodes)
    .where(eq(accessCodes.eventId, eventId))
    .orderBy(asc(accessCodes.createdAt));
}

export async function loadPrefs(userId: string) {
  const db = await getDb();
  const [row] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  return mergePrefs(row?.prefs);
}

export async function loadTemplates(userId: string) {
  const db = await getDb();
  return db
    .select()
    .from(challengeTemplates)
    .where(eq(challengeTemplates.ownerId, userId))
    .orderBy(desc(challengeTemplates.updatedAt));
}
