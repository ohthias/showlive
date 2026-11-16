import "server-only";
import { and, asc, eq, ne } from "drizzle-orm";
import { getDb } from "@/db/client";
import { matches, type EventRow } from "@/db/schema";
import { scoreMatch } from "./alliance";
import { sanitizeCustomResponses } from "./challenge";

/** Depois de editar a súmula/configuração: refaz o placar das partidas já lançadas. */
export async function rescoreMatches(event: EventRow) {
  if (event.format !== "alliance" || !event.challenge?.alliance) return 0;
  const { challenge, cfg } = { challenge: event.challenge, cfg: event.challenge.alliance };
  const db = await getDb();
  const rows = await db.select().from(matches).where(and(eq(matches.eventId, event.id), ne(matches.status, "scheduled"))).orderBy(asc(matches.number));
  let n = 0;
  for (const m of rows) {
    if (!m.result) continue;
    try {
      const red = sanitizeCustomResponses(challenge, m.result.red.responses);
      const blue = cfg.mode === "versus" ? sanitizeCustomResponses(challenge, m.result.blue?.responses ?? {}) : null;
      // Itens obrigatórios novos não invalidam resultados antigos: recalcula sem exigir.
      const relaxed = { ...challenge, items: challenge.items.map((i) => ({ ...i, required: false })) };
      const result = scoreMatch(relaxed, cfg, red, blue, m.result.flags);
      await db.update(matches).set({ result, redScore: result.red.score, blueScore: result.blue?.score ?? null }).where(eq(matches.id, m.id));
      n++;
    } catch {
      /* mantém o resultado antigo */
    }
  }
  return n;
}

