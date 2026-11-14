import type { EventTheme } from "@/db/schema";

/* ================================================================ estilo */

export type TvStyle = Required<
  Pick<
    EventTheme,
    "secondary" | "bgStyle" | "pattern" | "patternOpacity" | "layout" | "panel" | "corners" | "font" | "numFont" | "motion" | "medals" | "rankMoves"
  >
>;

export const TV_DEFAULTS: TvStyle = {
  secondary: "#5279d1",
  bgStyle: "spotlight",
  pattern: "dots",
  patternOpacity: 8,
  layout: "table",
  panel: "glass",
  corners: "cut",
  font: "roboto",
  numFont: "roboto-mono",
  motion: "full",
  medals: true,
  rankMoves: true,
};

export const BG_STYLES: { id: TvStyle["bgStyle"]; label: string; hint: string }[] = [
  { id: "solid", label: "Liso", hint: "Só a cor de fundo" },
  { id: "gradient", label: "Degradê", hint: "Fundo → secundária" },
  { id: "spotlight", label: "Holofote", hint: "Luz do destaque no canto" },
  { id: "aurora", label: "Aurora", hint: "Manchas de luz em movimento" },
  { id: "mesh", label: "Malha", hint: "Várias luzes suaves" },
];

export const PATTERNS: { id: TvStyle["pattern"]; label: string }[] = [
  { id: "none", label: "Nenhum" },
  { id: "dots", label: "Pontos" },
  { id: "grid", label: "Grade" },
  { id: "lines", label: "Diagonais" },
  { id: "hex", label: "Colmeia" },
  { id: "circuit", label: "Circuito" },
  { id: "topo", label: "Relevo" },
];

export const LAYOUTS: { id: TvStyle["layout"]; label: string; hint: string }[] = [
  { id: "table", label: "Tabela", hint: "Clássica, com todas as rodadas" },
  { id: "cards", label: "Cartões", hint: "Uma faixa por equipe, mais respiro" },
  { id: "compact", label: "Compacta", hint: "Linhas finas, cabe mais equipe" },
  { id: "split", label: "Duas colunas", hint: "O dobro de equipes por página" },
];

export const PANELS: { id: TvStyle["panel"]; label: string }[] = [
  { id: "glass", label: "Vidro" },
  { id: "solid", label: "Sólido" },
  { id: "outline", label: "Contorno" },
];

export const CORNERS: { id: TvStyle["corners"]; label: string }[] = [
  { id: "cut", label: "RoboStage" },
  { id: "round", label: "Arredondado" },
  { id: "sharp", label: "Reto" },
];

export const MOTIONS: { id: TvStyle["motion"]; label: string; hint: string }[] = [
  { id: "off", label: "Desligadas", hint: "Nada se mexe (bom para projetor fraco)" },
  { id: "subtle", label: "Suaves", hint: "Entradas e destaques discretos" },
  { id: "full", label: "Completas", hint: "Fundo vivo, reordenação, contagem, confete" },
];

/** Fontes: nome de exibição + pilha CSS. Carregadas por components/live/tv-fonts.ts. */
export const FONTS: { id: TvStyle["font"]; label: string; css: string; caps?: boolean }[] = [
  { id: "roboto", label: "Roboto", css: '"Roboto Variable", ui-sans-serif, system-ui, sans-serif' },
  { id: "space-grotesk", label: "Space Grotesk", css: '"Space Grotesk Variable", "Roboto Variable", sans-serif' },
  { id: "sora", label: "Sora", css: '"Sora Variable", "Roboto Variable", sans-serif' },
  { id: "oswald", label: "Oswald", css: '"Oswald Variable", "Roboto Variable", sans-serif', caps: true },
  { id: "bebas", label: "Bebas Neue", css: '"Bebas Neue", "Oswald Variable", sans-serif', caps: true },
  { id: "orbitron", label: "Orbitron", css: '"Orbitron Variable", "Roboto Variable", sans-serif' },
  { id: "chakra", label: "Chakra Petch", css: '"Chakra Petch", "Roboto Variable", sans-serif' },
];

