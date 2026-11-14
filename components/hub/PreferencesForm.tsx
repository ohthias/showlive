"use client";

import { useState, useTransition } from "react";
import { ClipboardCheck, LayoutDashboard, Radio, RotateCcw, Save } from "lucide-react";
import { savePreferences } from "@/app/actions/challenges";
import { cornerBtn, Panel } from "@/components/ui/brand";
import { useToast } from "@/components/ui/Toast";
import { SEASONS } from "@/lib/missions";
import { DEFAULT_PREFS, type UserPrefs } from "@/lib/prefs";
import { THEME_PRESETS } from "@/lib/themes";

export function PreferencesForm({ initial }: { initial: UserPrefs }) {
  const [p, setP] = useState(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [pending, start] = useTransition();
  const { addToast } = useToast();
  const dirty = JSON.stringify(p) !== saved;
  const set = <K extends keyof UserPrefs>(k: K, v: UserPrefs[K]) => setP((x) => ({ ...x, [k]: v }));

  const toggle = (k: keyof UserPrefs, label: string, hint?: string) => (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-tl-xl rounded-br-xl bg-base-200/70 px-4 py-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-base-content/55">{hint}</span>}
      </span>
      <input type="checkbox" className="toggle toggle-primary mt-0.5" checked={p[k] as boolean} onChange={(e) => set(k, e.target.checked as never)} />
    </label>
  );

  return (
    <div className="space-y-6">
      <Panel kicker="/ EVENTO NOVO" title="Valores padrão ao criar um evento" action={<Radio size={16} className="text-base-content/40" />}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label>
            <span className="text-sm font-medium">Formato</span>
            <select value={p.defaultFormat} onChange={(e) => set("defaultFormat", e.target.value as UserPrefs["defaultFormat"])} className="select select-bordered mt-1 w-full">
              <option value="fll">FLL Challenge</option>
              <option value="fll_fe">FLL Future Edition</option>
              <option value="obr">OBR Resgate</option>
              <option value="custom">Desafio personalizado</option>
              <option value="alliance">Alianças (FTC e similares)</option>
            </select>
          </label>
          <label>
            <span className="text-sm font-medium">Temporada FLL</span>
            <select value={p.defaultSeason} onChange={(e) => set("defaultSeason", e.target.value)} className="select select-bordered mt-1 w-full">
              {SEASONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} · {s.year}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-sm font-medium">Tema do telão</span>
            <select value={p.defaultTheme} onChange={(e) => set("defaultTheme", e.target.value)} className="select select-bordered mt-1 w-full">
              <option value="season">Tema da temporada (FLL)</option>
              {THEME_PRESETS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-sm font-medium">Rodadas classificatórias</span>
            <input type="number" min={1} max={8} value={p.defaultRounds} onChange={(e) => set("defaultRounds", Number(e.target.value))} className="input input-bordered mt-1 w-full" />
          </label>
          <label>
            <span className="text-sm font-medium">Cronômetro (segundos)</span>
            <input type="number" min={10} max={3600} value={p.defaultTimerSec} onChange={(e) => set("defaultTimerSec", Number(e.target.value))} className="input input-bordered mt-1 w-full" />
          </label>
          <label>
            <span className="text-sm font-medium">Critério do ranking</span>
            <select value={p.defaultRankingMode} onChange={(e) => set("defaultRankingMode", e.target.value as UserPrefs["defaultRankingMode"])} className="select select-bordered mt-1 w-full">
              <option value="best">Melhor nota (FLL)</option>
              <option value="sum">Soma das rodadas</option>
            </select>
          </label>
          <label>
            <span className="text-sm font-medium">Mesas de arbitragem</span>
            <input type="number" min={1} max={10} value={p.defaultMesaCount} onChange={(e) => set("defaultMesaCount", Number(e.target.value))} className="input input-bordered mt-1 w-full" />
            <span className="mt-1 block text-xs text-base-content/55">Um código por mesa, gerado quando o evento fica ao vivo.</span>
          </label>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {toggle("defaultShowTimer", "Telão mostra o cronômetro")}
          {toggle("defaultHideScores", "Ocultar notas até a rodada terminar")}
          {toggle("defaultCelebrate", "Comemorar cada nota no telão")}
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel kicker="/ MESA" title="Quando você arbitra" action={<ClipboardCheck size={16} className="text-base-content/40" />}>
          <div className="space-y-3">
            {toggle("mesaConfirmBeforeSend", "Confirmar antes de enviar a nota", "Desligue se você revisa a súmula antes de tocar em Enviar.")}
            {toggle("mesaKeepScreenOn", "Manter a tela ligada", "O celular ou tablet não apaga enquanto a mesa estiver aberta.")}
          </div>
        </Panel>
        <Panel kicker="/ HUB" title="Exibição" action={<LayoutDashboard size={16} className="text-base-content/40" />}>
          {toggle("hubCompactLists", "Listas compactas", "Menos espaço entre as linhas de equipes e notas.")}
        </Panel>
      </div>

      <div className="sticky bottom-4 flex justify-end gap-2">
        <button type="button" className="btn btn-ghost bg-base-100" onClick={() => setP(DEFAULT_PREFS)}>
          <RotateCcw size={15} /> Restaurar padrão
        </button>
        <button
          type="button"
          disabled={!dirty || pending}
          className={`btn btn-primary ${cornerBtn} shadow-[4px_4px_0_0_var(--color-base-content)]`}
          onClick={() =>
            start(async () => {
              const r = await savePreferences(p);
              if (!r.ok) return addToast(r.error, "error");
              setSaved(JSON.stringify(p));
              addToast("Preferências salvas.", "success");
            })
          }
        >
          {pending ? <span className="loading loading-spinner loading-sm" /> : <Save size={15} />} Salvar preferências
        </button>
      </div>
    </div>
  );
}
