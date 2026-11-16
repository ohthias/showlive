import "server-only";
import { headers } from "next/headers";

/**
 * Limite de tentativas de código em /entrar, por IP. Com muitos eventos ao
 * vivo ao mesmo tempo há muitos códigos válidos; isto impede que alguém fique
 * chutando códigos até cair na sala (ou mesa) de outro evento.
 *
 * Fica em memória, por instância: não é um cadeado perfeito em ambiente
 * serverless com várias instâncias, mas torna a força bruta inviável
 * (31^6 ≈ 887 milhões de combinações contra ~20 tentativas a cada 10 min).
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES = 20;

type Bucket = { failures: number; resetAt: number };
const g = globalThis as unknown as { __slCodeAttempts?: Map<string, Bucket> };
const buckets = (g.__slCodeAttempts ??= new Map());

async function clientKey() {
  const h = await headers();
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || h.get("x-real-ip") || "local";
}

function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

/** Mensagem de bloqueio, ou null se pode tentar. */
export async function codeAttemptBlocked(): Promise<string | null> {
  const now = Date.now();
  const b = buckets.get(await clientKey());
  if (!b || b.resetAt <= now || b.failures < MAX_FAILURES) return null;
  const min = Math.ceil((b.resetAt - now) / 60000);
  return `Muitas tentativas com código errado. Espere ${min} min ou confira o código com a organização.`;
}

export async function recordCodeFailure() {
  const now = Date.now();
  sweep(now);
  const key = await clientKey();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) buckets.set(key, { failures: 1, resetAt: now + WINDOW_MS });
  else b.failures++;
}
