/**
 * Cenas do telão. Uma cena é uma disposição pronta (o que aparece e como),
 * criada pela organização. O evento guarda até 4 cenas e qual está no ar; sem
 * cena no ar o telão usa o modo automático (classificação em slides, como
 * sempre foi). Funções puras: servidor, hub e telão.
 *
 * Fica em event_settings.scenes, que tem gatilho de revisão: trocar a cena no
 * hub chega ao telão na hora pelo SSE.
 */

export const MAX_SCENES = 4;

export type SceneLayout = "ranking" | "leaders" | "spotlight" | "title" | "camera" | "podium";
/** Tabela da classificação: "theme" = a escolhida no estilo do telão. */
export type SceneBoard = "theme" | "table" | "cards" | "compact" | "split";
export type SceneToggle = "auto" | "on" | "off";

export interface Scene {
  id: string;
  name: string;
  layout: SceneLayout;
  /** Classificação: estilo da tabela. */
  board: SceneBoard;
  /** Destaque / Rodada / Câmera: quantas equipes aparecem. */
  topN: 3 | 5 | 8 | 10;
  /** Mensagem: título grande e texto de apoio (título vazio = nome do evento). */
  title: string;
  subtitle: string;
  /** Mostra o cabeçalho (nome do evento, status, cronômetro). */
  showHeader: boolean;
  /** "auto" segue a configuração do evento; on/off força nesta cena. */
  showTimer: SceneToggle;
  showTicker: SceneToggle;
  showQr: SceneToggle;
  /** Classificação/Destaque: janela da câmera (se ligada) ou nunca. */
  camera: "auto" | "off";
}

export interface ScenesState {
  items: Scene[];
  /** Cena no ar. null = automático. */
  activeId: string | null;
}

export const EMPTY_SCENES: ScenesState = { items: [], activeId: null };

export const SCENE_LAYOUTS: Record<SceneLayout, { label: string; hint: string; name: string }> = {
  ranking: { label: "Classificação", hint: "A tabela completa, em páginas. Escolha o estilo da tabela.", name: "Classificação" },
  leaders: { label: "Destaque das líderes", hint: "As primeiras colocadas em cartões grandes, o resto em lista curta.", name: "Líderes" },
  spotlight: { label: "Rodada em andamento", hint: "Cronômetro gigante, rodada atual, top da classificação e últimas notas.", name: "Rodada ao vivo" },
  title: { label: "Mensagem / intervalo", hint: "Título grande com texto de apoio: abertura, intervalo, almoço, premiação.", name: "Intervalo" },
  camera: { label: "Câmera + faixa", hint: "A câmera em tela cheia com uma faixa da classificação embaixo.", name: "Câmera" },
  podium: { label: "Pódio", hint: "As três primeiras no pódio. Para a premiação.", name: "Pódio" },
};

export const SCENE_BOARDS: Record<SceneBoard, string> = {
  theme: "Do estilo do telão",
  table: "Clássica",
  cards: "Cartões",
  compact: "Compacta",
  split: "Duas colunas",
};

const LAYOUTS = Object.keys(SCENE_LAYOUTS) as SceneLayout[];
const BOARDS = Object.keys(SCENE_BOARDS) as SceneBoard[];
const TOGGLES: SceneToggle[] = ["auto", "on", "off"];
const TOPS = [3, 5, 8, 10] as const;

const oneOf = <T,>(v: unknown, list: readonly T[], fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);
const clean = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Padrões de cada disposição para uma cena nova. */
export function defaultScene(layout: SceneLayout, id: string): Scene {
  return {
    id,
    name: SCENE_LAYOUTS[layout].name,
    layout,
    board: "theme",
    topN: layout === "camera" ? 5 : layout === "spotlight" ? 5 : 3,
    title: layout === "title" ? "Intervalo" : "",
    subtitle: layout === "title" ? "Voltamos em instantes" : "",
    showHeader: layout !== "camera" && layout !== "title",
    showTimer: layout === "spotlight" ? "on" : "auto",
    showTicker: layout === "title" || layout === "podium" ? "off" : "auto",
    showQr: layout === "title" ? "on" : "auto",
    camera: "auto",
  };
}

