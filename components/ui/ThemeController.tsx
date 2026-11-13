"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const LIGHT = "lightScheme";
const DARK = "darkScheme";
const KEY = "theme";

/** Mesmo controle do RoboStage (mesma chave de armazenamento). */
export function ThemeController() {
  const [theme, setTheme] = useState(LIGHT);

  useEffect(() => {
    const saved = localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY) ?? LIGHT;
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  const toggle = () => {
    const next = theme === LIGHT ? DARK : LIGHT;
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(KEY, next);
  };

  return (
    <label
      className="swap swap-rotate cursor-pointer rounded-full p-2 transition-colors hover:bg-base-300"
      aria-label="Alternar tema claro/escuro"
    >
      <input type="checkbox" checked={theme === DARK} onChange={toggle} />
      <Sun className="swap-off size-5" />
      <Moon className="swap-on size-5" />
    </label>
  );
}

/** Evita o "piscar" de tema claro antes da hidratação. */
export const themeBootScript = `try{var t=localStorage.getItem("${KEY}")||sessionStorage.getItem("${KEY}");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
