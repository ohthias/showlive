/**
 * Telão: aviso atual da organização e câmera. Funções puras (servidor,
 * hub e telão).
 */

/* --------------------------------------------------------------- aviso */

export type ScreenMessageTone = "info" | "alert" | "celebrate";

/** O aviso que está no telão agora. Só existe um: enviar outro substitui. */
export interface ScreenMessage {
  text: string;
  tone: ScreenMessageTone;
  /** Quando foi enviado (ms). */
  at: number;
  /** Some sozinho a partir deste instante (ms); null = até a organização tirar. */
  until: number | null;
}

export const MESSAGE_MAX = 140;
export const MESSAGE_DURATIONS = [0, 1, 5, 10, 15, 30, 60] as const;

export const TONES: Record<ScreenMessageTone, { label: string; hint: string }> = {
  info: { label: "Aviso", hint: "Informação geral (intervalo, horários)" },
  alert: { label: "Atenção", hint: "Chamada urgente (equipe X na mesa 2)" },
  celebrate: { label: "Destaque", hint: "Parabéns, recordes, agradecimentos" },
};

export function cleanMessage(text: unknown) {
  return String(text ?? "").replace(/\s+/g, " ").trim().slice(0, MESSAGE_MAX);
}

/** O aviso ainda deve aparecer? (usa o relógio corrigido do servidor) */
export function messageVisible(m: ScreenMessage | null | undefined, now: number): m is ScreenMessage {
  return !!m && !!m.text && (m.until === null || now < m.until);
}

/* -------------------------------------------------------------- câmera */

/** local = câmera ligada ao computador do telão · url = transmissão (YouTube, Twitch, Vimeo, vídeo direto). */
export type CameraSource = "local" | "url";
/** pip = janela no canto · split = lado a lado com a classificação · full = câmera ocupa o telão. */
export type CameraLayout = "pip" | "split" | "full";
export type CameraCorner = "br" | "bl" | "tr" | "tl";

export interface CameraSettings {
  enabled: boolean;
  source: CameraSource;
  url: string;
  layout: CameraLayout;
  corner: CameraCorner;
  /** Tamanho da janela no canto. */
  size: "s" | "m" | "l";
  /** Legenda opcional ("Arena 1", "Ao vivo da mesa 2"). */
  label: string;
  /** Espelhar a imagem (webcam virada para o operador). */
  mirror: boolean;
}

export const DEFAULT_CAMERA: CameraSettings = {
  enabled: false,
  source: "local",
  url: "",
  layout: "pip",
  corner: "br",
  size: "m",
  label: "",
  mirror: false,
};

const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);

export function sanitizeCamera(raw: unknown, base: CameraSettings = DEFAULT_CAMERA): CameraSettings {
  const r = (raw ?? {}) as Partial<CameraSettings>;
  const url = r.url === undefined ? base.url : String(r.url ?? "").trim().slice(0, 500);
  if (url && !/^https:\/\//i.test(url)) throw new Error("Use um link https:// da transmissão.");
  return {
    enabled: r.enabled === undefined ? base.enabled : !!r.enabled,
    source: oneOf(r.source, ["local", "url"] as const, base.source),
    url,
    layout: oneOf(r.layout, ["pip", "split", "full"] as const, base.layout),
    corner: oneOf(r.corner, ["br", "bl", "tr", "tl"] as const, base.corner),
    size: oneOf(r.size, ["s", "m", "l"] as const, base.size),
    label: r.label === undefined ? base.label : String(r.label ?? "").replace(/\s+/g, " ").trim().slice(0, 40),
    mirror: r.mirror === undefined ? base.mirror : !!r.mirror,
  };
}

export type CameraEmbed = { kind: "iframe"; src: string; provider: string } | { kind: "video"; src: string; provider: string };

/**
 * Converte o link colado pela organização no que o telão sabe exibir.
 * `host` é o domínio do telão (a Twitch exige o parâmetro parent).
 */
export function cameraEmbed(url: string, host = "showlive.robostage.com.br"): CameraEmbed | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const h = u.hostname.replace(/^www\.|^m\./, "");

  if (h === "youtube.com" || h === "youtu.be" || h === "youtube-nocookie.com") {
    let id = "";
    if (h === "youtu.be") id = u.pathname.slice(1);
    else if (u.searchParams.get("v")) id = u.searchParams.get("v")!;
    else {
      const m = u.pathname.match(/^\/(?:live|embed|shorts)\/([\w-]{6,})/);
      if (m) id = m[1];
    }
    id = id.split("/")[0];
    if (!/^[\w-]{6,20}$/.test(id)) return null;
    return {
      kind: "iframe",
      provider: "YouTube",
      src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&controls=0&playsinline=1&rel=0&modestbranding=1`,
    };
  }
  if (h === "twitch.tv") {
    const channel = u.pathname.split("/").filter(Boolean)[0] ?? "";
    if (!/^\w{3,25}$/.test(channel)) return null;
    return { kind: "iframe", provider: "Twitch", src: `https://player.twitch.tv/?channel=${channel}&parent=${encodeURIComponent(host)}&muted=true&autoplay=true` };
  }
  if (h === "vimeo.com" || h === "player.vimeo.com") {
    const id = u.pathname.match(/(\d{5,})/)?.[1];
    if (!id) return null;
    return { kind: "iframe", provider: "Vimeo", src: `https://player.vimeo.com/video/${id}?autoplay=1&muted=1&background=1` };
  }
  if (/\.(mp4|webm|m3u8)$/i.test(u.pathname)) return { kind: "video", provider: "Vídeo", src: u.toString() };
  return null;
}
