import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { accessCodes, eventMembers, eventSettings, events, type EventRow } from "@/db/schema";
import { readRefereeSession } from "./referee";

/**
 * Quem pode fazer o quê.
 *
 * - Conta RoboStage (Clerk, mesma instância do site principal) + vínculo em
 *   event_members → hub de administração. owner > admin > scorer.
 * - Código da mesa → cookie assinado → só lançar notas.
 * - Código público → telão, sem login.
 */

export type MemberRole = "owner" | "admin" | "scorer";
const RANK: Record<MemberRole, number> = { scorer: 1, admin: 2, owner: 3 };

export class AccessError extends Error {}

export async function getIdentity() {
  const user = await currentUser();
  if (!user) return null;
  const email = (
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    ""
  ).toLowerCase();
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || email.split("@")[0];
  return { userId: user.id, email, name, imageUrl: user.imageUrl };
}

/** Convites feitos por e-mail viram vínculo ativo quando a pessoa entra. */
export async function claimPendingInvites(userId: string, email: string, name: string) {
  if (!email) return;
  const db = await getDb();
  await db
    .update(eventMembers)
    .set({ userId, name, status: "active" })
    .where(and(eq(eventMembers.email, email), isNull(eventMembers.userId)));
}

export async function getMembership(eventId: string, userId: string) {
  const db = await getDb();
  const [row] = await db
    .select({ role: eventMembers.role })
    .from(eventMembers)
    .where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.userId, userId), eq(eventMembers.status, "active")))
    .limit(1);
  return (row?.role as MemberRole | undefined) ?? null;
}

export function hasRole(role: MemberRole | null, min: MemberRole) {
  return !!role && RANK[role] >= RANK[min];
}

/** Para Server Actions e páginas do hub: exige login + papel mínimo no evento. */
export async function requireEventRole(eventId: string, min: MemberRole) {
  const { userId } = await auth();
  if (!userId) throw new AccessError("Entre com sua conta RoboStage.");
  const role = await getMembership(eventId, userId);
  if (!hasRole(role, min)) throw new AccessError("Você não tem permissão para isso neste evento.");
  const db = await getDb();
  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) throw new AccessError("Evento não encontrado.");
  return { userId, role: role!, event };
}

export interface ScorerIdentity {
  by: string;
  label: string;
  via: "member" | "code";
  role?: MemberRole;
  /** Mesa com código restrita a algumas rodadas (null = todas). */
  allowedRoundIds: string[] | null;
}

/** Quem está na mesa agora: um membro logado ou um voluntário com código válido. */
export async function getScorer(event: EventRow): Promise<ScorerIdentity | null> {
  const { userId } = await auth();
  if (userId) {
    const role = await getMembership(event.id, userId);
    if (role) {
      const me = await getIdentity();
      return { by: userId, label: me?.name ?? "Organização", via: "member", role, allowedRoundIds: null };
    }
  }

  // Códigos só valem com o evento ao vivo.
  if (event.status !== "live") return null;
  const session = await readRefereeSession();
  if (!session || session.eventId !== event.id) return null;
  const db = await getDb();
  const [code] = await db
    .select({
      id: accessCodes.id,
      label: accessCodes.label,
      active: accessCodes.active,
      code: accessCodes.code,
      allowedRoundIds: accessCodes.allowedRoundIds,
    })
    .from(accessCodes)
    .where(and(eq(accessCodes.id, session.codeId), eq(accessCodes.eventId, event.id)))
    .limit(1);
  if (!code?.active || !code.code || code.code !== session.code) return null;
  const label = session.name ? `${code.label} · ${session.name}` : code.label;
  return { by: `code:${code.id}`, label, via: "code", allowedRoundIds: code.allowedRoundIds?.length ? code.allowedRoundIds : null };
}

/** Quem pode corrigir/apagar/aprovar notas: admin, ou apurador se o evento permitir. */
export async function requireScoreEditor(eventId: string) {
  const { userId } = await auth();
  if (!userId) throw new AccessError("Entre com sua conta RoboStage.");
  const role = await getMembership(eventId, userId);
  if (hasRole(role, "admin")) return requireEventRole(eventId, "admin");
  if (role === "scorer") {
    const db = await getDb();
    const [s] = await db.select({ ok: eventSettings.scorersCanEdit }).from(eventSettings).where(eq(eventSettings.eventId, eventId)).limit(1);
    if (s?.ok) return requireEventRole(eventId, "scorer");
  }
  throw new AccessError("Você não tem permissão para corrigir notas neste evento.");
}
