"use client";

import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";

/**
 * Ajustes do voluntário, só neste aparelho (localStorage). Não dependem de
 * conta: cada tablet/celular da mesa guarda os seus.
 */
export interface MesaDevicePrefs {
  dark: boolean;
  large: boolean;
  vibrate: boolean;
  keepScreenOn: boolean;
}

const KEY = "showlive:mesa-aparelho";

export function useMesaDevicePrefs(keepScreenOnDefault: boolean) {
  const [prefs, setPrefs] = useState<MesaDevicePrefs>({ dark: false, large: false, vibrate: true, keepScreenOn: keepScreenOnDefault });

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<MesaDevicePrefs> | null;
      const theme = document.documentElement.getAttribute("data-theme");
      setPrefs((p) => ({ ...p, dark: theme === "darkScheme", ...(saved ?? {}) }));
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", prefs.dark ? "darkScheme" : "lightScheme");
  }, [prefs.dark]);

  const update = (next: MesaDevicePrefs) => {
    setPrefs(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      localStorage.setItem("theme", next.dark ? "darkScheme" : "lightScheme");
    } catch {}
  };
  return [prefs, update] as const;
}

export function MesaDeviceMenu({ prefs, onChange }: { prefs: MesaDevicePrefs; onChange: (p: MesaDevicePrefs) => void }) {
  const row = (key: keyof MesaDevicePrefs, label: string, hint: string) => (
    <label className="flex cursor-pointer items-start justify-between gap-3 py-2">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-base-content/55">{hint}</span>
      </span>
      <input type="checkbox" className="toggle toggle-sm toggle-primary mt-0.5" checked={prefs[key]} onChange={(e) => onChange({ ...prefs, [key]: e.target.checked })} />
    </label>
  );
  return (
    <div className="dropdown dropdown-end">
      <button type="button" tabIndex={0} className="btn btn-ghost btn-sm btn-square" aria-label="Ajustes da mesa neste aparelho">
        <Settings2 size={18} />
      </button>
      <div tabIndex={0} className="dropdown-content z-40 mt-2 w-72 rounded-tl-2xl rounded-br-2xl border-2 border-base-content bg-base-100 p-4 shadow-[6px_6px_0_0_var(--color-base-content)]">
        <p className="kicker">/ AJUSTES DESTE APARELHO</p>
        <div className="mt-1 divide-y divide-base-300">
          {row("dark", "Tema escuro", "Melhor em ginásio escuro ou à noite.")}
          {row("large", "Botões grandes", "Alvos maiores para tocar rápido.")}
          {row("vibrate", "Vibrar ao enviar", "Confirmação tátil quando a nota é salva.")}
          {row("keepScreenOn", "Manter tela ligada", "O aparelho não apaga com a mesa aberta.")}
        </div>
      </div>
    </div>
  );
}
