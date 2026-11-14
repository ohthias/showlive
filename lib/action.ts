import "server-only";
import { unstable_rethrow } from "next/navigation";
import { AccessError } from "./access";

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

/** Erro com mensagem que pode ir para a tela. */
export class UserError extends Error {}

function pgCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code ?? e?.cause?.code;
}

export async function run<T>(fn: () => Promise<T>, messages: { unique?: string } = {}): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof UserError || err instanceof AccessError) return { ok: false, error: err.message };
    if (pgCode(err) === "23505") return { ok: false, error: messages.unique ?? "Esse registro já existe." };
    console.error("[action]", err);
    return { ok: false, error: "Algo deu errado. Tente de novo em instantes." };
  }
}

export function cleanText(value: unknown, max = 80): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}
