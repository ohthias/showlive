import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { accessCodes, events, userPreferences } from "@/db/schema";
import { mergePrefs } from "./prefs";
import { uniqueCode } from "./unique-code";

/**
 * Regra dos códigos de acesso:
 *  - só existem enquanto o evento está AO VIVO;
 *  - são gerados no momento da ativação (sempre novos — um código de uma
 *    sessão anterior nunca volta a funcionar);
 *  - são apagados quando o evento volta para preparação ou é encerrado.
 * As "mesas" (rótulo, ativa/inativa) continuam existindo fora do ar; só o
 * código delas some.
 */
export async function generateLiveCodes(eventId: string, ownerId: string) {
  const db = await getDb();
  let slots = await db
    .select({ id: accessCodes.id })
    .from(accessCodes)
    .where(eq(accessCodes.eventId, eventId))
    .orderBy(asc(accessCodes.createdAt));

  if (!slots.length) {
    const [row] = await db.select().from(userPreferences).where(eq(userPreferences.userId, ownerId)).limit(1);
    const n = Math.min(10, Math.max(1, mergePrefs(row?.prefs).defaultMesaCount));
    slots = await db
      .insert(accessCodes)
      .values(Array.from({ length: n }, (_, i) => ({ eventId, label: `Mesa ${i + 1}` })))
      .returning({ id: accessCodes.id });
  }

  await db.update(events).set({ code: await uniqueCode() }).where(eq(events.id, eventId));
  for (const s of slots) {
    await db.update(accessCodes).set({ code: await uniqueCode(), lastUsedAt: null }).where(eq(accessCodes.id, s.id));
  }
}

export async function clearLiveCodes(eventId: string) {
  const db = await getDb();
  await db.update(events).set({ code: null }).where(eq(events.id, eventId));
  await db.update(accessCodes).set({ code: null }).where(eq(accessCodes.eventId, eventId));
}
