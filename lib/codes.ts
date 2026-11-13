// Sem 0/O e 1/I/L: códigos são ditados em voz alta no dia do evento.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateCode(length = 6): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}
