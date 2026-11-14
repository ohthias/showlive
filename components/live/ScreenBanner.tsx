"use client";

import { Megaphone, PartyPopper, TriangleAlert } from "lucide-react";
import { useServerClock } from "@/hooks/useLiveEvent";
import { messageVisible, type ScreenMessage } from "@/lib/screen";

const ALERT = "#e5484d";

/** O aviso atual da organização, em destaque no telão. Só um por vez. */
export function ScreenBanner({
  message,
  clockOffset,
  accent,
  bg,
  secondary,
  overlay = false,
}: {
  message: ScreenMessage | null;
  clockOffset: number;
  accent: string;
  bg: string;
  secondary: string;
  /** Sobre a câmera em tela cheia. */
  overlay?: boolean;
}) {
  const now = useServerClock(clockOffset, 1000);
  if (!messageVisible(message, now)) return null;
  const m = message;
  const Icon = m.tone === "alert" ? TriangleAlert : m.tone === "celebrate" ? PartyPopper : Megaphone;
  const style =
    m.tone === "alert"
      ? { background: ALERT, color: "#fff" }
      : m.tone === "celebrate"
        ? { background: `linear-gradient(100deg, ${accent}, ${secondary})`, color: bg }
        : { background: accent, color: bg };
  // Barra de tempo restante quando o aviso some sozinho.
  const pct = m.until ? Math.max(0, Math.min(100, ((m.until - now) / (m.until - m.at)) * 100)) : null;

  return (
    <div
      key={m.at}
      role="status"
      aria-live="polite"
      className={`celebrate-in tv-r-lg relative flex items-center gap-4 overflow-hidden px-5 py-3 shadow-lg md:px-7 md:py-4 ${overlay ? "absolute inset-x-6 bottom-6 z-20" : "mt-5"} ${
        m.tone === "alert" ? "tv-alert" : ""
      }`}
      style={style}
    >
      <Icon className="shrink-0" size={30} />
      <p className="tv-display min-w-0 flex-1 text-xl font-black leading-tight md:text-3xl 2xl:text-4xl">{m.text}</p>
      {pct !== null && <span className="absolute inset-x-0 bottom-0 h-1 bg-current opacity-40 transition-[width] duration-1000" style={{ width: `${pct}%` }} />}
    </div>
  );
}
