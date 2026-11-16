import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { events } from "@/db/schema";
import { buildSnapshot } from "./snapshot";
import type { LiveSnapshot } from "./live-types";

/**
 * Hub de tempo real (um por instância do servidor).
 *
 * Problema: 300 pessoas com o telão aberto no celular + 2 projetores + 6
 * mesas. Se cada conexão consultasse o banco, seriam centenas de consultas
 * por segundo. Aqui, por evento e por instância:
 *   - 1 consulta/segundo de `select revision` (só enquanto houver alguém ouvindo);
 *   - 1 montagem de snapshot por revisão e por público (public/staff),
 *     compartilhada entre todas as conexões.
 * Com Fluid Compute (Vercel), várias conexões caem na mesma instância, então
 * o custo cresce com o nº de instâncias, não com o nº de telas.
 */

type Listener = (revision: number) => void;

interface Channel {
  listeners: Set<Listener>;
  revision: number;
  timer: ReturnType<typeof setInterval> | null;
  polling: boolean;
  snapshots: Map<string, { revision: number; promise: Promise<LiveSnapshot | null> }>;
}

const POLL_MS = 1000;

type GlobalHub = { __showliveHub?: Map<string, Channel> };
const g = globalThis as unknown as GlobalHub;
const channels = (g.__showliveHub ??= new Map<string, Channel>());

function channel(eventId: string): Channel {
  let ch = channels.get(eventId);
  if (!ch) {
    ch = { listeners: new Set(), revision: -1, timer: null, polling: false, snapshots: new Map() };
    channels.set(eventId, ch);
  }
  return ch;
}

async function poll(eventId: string) {
  const ch = channel(eventId);
  if (ch.polling) return;
  ch.polling = true;
  try {
    const db = await getDb();
    const [row] = await db.select({ revision: events.revision }).from(events).where(eq(events.id, eventId)).limit(1);
    const next = row?.revision ?? -2; // -2 = evento apagado
    if (next !== ch.revision) {
      ch.revision = next;
      for (const fn of ch.listeners) fn(next);
    }
  } catch (err) {
    console.error("[live-hub] poll falhou", eventId, err);
  } finally {
    ch.polling = false;
  }
}

export function subscribe(eventId: string, fn: Listener): () => void {
  const ch = channel(eventId);
  ch.listeners.add(fn);
  if (!ch.timer) {
    ch.timer = setInterval(() => void poll(eventId), POLL_MS);
    void poll(eventId);
  } else if (ch.revision >= 0) {
    fn(ch.revision);
  }
  return () => {
    ch.listeners.delete(fn);
    if (ch.listeners.size === 0 && ch.timer) {
      clearInterval(ch.timer);
      ch.timer = null;
      ch.snapshots.clear();
      channels.delete(eventId);
    }
  };
}

/** Depois de uma escrita nesta instância: avisa sem esperar o próximo poll. */
export function nudge(eventId: string) {
  if (channels.has(eventId)) void poll(eventId);
}

/** Snapshot memoizado por (evento, público, revisão). */
export function getSnapshot(eventId: string, audience: "public" | "staff", revision: number) {
  const ch = channel(eventId);
  const cached = ch.snapshots.get(audience);
  if (cached && cached.revision === revision) return cached.promise;

  const promise = (async () => {
    const db = await getDb();
    const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
    return event ? buildSnapshot(event, audience) : null;
  })();
  ch.snapshots.set(audience, { revision, promise });
  promise.catch(() => ch.snapshots.delete(audience));
  return promise;
}