export const NUM_FONTS: { id: TvStyle["numFont"]; label: string; css: string | null }[] = [
  { id: "roboto-mono", label: "Roboto Mono", css: '"Roboto Mono Variable", ui-monospace, monospace' },
  { id: "jetbrains", label: "JetBrains Mono", css: '"JetBrains Mono Variable", ui-monospace, monospace' },
  { id: "orbitron", label: "Orbitron", css: '"Orbitron Variable", ui-monospace, monospace' },
  { id: "display", label: "Igual aos títulos", css: null },
];

export function fontCss(id: TvStyle["font"]) {
  return (FONTS.find((f) => f.id === id) ?? FONTS[0]).css;
}
export function numFontCss(style: TvStyle) {
  return NUM_FONTS.find((f) => f.id === style.numFont)?.css ?? fontCss(style.font);
}

/* =============================================================== presets */

/**
 * Temas do telão. As cores seguem a ordem [fundo, destaque, texto].
 * "robostage" usa a paleta do site (vermelho #cf2a2a, azul #1e459f,
 * amarelo #fabd32) sobre o fundo escuro quente do darkScheme.
 */
export const THEME_PRESETS: { id: string; name: string; theme: EventTheme }[] = [
  {
    id: "robostage",
    name: "RoboStage",
    theme: { preset: "robostage", colors: ["#1f1c18", "#e04444", "#f3ecdc"], background: null, blur: false, secondary: "#5279d1", bgStyle: "spotlight", pattern: "dots", layout: "table", panel: "glass", corners: "cut", font: "roboto", numFont: "roboto-mono" },
  },
  {
    id: "robostage-azul",
    name: "RoboStage Azul",
    theme: { preset: "robostage-azul", colors: ["#13203f", "#fabd32", "#f3ecdc"], background: null, blur: false, secondary: "#e04444", bgStyle: "mesh", pattern: "grid", patternOpacity: 6, layout: "cards", panel: "glass", corners: "cut", font: "space-grotesk", numFont: "jetbrains" },
  },
  {
    id: "arena-neon",
    name: "Arena Neon",
    theme: { preset: "arena-neon", colors: ["#070b18", "#22e5ff", "#eef6ff"], background: null, blur: false, secondary: "#ff3dac", bgStyle: "aurora", pattern: "circuit", patternOpacity: 10, layout: "cards", panel: "outline", corners: "sharp", font: "orbitron", numFont: "orbitron" },
  },
  {
    id: "placar",
    name: "Placar Esportivo",
    theme: { preset: "placar", colors: ["#0c0c0c", "#ffd23f", "#ffffff"], background: null, blur: false, secondary: "#ff4d2e", bgStyle: "gradient", pattern: "lines", patternOpacity: 5, layout: "table", panel: "solid", corners: "sharp", font: "bebas", numFont: "display" },
  },
  {
    id: "claro",
    name: "Claro",
    theme: { preset: "claro", colors: ["#f6f1e7", "#cf2a2a", "#1f1c18"], background: null, blur: false, secondary: "#1e459f", bgStyle: "spotlight", pattern: "topo", patternOpacity: 7, layout: "cards", panel: "solid", corners: "round", font: "sora", numFont: "jetbrains" },
  },
  {
    id: "unearthed",
    name: "Unearthed",
    theme: { preset: "unearthed", colors: ["#1b1410", "#e74c3c", "#ffffff"], background: "/images/backgrounds/background_unearthed.png", blur: false, secondary: "#f5a623", bgStyle: "spotlight", pattern: "none", layout: "table", panel: "glass", corners: "cut", font: "chakra", numFont: "roboto-mono" },
  },
  {
    id: "submerged",
    name: "Submerged",
    theme: { preset: "submerged", colors: ["#062a33", "#1abc9c", "#ffffff"], background: "/images/backgrounds/background_submerged.png", blur: false, secondary: "#3aa0ff", bgStyle: "spotlight", pattern: "none", layout: "cards", panel: "glass", corners: "round", font: "sora", numFont: "jetbrains" },
  },
  {
    id: "masterpiece",
    name: "Masterpiece",
    theme: { preset: "masterpiece", colors: ["#22140f", "#ff5733", "#ffffff"], background: "/images/backgrounds/background_masterpiece.png", blur: false, secondary: "#ffc300", bgStyle: "spotlight", pattern: "none", layout: "table", panel: "glass", corners: "cut", font: "space-grotesk", numFont: "roboto-mono" },
  },
  {
    id: "obr",
    name: "OBR Resgate",
    theme: { preset: "obr", colors: ["#0b1d33", "#ffcc00", "#ffffff"], background: null, blur: false, secondary: "#2fbf71", bgStyle: "mesh", pattern: "hex", patternOpacity: 7, layout: "table", panel: "glass", corners: "round", font: "oswald", numFont: "jetbrains" },
  },
  {
    id: "cidade",
    name: "Cidade (vídeo)",
    theme: { preset: "cidade", colors: ["#0d1117", "#00e5ff", "#ffffff"], background: "/images/backgrounds/background_city.mp4", blur: true, secondary: "#7c4dff", bgStyle: "spotlight", pattern: "none", layout: "cards", panel: "glass", corners: "cut", font: "orbitron", numFont: "orbitron" },
  },
];

