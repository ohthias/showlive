import "server-only";
import { getDb } from "@/db/client";
import { UserError } from "../auth/action";
import { CodeTargetMissing, releaseEventCodes, releaseStale, reserveLiveCode, resolveLiveCode, type LiveCodeKind } from "./live-codes";

/**
 * Gera e grava um código novo, único entre TODOS os eventos e tipos
 * (público, mesa, sala). Ver lib/live-codes.ts.
 */
export async function assignLiveCode(eventId: string, kind: LiveCodeKind, refId: string): Promise<string> {
  const db = await getDb();
  try {
    return await reserveLiveCode(db, { eventId, kind, refId });
  } catch (err) {
    if (err instanceof CodeTargetMissing) throw new UserError(err.message);
    throw err;
  }
}

/** Depois de apagar uma mesa/sala (ou tirar o código dela). */
export async function releaseLiveCode(kind: LiveCodeKind, refId: string) {
  await releaseStale(await getDb(), kind, refId);
}

export async function releaseAllLiveCodes(eventId: string) {
  await releaseEventCodes(await getDb(), eventId);
}

export async function resolveCode(code: string) {
  return resolveLiveCode(await getDb(), code);
}
