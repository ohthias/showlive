import "server-only";
import { auth } from "@clerk/nextjs/server";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  eventSettings,
  events,
  judgingRooms,
  judgingSessions,
  rubricEvaluations,
  rubrics,
  teams,
  type EventRow,
} from "@/db/schema";
import { getIdentity, getMembership, hasRole, type MemberRole } from "./access";
import { readJudgeSession } from "./referee";
import { roomRubrics } from "./rubric";

/**
 * Quem pode avaliar nas salas:
 *  - membro do evento logado (dono, admin ou apurador) — qualquer sala, a
 *    qualquer momento (inclusive antes de o evento ficar ao vivo);
 *  - avaliador com código de sala — só a própria sala, só com o evento ao vivo.
 * Com as avaliações travadas, só admins alteram fichas.
 */

export interface JudgeIdentity {
  by: string;
  label: string;
  via: "member" | "code";
  role?: MemberRole;
  /** Avaliador por código fica preso a uma sala. */
  roomId: string | null;
}

export async function getJudge(event: EventRow): Promise<JudgeIdentity | null> {
  const { userId } = await auth();
  if (userId) {
    const role = await getMembership(event.id, userId);
    if (role) {
      const me = await getIdentity();
      return { by: userId, label: me?.name ?? "Organização", via: "member", role, roomId: null };
    }
  }

  if (event.status !== "live") return null;
  const session = await readJudgeSession();
  if (!session || session.eventId !== event.id) return null;
  const db = await getDb();
  const [room] = await db
    .select({ id: judgingRooms.id, name: judgingRooms.name, active: judgingRooms.active, code: judgingRooms.code })
    .from(judgingRooms)
    .where(and(eq(judgingRooms.id, session.roomId), eq(judgingRooms.eventId, event.id)))
    .limit(1);
  if (!room?.active || !room.code || room.code !== session.code) return null;
  const label = session.name ? `${room.name} · ${session.name}` : room.name;
  return { by: `room:${room.id}`, label, via: "code", roomId: room.id };
}

export async function judgingSettings(eventId: string) {
  const db = await getDb();
  const [s] = await db
    .select({
      locked: eventSettings.judgingLocked,
      includeRobotGame: eventSettings.judgingIncludeRobotGame,
      robotGameWeight: eventSettings.judgingRobotGameWeight,
    })
    .from(eventSettings)
    .where(eq(eventSettings.eventId, eventId))
    .limit(1);
  return { locked: s?.locked ?? false, includeRobotGame: s?.includeRobotGame ?? false, robotGameWeight: s?.robotGameWeight ?? 1 };
}

export function judgeCanEdit(judge: JudgeIdentity, locked: boolean) {
  return !locked || hasRole(judge.role ?? null, "admin");
}

export async function loadRubrics(eventId: string) {
  const db = await getDb();
  return db.select().from(rubrics).where(eq(rubrics.eventId, eventId)).orderBy(asc(rubrics.position), asc(rubrics.createdAt));
}

export async function loadRooms(eventId: string) {
  const db = await getDb();
  return db.select().from(judgingRooms).where(eq(judgingRooms.eventId, eventId)).orderBy(asc(judgingRooms.createdAt));
}

/** Cronograma com equipe e o andamento das fichas (sem o conteúdo delas). */
export async function loadSessions(eventId: string, roomId?: string) {
  const db = await getDb();
  const where = roomId
    ? and(eq(judgingSessions.eventId, eventId), eq(judgingSessions.roomId, roomId))
    : eq(judgingSessions.eventId, eventId);
  const [rows, evals] = await Promise.all([
    db
      .select({
        id: judgingSessions.id,
        teamId: judgingSessions.teamId,
        roomId: judgingSessions.roomId,
        startsAt: judgingSessions.startsAt,
        durationMin: judgingSessions.durationMin,
        status: judgingSessions.status,
        notes: judgingSessions.notes,
        teamName: teams.name,
        teamNumber: teams.number,
        teamOrg: teams.organization,
      })
      .from(judgingSessions)
      .innerJoin(teams, eq(teams.id, judgingSessions.teamId))
      .where(where)
      .orderBy(asc(judgingSessions.startsAt), asc(teams.name)),
    db
      .select({ sessionId: rubricEvaluations.sessionId, rubricId: rubricEvaluations.rubricId, status: rubricEvaluations.status })
      .from(rubricEvaluations)
      .where(eq(rubricEvaluations.eventId, eventId)),
  ]);
  const bySession = new Map<string, { rubricId: string; status: "draft" | "submitted" }[]>();
  for (const e of evals) bySession.set(e.sessionId, [...(bySession.get(e.sessionId) ?? []), { rubricId: e.rubricId, status: e.status }]);
  return rows.map((r) => ({ ...r, startsAt: r.startsAt?.toISOString() ?? null, sheets: bySession.get(r.id) ?? [] }));
}

export type SessionListItem = Awaited<ReturnType<typeof loadSessions>>[number];

/** Tudo o que a tela de avaliação de uma sessão precisa. */
export async function loadSessionForJudging(eventId: string, sessionId: string) {
  const db = await getDb();
  const [session] = await db
    .select({
      id: judgingSessions.id,
      teamId: judgingSessions.teamId,
      roomId: judgingSessions.roomId,
      startsAt: judgingSessions.startsAt,
      durationMin: judgingSessions.durationMin,
      status: judgingSessions.status,
      notes: judgingSessions.notes,
      teamName: teams.name,
      teamNumber: teams.number,
      teamOrg: teams.organization,
    })
    .from(judgingSessions)
    .innerJoin(teams, eq(teams.id, judgingSessions.teamId))
    .where(and(eq(judgingSessions.id, sessionId), eq(judgingSessions.eventId, eventId)))
    .limit(1);
  if (!session) return null;

  const [allRubrics, roomRow, evals] = await Promise.all([
    loadRubrics(eventId),
    session.roomId
      ? db.select().from(judgingRooms).where(eq(judgingRooms.id, session.roomId)).limit(1)
      : Promise.resolve([] as (typeof judgingRooms.$inferSelect)[]),
    db.select().from(rubricEvaluations).where(eq(rubricEvaluations.sessionId, sessionId)),
  ]);
  const room = roomRow[0] ?? null;
  const applied = roomRubrics(allRubrics, room?.rubricIds);
  return { session: { ...session, startsAt: session.startsAt?.toISOString() ?? null }, room, rubrics: applied, evaluations: evals };
}

/**
 * Avaliador que entrou com código de sala (tela /banca). Ignora o login do
 * Clerk de propósito: a tela da sala mostra só a sala do código.
 */
export async function getCodeJudge() {
  const session = await readJudgeSession();
  if (!session) return null;
  const db = await getDb();
  const [event] = await db.select().from(events).where(eq(events.id, session.eventId)).limit(1);
  if (!event || event.status !== "live") return null;
  const [room] = await db
    .select()
    .from(judgingRooms)
    .where(and(eq(judgingRooms.id, session.roomId), eq(judgingRooms.eventId, event.id)))
    .limit(1);
  if (!room?.active || !room.code || room.code !== session.code) return null;
  const judge: JudgeIdentity = { by: `room:${room.id}`, label: session.name ? `${room.name} · ${session.name}` : room.name, via: "code", roomId: room.id };
  return { event, room, judge, name: session.name };
}
