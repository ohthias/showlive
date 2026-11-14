"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { accessCodes, eventMembers, events, judgingRooms, rounds } from "@/db/schema";
import { requireEventRole } from "@/lib/access";
import { cleanText, run, UserError } from "@/lib/action";
import { normalizeCode } from "@/lib/codes";
import { clearRefereeSession, writeRefereeSession } from "@/lib/referee";
import { uniqueCode } from "@/lib/unique-code";

/* ------------------------------------------------------ códigos de mesa */

export async function addRefereeCode(eventId: string, rawLabel: string) {
  return run(async () => {
    const { event } = await requireEventRole(eventId, "admin");
    const db = await getDb();
    const existing = await db.select({ id: accessCodes.id }).from(accessCodes).where(eq(accessCodes.eventId, eventId));
    if (existing.length >= 20) throw new UserError("Limite de 20 mesas.");
    const label = cleanText(rawLabel, 30) || `Mesa ${existing.length + 1}`;
    // Fora do ar a mesa é criada sem código; ele nasce na ativação.
    await db.insert(accessCodes).values({ eventId, code: event.status === "live" ? await uniqueCode() : null, label });
    revalidatePath(`/hub/${eventId}`, "layout");
    return null;
  });
}

export async function setRefereeCodeActive(eventId: string, codeId: string, active: boolean) {
  return run(async () => {
    await requireEventRole(eventId, "admin");
    const db = await getDb();
    await db.update(accessCodes).set({ active }).where(and(eq(accessCodes.id, codeId), eq(accessCodes.eventId, eventId)));
    revalidatePath(`/hub/${eventId}`, "layout");
    return null;
  });
}

/** Restringe a mesa a algumas rodadas (vazio = todas). */
export async function setRefereeCodeRounds(eventId: string, codeId: string, roundIds: string[]) {
  return run(async () => {
    await requireEventRole(eventId, "admin");
    const db = await getDb();
    const valid = new Set((await db.select({ id: rounds.id }).from(rounds).where(eq(rounds.eventId, eventId))).map((r) => r.id));
    const clean = [...new Set(roundIds)].filter((id) => valid.has(id));
    await db
      .update(accessCodes)
      .set({ allowedRoundIds: clean.length ? clean : null })
      .where(and(eq(accessCodes.id, codeId), eq(accessCodes.eventId, eventId)));
    revalidatePath(`/hub/${eventId}`, "layout");
    return null;
  });
}

/** Troca o código: quem entrou com o antigo perde o acesso na próxima nota. */
export async function rotateRefereeCode(eventId: string, codeId: string) {
  return run(async () => {
    const { event } = await requireEventRole(eventId, "admin");
    if (event.status !== "live") throw new UserError("Os códigos só existem com o evento ao vivo.");
    const db = await getDb();
    const [old] = await db
      .select()
      .from(accessCodes)
      .where(and(eq(accessCodes.id, codeId), eq(accessCodes.eventId, eventId)))
      .limit(1);
    if (!old) throw new UserError("Código não encontrado.");
    await db.update(accessCodes).set({ code: await uniqueCode(), active: true, lastUsedAt: null }).where(eq(accessCodes.id, codeId));
    revalidatePath(`/hub/${eventId}`, "layout");
    return null;
  });
}

export async function deleteRefereeCode(eventId: string, codeId: string) {
  return run(async () => {
    await requireEventRole(eventId, "admin");
    const db = await getDb();
    await db.delete(accessCodes).where(and(eq(accessCodes.id, codeId), eq(accessCodes.eventId, eventId)));
    revalidatePath(`/hub/${eventId}`, "layout");
    return null;
  });
}

/* ---------------------------------------------------- hub de admins */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Convida alguém pelo e-mail da conta RoboStage. Se a conta já existe no
 * Clerk, o vínculo fica ativo na hora; senão fica pendente e é ativado no
 * primeiro acesso dessa pessoa ao ShowLive (lib/access.ts → claimPendingInvites).
 */
export async function inviteMember(eventId: string, rawEmail: string, role: "admin" | "scorer") {
  return run(
    async () => {
      const { userId } = await requireEventRole(eventId, "admin");
      const email = rawEmail.trim().toLowerCase();
      if (!EMAIL.test(email)) throw new UserError("E-mail inválido.");
      if (role !== "admin" && role !== "scorer") throw new UserError("Papel inválido.");

      let found: { id: string; name: string } | null = null;
      try {
        const client = await clerkClient();
        const { data } = await client.users.getUserList({ emailAddress: [email], limit: 1 });
        const u = data[0];
        if (u) found = { id: u.id, name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || email };
      } catch (err) {
        console.warn("[invite] não consegui consultar o Clerk", err);
      }

      const db = await getDb();
      if (found) {
        const [already] = await db
          .select({ id: eventMembers.id })
          .from(eventMembers)
          .where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.userId, found.id)))
          .limit(1);
        if (already) throw new UserError("Essa pessoa já faz parte do evento.");
      }

      await db.insert(eventMembers).values({
        eventId,
        email,
        userId: found?.id ?? null,
        name: found?.name ?? null,
        role,
        status: found ? "active" : "pending",
        invitedBy: userId,
      });
      revalidatePath(`/hub/${eventId}`, "layout");
      return { pending: !found };
    },
    { unique: "Esse e-mail já foi convidado." },
  );
}