export function newSceneId() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 10);
}

export function sanitizeScene(raw: unknown, fallbackId?: string): Scene {
  const r = (raw ?? {}) as Partial<Scene>;
  const id = /^[a-z0-9]{4,16}$/.test(String(r.id ?? "")) ? String(r.id) : (fallbackId ?? newSceneId());
  const layout = oneOf(r.layout, LAYOUTS, "ranking");
  const base = defaultScene(layout, id);
  const name = clean(r.name, 30) || base.name;
  return {
    id,
    name,
    layout,
    board: oneOf(r.board, BOARDS, base.board),
    topN: oneOf(Number(r.topN) as Scene["topN"], TOPS, base.topN),
    title: r.title === undefined ? base.title : clean(r.title, 60),
    subtitle: r.subtitle === undefined ? base.subtitle : clean(r.subtitle, 140),
    showHeader: r.showHeader === undefined ? base.showHeader : !!r.showHeader,
    showTimer: oneOf(r.showTimer, TOGGLES, base.showTimer),
    showTicker: oneOf(r.showTicker, TOGGLES, base.showTicker),
    showQr: oneOf(r.showQr, TOGGLES, base.showQr),
    camera: oneOf(r.camera, ["auto", "off"] as const, base.camera),
  };
}

/** Lê o que está no banco (pode estar vazio ou ser de uma versão antiga). */
export function sanitizeScenes(raw: unknown): ScenesState {
  const r = (raw ?? {}) as Partial<ScenesState>;
  const seen = new Set<string>();
  const items: Scene[] = [];
  for (const it of Array.isArray(r.items) ? r.items : []) {
    if (items.length >= MAX_SCENES) break;
    const s = sanitizeScene(it);
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    items.push(s);
  }
  const activeId = typeof r.activeId === "string" && seen.has(r.activeId) ? r.activeId : null;
  return { items, activeId };
}

export function activeScene(state: ScenesState | null | undefined): Scene | null {
  if (!state?.activeId) return null;
  return state.items.find((s) => s.id === state.activeId) ?? null;
}

/** Junta uma cena (nova ou editada) à lista, respeitando o limite. */
export function upsertScene(state: ScenesState, scene: Scene): ScenesState {
  const i = state.items.findIndex((s) => s.id === scene.id);
  if (i >= 0) return { ...state, items: state.items.map((s, k) => (k === i ? scene : s)) };
  if (state.items.length >= MAX_SCENES) throw new Error(`Limite de ${MAX_SCENES} cenas por evento.`);
  return { ...state, items: [...state.items, scene] };
}

export function removeScene(state: ScenesState, id: string): ScenesState {
  return { items: state.items.filter((s) => s.id !== id), activeId: state.activeId === id ? null : state.activeId };
}

export function moveScene(state: ScenesState, id: string, dir: -1 | 1): ScenesState {
  const i = state.items.findIndex((s) => s.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= state.items.length) return state;
  const items = [...state.items];
  [items[i], items[j]] = [items[j], items[i]];
  return { ...state, items };
}

const pick = (t: SceneToggle | undefined, fallback: boolean) => (t === "on" ? true : t === "off" ? false : fallback);

/** O que aparece no telão com esta cena (null = modo automático). */
export function sceneFlags(scene: Scene | null, settings: { showTimer: boolean; showTicker: boolean; showQrCode: boolean }) {
  return {
    header: scene ? scene.showHeader : true,
    timer: pick(scene?.showTimer, settings.showTimer),
    ticker: pick(scene?.showTicker, settings.showTicker),
    qr: pick(scene?.showQr, settings.showQrCode),
    /** Janela da câmera por cima da classificação. */
    cameraOverlay: !scene || ((scene.layout === "ranking" || scene.layout === "leaders") && scene.camera === "auto"),
  };
}
