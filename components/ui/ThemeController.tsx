"use client";

import { ThemeToggle } from "@/components/stage";

const KEY = "theme";

/** Alternador de tema da Stage UI (mesma chave de armazenamento do RoboStage). */
export function ThemeController({ className }: { className?: string }) {
  return <ThemeToggle className={className} />;
}

/** Evita o "piscar" de tema claro antes da hidratação. */
export const themeBootScript = `try{var t=localStorage.getItem("${KEY}")||sessionStorage.getItem("${KEY}");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
