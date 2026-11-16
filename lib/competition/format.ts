import type { ChallengeScoring } from "./challenge-types";

export type ScoreFormat = Pick<ChallengeScoring, "direction" | "unit" | "decimals">;

export const FLL_FORMAT: ScoreFormat = { direction: "higher", unit: "pts", decimals: 0 };

/** "1:23.45" para tempos ≥ 1 min, "45.30" abaixo disso. */
export function formatSeconds(sec: number, decimals = 2): string {
  const neg = sec < 0;
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs - m * 60;
  const body = m > 0 ? `${m}:${s.toFixed(decimals).padStart(decimals ? decimals + 3 : 2, "0")}` : s.toFixed(decimals);
  return neg ? `-${body}` : body;
}

/** Valor sem unidade, formatado conforme o desafio. */
export function formatValue(value: number, f: ScoreFormat): string {
  if (f.unit === "s") return formatSeconds(value, f.decimals);
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: f.decimals });
}

/** Valor com unidade: "90 pts", "1:02.30 s", "152,5 cm". */
export function formatScore(value: number, f: ScoreFormat): string {
  return `${formatValue(value, f)} ${f.unit}`;
}

/** Tempo em m:ss (desempate da OBR). */
export function formatClockTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function bestLabel(f: ScoreFormat, mode: "best" | "sum" | "best2") {
  if (mode === "sum") return "TOTAL";
  if (mode === "best2") return "2 MELHORES";
  return f.unit === "s" ? "MELHOR TEMPO" : "MELHOR";
}