export const DEFAULT_THEME = THEME_PRESETS[0].theme;

export function themeForSeason(season: string): EventTheme {
  return THEME_PRESETS.find((p) => p.id === season)?.theme ?? DEFAULT_THEME;
}

/** Estilo completo, com os padrões preenchidos (temas antigos não têm os campos novos). */
export function resolveTvStyle(theme: EventTheme): TvStyle {
  const out = { ...TV_DEFAULTS } as TvStyle;
  for (const k of Object.keys(TV_DEFAULTS) as (keyof TvStyle)[]) {
    const v = theme[k];
    if (v !== undefined && v !== null) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

const HEX = /^#[0-9a-f]{6}$/i;

function pick<T extends string>(v: unknown, list: readonly { id: T }[], fallback: T | undefined): T | undefined {
  return list.some((o) => o.id === v) ? (v as T) : fallback;
}

export function sanitizeTheme(input: Partial<EventTheme> | null | undefined, fallback: EventTheme): EventTheme {
  const colors = (input?.colors ?? fallback.colors).map((c, i) => (HEX.test(c) ? c : fallback.colors[i])) as EventTheme["colors"];
  const bg = typeof input?.background === "string" && input.background.trim() ? input.background.trim() : null;
  const safeBg = bg && (bg.startsWith("/images/") || /^https:\/\//.test(bg)) ? bg.slice(0, 500) : null;
  const logo = typeof input?.logoUrl === "string" && /^https:\/\//.test(input.logoUrl) ? input.logoUrl.slice(0, 500) : null;
  const op = Number(input?.patternOpacity ?? fallback.patternOpacity);
  return {
    preset: typeof input?.preset === "string" ? input.preset.slice(0, 40) : "custom",
    colors,
    background: safeBg,
    blur: Boolean(input?.blur),
    logoUrl: logo,
    secondary: typeof input?.secondary === "string" && HEX.test(input.secondary) ? input.secondary : fallback.secondary,
    bgStyle: pick(input?.bgStyle, BG_STYLES, fallback.bgStyle),
    pattern: pick(input?.pattern, PATTERNS, fallback.pattern),
    patternOpacity: Number.isFinite(op) ? Math.min(30, Math.max(0, Math.round(op))) : undefined,
    layout: pick(input?.layout, LAYOUTS, fallback.layout),
    panel: pick(input?.panel, PANELS, fallback.panel),
    corners: pick(input?.corners, CORNERS, fallback.corners),
    font: pick(input?.font, FONTS, fallback.font),
    numFont: pick(input?.numFont, NUM_FONTS, fallback.numFont),
    motion: pick(input?.motion, MOTIONS, fallback.motion),
    medals: typeof input?.medals === "boolean" ? input.medals : fallback.medals,
    rankMoves: typeof input?.rankMoves === "boolean" ? input.rankMoves : fallback.rankMoves,
  };
}

export const isVideo = (url: string | null | undefined) => !!url && /\.(mp4|webm)(\?|$)/i.test(url);
