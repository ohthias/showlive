import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { accessCodes, judgingRooms, userPreferences } from "@/db/schema";
import { mergePrefs } from "../auth/prefs";
import { assignLiveCode, releaseAllLiveCodes } from "./unique-code";

/**
 * Regra dos códigos de acesso:
 *  - só existem enquanto o evento está AO VIVO;
 *  - são gerados no momento da ativação (sempre novos — um código de uma
 *    sessão anterior nunca volta a funcionar);
 *  - são apagados quando o evento volta para preparação ou é encerrado;
 *  - são únicos entre TODOS os eventos (registro live_codes), então com
 *    vários eventos ao vivo ao mesmo tempo um código nunca leva ao evento
 *    errado.
 * As "mesas" (rótulo, ativa/inativa) continuam existindo fora do ar; só o
 * código delas some. A mesma regra vale para as salas de avaliação: cada
 * sala tem o seu código.
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

  // Começa limpo: nenhum código de uma ativação anterior sobrevive.
  await releaseAllLiveCodes(eventId);
  await assignLiveCode(eventId, "public", eventId);
  for (const s of slots) await assignLiveCode(eventId, "mesa", s.id);
  // Salas de avaliação não são criadas automaticamente: só ganham código as que existem.
  const rooms = await db.select({ id: judgingRooms.id }).from(judgingRooms).where(eq(judgingRooms.eventId, eventId));
  for (const r of rooms) await assignLiveCode(eventId, "room", r.id);
}

export async function clearLiveCodes(eventId: string) {
  await releaseAllLiveCodes(eventId);
}
