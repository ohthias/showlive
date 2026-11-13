import "server-only";
import { inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { accessCodes, events } from "@/db/schema";
import { generateCode } from "./codes";

/** Código que não colide nem com códigos públicos nem com códigos de mesa. */
export async function uniqueCode(): Promise<string> {
  const db = await getDb();
  for (let i = 0; i < 8; i++) {
    const candidates = Array.from({ length: 4 }, () => generateCode());
    const [usedEvents, usedCodes] = await Promise.all([
      db.select({ c: events.code }).from(events).where(inArray(events.code, candidates)),
      db.select({ c: accessCodes.code }).from(accessCodes).where(inArray(accessCodes.code, candidates)),
    ]);
    const used = new Set([...usedEvents, ...usedCodes].map((r) => r.c));
    const free = candidates.find((c) => !used.has(c));
    if (free) return free;
  }
  throw new Error("Não foi possível gerar um código único");
}