export async function updateMemberRole(eventId: string, memberId: string, role: "admin" | "scorer") {
  return run(async () => {
    await requireEventRole(eventId, "admin");
    if (role !== "admin" && role !== "scorer") throw new UserError("Papel inválido.");
    const db = await getDb();
    const [m] = await db.select().from(eventMembers).where(eq(eventMembers.id, memberId)).limit(1);
    if (!m || m.eventId !== eventId) throw new UserError("Membro não encontrado.");
    if (m.role === "owner") throw new UserError("O papel do dono não pode ser alterado.");
    await db.update(eventMembers).set({ role }).where(eq(eventMembers.id, memberId));
    revalidatePath(`/hub/${eventId}`, "layout");
    return null;
  });
}

export async function removeMember(eventId: string, memberId: string) {
  return run(async () => {
    await requireEventRole(eventId, "admin");
    const db = await getDb();
    const [m] = await db.select().from(eventMembers).where(eq(eventMembers.id, memberId)).limit(1);
    if (!m || m.eventId !== eventId) throw new UserError("Membro não encontrado.");
    if (m.role === "owner") throw new UserError("O dono não pode ser removido.");
    await db.delete(eventMembers).where(eq(eventMembers.id, memberId));
    revalidatePath(`/hub/${eventId}`, "layout");
    return null;
  });
}

/* ------------------------------------------------- entrada por código */

export type CodeLookup =
  | { kind: "public"; eventCode: string; eventName: string }
  | { kind: "referee"; eventName: string; label: string }
  | { kind: "judge"; eventName: string; label: string };

export async function lookupCode(raw: string) {
  return run<CodeLookup>(async () => {
    const code = normalizeCode(raw);
    if (code.length < 6) throw new UserError("O código tem 6 caracteres.");
    const db = await getDb();

    // Códigos só existem (e só valem) com o evento ao vivo.
    const [event] = await db
      .select({ code: events.code, name: events.name, status: events.status })
      .from(events)
      .where(eq(events.code, code))
      .limit(1);
    if (event?.code && event.status === "live") return { kind: "public", eventCode: event.code, eventName: event.name };

    const [mesa] = await db
      .select({ label: accessCodes.label, active: accessCodes.active, eventName: events.name, status: events.status })
      .from(accessCodes)
      .innerJoin(events, eq(events.id, accessCodes.eventId))
      .where(eq(accessCodes.code, code))
      .limit(1);
    if (mesa) {
      if (mesa.status !== "live") throw new UserError("Este evento não está ao vivo no momento.");
      if (!mesa.active) throw new UserError("Este código de mesa foi desativado pela organização.");
      return { kind: "referee", eventName: mesa.eventName, label: mesa.label };
    }

    const [room] = await db
      .select({ label: judgingRooms.name, active: judgingRooms.active, eventName: events.name, status: events.status })
      .from(judgingRooms)
      .innerJoin(events, eq(events.id, judgingRooms.eventId))
      .where(eq(judgingRooms.code, code))
      .limit(1);
    if (room) {
      if (room.status !== "live") throw new UserError("Este evento não está ao vivo no momento.");
      if (!room.active) throw new UserError("Este código de sala foi desativado pela organização.");
      return { kind: "judge", eventName: room.eventName, label: room.label };
    }
    throw new UserError("Código inválido ou expirado. Os códigos mudam a cada vez que o evento fica ao vivo — confira com a organização.");
  });
}

export async function joinMesa(raw: string, rawName: string) {
  const code = normalizeCode(raw);
  const name = cleanText(rawName, 30);
  const db = await getDb();
  const [mesa] = await db
    .select({
      id: accessCodes.id,
      eventId: accessCodes.eventId,
      active: accessCodes.active,
      code: accessCodes.code,
      eventCode: events.code,
      status: events.status,
    })
    .from(accessCodes)
    .innerJoin(events, eq(events.id, accessCodes.eventId))
    .where(eq(accessCodes.code, code))
    .limit(1);
  if (!mesa?.active || !mesa.code || mesa.status !== "live" || !mesa.eventCode)
    return { ok: false as const, error: "Código inválido, desativado ou evento fora do ar." };
  if (name.length < 2) return { ok: false as const, error: "Diga seu nome para o histórico de notas." };

  await writeRefereeSession({ eventId: mesa.eventId, codeId: mesa.id, code: mesa.code, name });
  await db.update(accessCodes).set({ lastUsedAt: new Date() }).where(eq(accessCodes.id, mesa.id));
  redirect(`/mesa/${mesa.eventCode}`);
}

export async function leaveMesa() {
  await clearRefereeSession();
  redirect("/entrar");
}
