import "server-only";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { accessCodes, type EventRow } from "@/db/schema";
import { getMembership } from "./access";
import { REFEREE_COOKIE, verifyRefereeToken } from "./referee";

/** Decide se a requisição pode ver o estado "staff" (notas ocultas, autores). */
export async function resolveAudience(req: Request, event: EventRow, wantsStaff: boolean): Promise<"public" | "staff" | null> {
  if (!wantsStaff) return "public";
  const { userId } = await auth();
  if (userId && (await getMembership(event.id, userId))) return "staff";
  const token = (req.headers.get("cookie") ?? "")
    .split(/;\s*/)
    .find((c) => c.startsWith(`${REFEREE_COOKIE}=`))
    ?.slice(REFEREE_COOKIE.length + 1);
  const referee = await verifyRefereeToken(token ? decodeURIComponent(token) : undefined);
  if (!referee || referee.eventId !== event.id || event.status !== "live") return null;
  const db = await getDb();
  const [row] = await db
    .select({ code: accessCodes.code, active: accessCodes.active })
    .from(accessCodes)
    .where(eq(accessCodes.id, referee.codeId))
    .limit(1);
  return row?.active && row.code === referee.code ? "staff" : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * As rotas ao vivo aceitam o código público (telão, só com o evento ao vivo)
 * ou o id do evento — este último só para a organização/mesa (staff), que
 * precisa acompanhar o evento mesmo em preparação.
 */
export async function resolveLiveKey(req: Request, key: string, wantsStaff: boolean) {
  const { getEventByCode, getEventById } = await import("./snapshot");
  if (UUID.test(key)) {
    if (!wantsStaff) return { event: null, audience: null } as const;
    const event = await getEventById(key);
    if (!event) return { event: null, audience: null } as const;
    return { event, audience: await resolveAudience(req, event, true) } as const;
  }
  const event = await getEventByCode(key);
  if (!event) return { event: null, audience: null } as const;
  return { event, audience: await resolveAudience(req, event, wantsStaff) } as const;
}
