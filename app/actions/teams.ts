"use server";

import { and, asc, eq, max, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { rounds, scores, teams } from "@/db/schema";
import { requireEventRole } from "@/lib/access";
import { cleanText, run, UserError } from "@/lib/action";
import { nudge } from "@/lib/live-hub";

/**
 * Aceita uma equipe por linha. Formatos:
 *   "Robôs do Sertão"
 *   "12345 - Robôs do Sertão"
 *   "12345; Robôs do Sertão; Escola X"
 */
function parseLine(line: string) {
  const parts = line.split(/\s*[;\t]\s*/);
  let first = cleanText(parts[0]);
  let number: string | null = null;
  const m = first.match(/^#?(\d{1,6})\s*[-–—:]\s*(.+)$/);
  if (m) {
    number = m[1];
    first = cleanText(m[2]);
  } else if (parts.length > 1 && /^\d{1,6}$/.test(first)) {
    number = first;
    first = cleanText(parts[1]);
    parts.splice(1, 1);
  }
  return { name: first.slice(0, 60), number, organization: parts[1] ? cleanText(parts[1], 80) : null };
}

export async function addTeams(eventId: string, text: string) {
  return run(async () => {
    await requireEventRole(eventId, "admin");
    const db = await getDb();
    const existing = new Set(
      (await db.select({ name: teams.name }).from(teams).where(eq(teams.eventId, eventId))).map((t) => t.name.toLowerCase()),
    );

    const seen = new Set<string>();
    const rows = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map(parseLine)
      .filter((t) => {
        const key = t.name.toLowerCase();
        if (t.name.length < 1 || existing.has(key) || seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    if (!rows.length) throw new UserError("Nenhuma equipe nova (nomes vazios ou repetidos).");
    if (existing.size + rows.length > 200) throw new UserError("Limite de 200 equipes por evento.");

    await db.insert(teams).values(rows.map((r) => ({ ...r, eventId })));
    nudge(eventId);
    revalidatePath(`/hub/${eventId}`, "layout");
    return { added: rows.length, skipped: text.split(/\r?\n/).filter((l) => l.trim()).length - rows.length };
  });
}

export async function updateTeam(
  eventId: string,
  teamId: string,
  input: { name: string; number?: string | null; organization?: string | null },
) {
  return run(
    async () => {
      await requireEventRole(eventId, "admin");
      const name = cleanText(input.name, 60);
      if (!name) throw new UserError("O nome não pode ficar vazio.");
      const db = await getDb();
      await db
        .update(teams)
        .set({
          name,
          number: cleanText(input.number, 12) || null,
          organization: cleanText(input.organization, 80) || null,
        })
        .where(and(eq(teams.id, teamId), eq(teams.eventId, eventId)));
      nudge(eventId);
      revalidatePath(`/hub/${eventId}`, "layout");
      return null;
    },
    { unique: "Já existe uma equipe com esse nome." },
  );
}

export async function deleteTeam(eventId: string, teamId: string) {
  return run(async () => {
    await requireEventRole(eventId, "admin");
    const db = await getDb();
    await db.delete(teams).where(and(eq(teams.id, teamId), eq(teams.eventId, eventId)));
    nudge(eventId);
    revalidatePath(`/hub/${eventId}`, "layout");
    return null;
  });
}

/* ------------------------------------------------------------ rodadas */

export async function addRound(eventId: string, rawName: string) {
  return run(
    async () => {
      const { event } = await requireEventRole(eventId, "admin");
      if (event.format === "obr") throw new UserError("Na OBR cada rodada é uma arena. Edite as arenas em vez de criar rodadas.");
      const name = cleanText(rawName, 40);
      if (!name) throw new UserError("Dê um nome para a rodada.");
      const db = await getDb();
      const [{ value }] = await db.select({ value: max(rounds.position) }).from(rounds).where(eq(rounds.eventId, eventId));
      await db.insert(rounds).values({ eventId, name, position: (value ?? 0) + 1, kind: "qualifying" });
      nudge(eventId);
      revalidatePath(`/hub/${eventId}`, "layout");
      return null;
    },
    { unique: "Já existe uma rodada com esse nome." },
  );
}

export async function renameRound(eventId: string, roundId: string, rawName: string) {
  return run(
    async () => {
      await requireEventRole(eventId, "admin");
      const name = cleanText(rawName, 40);
      if (!name) throw new UserError("Dê um nome para a rodada.");
      const db = await getDb();
      await db.update(rounds).set({ name }).where(and(eq(rounds.id, roundId), eq(rounds.eventId, eventId)));
      nudge(eventId);
      revalidatePath(`/hub/${eventId}`, "layout");
      return null;
    },
    { unique: "Já existe uma rodada com esse nome." },
  );
}

export async function deleteRound(eventId: string, roundId: string) {
  return run(async () => {
    const { event } = await requireEventRole(eventId, "admin");
    if (event.format === "obr") throw new UserError("Na OBR as 3 rodadas são fixas (uma por arena).");
    const db = await getDb();
    const quals = await db
      .select({ id: rounds.id })
      .from(rounds)
      .where(and(eq(rounds.eventId, eventId), eq(rounds.kind, "qualifying")));
    if (quals.length <= 1 && quals.some((r) => r.id === roundId)) throw new UserError("O evento precisa de pelo menos uma rodada.");
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(scores)
      .where(eq(scores.roundId, roundId));
    await db.delete(rounds).where(and(eq(rounds.id, roundId), eq(rounds.eventId, eventId)));
    nudge(eventId);
    revalidatePath(`/hub/${eventId}`, "layout");
    return { removedScores: n };
  });
}

export async function moveRound(eventId: string, roundId: string, direction: -1 | 1) {
  return run(async () => {
    await requireEventRole(eventId, "admin");
    const db = await getDb();
    const list = await db
      .select({ id: rounds.id, position: rounds.position })
      .from(rounds)
      .where(and(eq(rounds.eventId, eventId), eq(rounds.kind, "qualifying")))
      .orderBy(asc(rounds.position));
    const i = list.findIndex((r) => r.id === roundId);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= list.length) return null;
    const a = list[i];
    const b = list[j];
    await db.update(rounds).set({ position: b.position }).where(eq(rounds.id, a.id));
    await db.update(rounds).set({ position: a.position }).where(eq(rounds.id, b.id));
    nudge(eventId);
    revalidatePath(`/hub/${eventId}`, "layout");
    return null;
  });
}
