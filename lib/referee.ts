import "server-only";
import { cookies } from "next/headers";

/**
 * Sessão da mesa de arbitragem. Voluntários não precisam de conta RoboStage:
 * digitam o código da mesa e recebem um cookie assinado (HMAC-SHA256),
 * válido para UM evento e UM código. Se o admin desativar ou trocar o código,
 * a próxima nota enviada é recusada (ver lib/access.ts).
 */

export const REFEREE_COOKIE = "sl_mesa";
const MAX_AGE = 60 * 60 * 18; // um dia de evento

export interface RefereeSession {
  eventId: string;
  codeId: string;
  /** O código em si: se a mesa ganhar um código novo (nova ativação), o cookie antigo deixa de valer. */
  code: string;
  name: string;
  exp: number;
}

function secret() {
  const s = process.env.SHOWLIVE_SECRET;
  if (!s || s.length < 16) {
    if (process.env.NODE_ENV === "production") throw new Error("SHOWLIVE_SECRET ausente ou curto demais");
    return "dev-only-showlive-secret-change-me";
  }
  return s;
}

const enc = new TextEncoder();

function b64url(bytes: Uint8Array | ArrayBuffer) {
  return Buffer.from(bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes).toString("base64url");
}

async function hmac(data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signRefereeSession(s: Omit<RefereeSession, "exp">): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify({ ...s, exp: Math.floor(Date.now() / 1000) + MAX_AGE })));
  return `${body}.${await hmac(body)}`;
}

export async function verifyRefereeToken(token: string | undefined): Promise<RefereeSession | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig || !safeEqual(sig, await hmac(body))) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as RefereeSession;
    if (!data.eventId || !data.codeId || !data.code || data.exp < Date.now() / 1000) return null;
    return data;
  } catch {
    return null;
  }
}

export async function readRefereeSession(): Promise<RefereeSession | null> {
  const jar = await cookies();
  return verifyRefereeToken(jar.get(REFEREE_COOKIE)?.value);
}

export async function writeRefereeSession(s: Omit<RefereeSession, "exp">) {
  const jar = await cookies();
  jar.set(REFEREE_COOKIE, await signRefereeSession(s), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearRefereeSession() {
  const jar = await cookies();
  jar.delete(REFEREE_COOKIE);
}
