"use client";

import "@/components/live/tv-fonts";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Check, ExternalLink, RotateCcw, Save } from "lucide-react";
import { updateSettings, updateTheme } from "@/app/actions/settings";
import { cornerBtn, Panel } from "@/components/ui/brand";
import { useToast } from "@/components/ui/Toast";
import type { EventTheme } from "@/db/schema";
import type { LiveSettings } from "@/lib/live-types";
import {
  BG_STYLES,
  CORNERS,
  FONTS,
  LAYOUTS,
  MOTIONS,
  NUM_FONTS,
  PANELS,
  PATTERNS,
  fontCss,
  isVideo,
  resolveTvStyle,
  THEME_PRESETS,
  type TvStyle,
} from "@/lib/themes";
import { SettingToggle } from "./SettingToggle";

export function ThemeEditor({
  eventId,
  code,
  theme,
  settings,
}: {
  eventId: string;
  code: string | null;
  theme: EventTheme;
  settings: LiveSettings;
}) {
  const [draft, setDraft] = useState<EventTheme>(theme);
  const [rows, setRows] = useState(settings.rowsPerPage);
  const [pending, start] = useTransition();
  const [frameKey, setFrameKey] = useState(0);
  const { addToast } = useToast();
  const dirty = JSON.stringify(draft) !== JSON.stringify(theme);

  const save = () =>
    start(async () => {
      const r = await updateTheme(eventId, draft);
      if (!r.ok) return addToast(r.error, "error");
      addToast("Tema aplicado no telão.", "success");
      setFrameKey((k) => k + 1);
    });

  const setColor = (i: 0 | 1 | 2, v: string) => {
    const colors = [...draft.colors] as EventTheme["colors"];
    colors[i] = v;
    setDraft({ ...draft, colors, preset: "custom" });
  };
  const st = resolveTvStyle(draft);
  const set = <K extends keyof TvStyle>(k: K, v: TvStyle[K]) => setDraft((d) => ({ ...d, [k]: v, preset: "custom" }));

  /* prévia ao vivo: manda o rascunho para o iframe a cada mudança */
  const frame = useRef<HTMLIFrameElement>(null);
  const push = useCallback(() => {
    frame.current?.contentWindow?.postMessage({ type: "showlive:theme", theme: draft }, window.location.origin);
  }, [draft]);
  useEffect(push, [push]);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.type === "showlive:preview-ready") push();
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [push]);

  return (
    <div className="space-y-6">
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <Panel
          kicker="/ VISUAL"
          title="Estilo do telão"
          action={
            <div className="flex items-center gap-1.5">
              {dirty && (
                <button type="button" onClick={() => setDraft(theme)} className="btn btn-ghost btn-sm" title="Descartar mudanças">
                  <RotateCcw size={14} />
                </button>
              )}
              <button type="button" onClick={save} disabled={!dirty || pending} className={`btn btn-sm btn-primary ${cornerBtn}`}>
                {pending ? <span className="loading loading-spinner loading-xs" /> : <Save size={14} />} Aplicar
              </button>
            </div>
          }
        >
          <Section title="Temas prontos" first>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {THEME_PRESETS.map((p) => {
                const [bg, accent, text] = p.theme.colors;
                const ps = resolveTvStyle(p.theme);
                const active = draft.preset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setDraft({ ...p.theme, logoUrl: draft.logoUrl, motion: st.motion, medals: st.medals, rankMoves: st.rankMoves })}
                    className={`relative h-24 overflow-hidden rounded-tl-xl rounded-br-xl border-2 text-left transition ${
                      active ? "border-base-content shadow-[3px_3px_0_0_var(--color-base-content)]" : "border-transparent hover:-translate-y-0.5"
                    }`}
                    style={{ background: bg, color: text, ["--tv-text" as string]: text }}
                  >
                    {p.theme.background && !isVideo(p.theme.background) && (
                      <span className="absolute inset-0 bg-cover bg-center opacity-45" style={{ backgroundImage: `url(${p.theme.background})` }} />
                    )}
                    {!p.theme.background && (
                      <span
                        className="absolute inset-0"
                        style={{ background: `radial-gradient(120% 90% at 0% 0%, color-mix(in oklab, ${accent} 35%, transparent), transparent 60%), radial-gradient(100% 80% at 100% 100%, color-mix(in oklab, ${ps.secondary} 30%, transparent), transparent 60%)` }}
                      />
                    )}
                    {ps.pattern !== "none" && <span className="tv-pattern" data-p={ps.pattern} style={{ ["--tv-pat-op" as string]: 0.18 }} />}
                    <span className="absolute right-2 top-2 flex gap-1">
                      <span className="size-4 rounded-tl-md rounded-br-md" style={{ background: accent }} />
                      <span className="size-4 rounded-tl-md rounded-br-md" style={{ background: ps.secondary }} />
                    </span>
                    <span className="absolute bottom-2 left-2.5 right-2 truncate text-base font-bold" style={{ fontFamily: fontCss(ps.font) }}>
                      {p.name}
                    </span>
                    {active && <Check size={14} className="absolute left-2 top-2" />}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="Cores">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(["Fundo", "Destaque", "Texto"] as const).map((label, i) => (
                <ColorField key={label} label={label} value={draft.colors[i]} onChange={(v) => setColor(i as 0 | 1 | 2, v)} />
              ))}
              <ColorField label="Secundária" value={st.secondary} onChange={(v) => set("secondary", v)} />
            </div>
            <ContrastHint bg={draft.colors[0]} fg={draft.colors[2]} />
          </Section>

          <Section title="Fundo">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {BG_STYLES.map((b) => (
                <Option key={b.id} active={st.bgStyle === b.id} onClick={() => set("bgStyle", b.id)} disabled={!!draft.background}>
                  <span className="block h-10 w-full rounded-tl-md rounded-br-md" style={{ background: bgSwatch(b.id, draft.colors[0], draft.colors[1], st.secondary) }} />
                  <span className="mt-1.5 block text-xs font-semibold">{b.label}</span>
                </Option>
              ))}
            </div>
            {draft.background && <p className="mt-2 text-xs text-base-content/55">Com imagem ou vídeo de fundo, o estilo de fundo fica por conta da mídia.</p>}

            <p className="mb-2 mt-5 text-sm font-medium">Padrão</p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {PATTERNS.map((pt) => (
                <Option key={pt.id} active={st.pattern === pt.id} onClick={() => set("pattern", pt.id)}>
                  <span
                    className="relative block h-10 w-full overflow-hidden rounded-tl-md rounded-br-md"
                    style={{ background: draft.colors[0], ["--tv-text" as string]: draft.colors[2] }}
                  >
                    {pt.id !== "none" && <span className="tv-pattern" data-p={pt.id} style={{ ["--tv-pat-op" as string]: 0.7 }} />}
                  </span>
                  <span className="mt-1.5 block text-xs font-semibold">{pt.label}</span>
                </Option>
              ))}
            </div>
            {st.pattern !== "none" && (
              <div className="mt-3 flex items-center gap-3">
                <span className="text-xs font-medium">Intensidade</span>
                <input type="range" min={2} max={30} value={st.patternOpacity} onChange={(e) => set("patternOpacity", Number(e.target.value))} className="range range-xs range-primary flex-1" />
                <span className="w-8 text-right font-mono text-xs">{st.patternOpacity}%</span>
              </div>
            )}

            <label className="mt-5 block">
              <span className="text-sm font-medium">Imagem ou vídeo de fundo (opcional)</span>
              <input
                value={draft.background ?? ""}
                onChange={(e) => setDraft({ ...draft, background: e.target.value || null, preset: "custom" })}
                placeholder="https://… (.jpg, .png, .webp ou .mp4)"
                className="input input-bordered input-sm mt-1 w-full"
              />
            </label>
            {draft.background && (
              <label className="mt-2 flex cursor-pointer items-center gap-3">
                <input type="checkbox" className="checkbox checkbox-sm" checked={draft.blur} onChange={(e) => setDraft({ ...draft, blur: e.target.checked })} />
                <span className="text-sm">Desfocar a mídia (melhora a leitura)</span>
              </label>
            )}
            <label className="mt-3 block">
              <span className="text-sm font-medium">Logo do evento (opcional)</span>
              <input
                value={draft.logoUrl ?? ""}
                onChange={(e) => setDraft({ ...draft, logoUrl: e.target.value || null })}
                placeholder="https://…/logo.png"
                className="input input-bordered input-sm mt-1 w-full"
              />
            </label>
          </Section>

          <Section title="Tabela de classificação">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {LAYOUTS.map((l) => (
                <Option key={l.id} active={st.layout === l.id} onClick={() => set("layout", l.id)}>
                  <LayoutGlyph id={l.id} />
                  <span className="mt-1.5 block text-xs font-semibold">{l.label}</span>
                  <span className="block text-[11px] leading-tight text-base-content/55">{l.hint}</span>
                </Option>
              ))}
            </div>
            <div className="mt-4 grid gap-4">
              <Segmented label="Painéis" value={st.panel} options={PANELS} onChange={(v) => set("panel", v)} />
              <Segmented label="Cantos" value={st.corners} options={CORNERS} onChange={(v) => set("corners", v)} />
            </div>
          </Section>

          <Section title="Fontes">
            <p className="mb-2 text-sm font-medium">Títulos e nomes das equipes</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FONTS.map((ft) => (
                <Option key={ft.id} active={st.font === ft.id} onClick={() => set("font", ft.id)}>
                  <span className={`block text-lg font-bold leading-tight ${ft.caps ? "uppercase" : ""}`} style={{ fontFamily: ft.css }}>
                    Robô 42
                  </span>
                  <span className="mt-0.5 block text-[11px] text-base-content/55">{ft.label}</span>
                </Option>
              ))}
            </div>
            <p className="mb-2 mt-4 text-sm font-medium">Números e pontuação</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {NUM_FONTS.map((nf) => (
                <Option key={nf.id} active={st.numFont === nf.id} onClick={() => set("numFont", nf.id)}>
                  <span className="block text-xl font-black tabular-nums" style={{ fontFamily: nf.css ?? fontCss(st.font) }}>
                    1.285
                  </span>
                  <span className="mt-0.5 block text-[11px] text-base-content/55">{nf.label}</span>
                </Option>
              ))}
            </div>
          </Section>

          <Section title="Animações">
            <div className="grid gap-2 sm:grid-cols-3">
              {MOTIONS.map((m) => (
                <Option key={m.id} active={st.motion === m.id} onClick={() => set("motion", m.id)}>
                  <span className="block text-sm font-semibold">{m.label}</span>
                  <span className="block text-[11px] leading-tight text-base-content/55">{m.hint}</span>
                </Option>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              <label className="flex cursor-pointer items-center gap-3">
                <input type="checkbox" className="toggle toggle-sm toggle-primary" checked={st.medals} onChange={(e) => set("medals", e.target.checked)} />
                <span className="text-sm">Medalhas de ouro, prata e bronze no top 3</span>
              </label>
              <label className="flex cursor-pointer items-center gap-3">
                <input type="checkbox" className="toggle toggle-sm toggle-primary" checked={st.rankMoves} onChange={(e) => set("rankMoves", e.target.checked)} />
                <span className="text-sm">Setas de quem subiu ou caiu de posição</span>
              </label>
            </div>
          </Section>
        </Panel>

        <div className="xl:sticky xl:top-16">
          <Panel
            kicker="/ PRÉVIA AO VIVO"
            title="Como o público vê"
            action={
              <a href={code ? `/e/${code}` : `/hub/${eventId}/previa`} target="_blank" className="btn btn-ghost btn-xs">
                Abrir <ExternalLink size={12} />
              </a>
            }
          >
            <div className="relative aspect-video w-full overflow-hidden rounded-tl-xl rounded-br-xl border border-base-300 bg-black">
              <iframe
                ref={frame}
                key={frameKey}
                src={`/hub/${eventId}/previa`}
                title="Prévia do telão"
                onLoad={push}
                className="absolute left-0 top-0 h-[400%] w-[400%] origin-top-left scale-25 border-0"
                style={{ pointerEvents: "none" }}
              />
            </div>
            <p className={`mt-2 text-xs ${dirty ? "text-warning" : "text-base-content/50"}`}>
              {dirty ? "A prévia mostra o rascunho. Clique em Aplicar para levar ao telão." : "A prévia acompanha cada mudança antes de aplicar."}
            </p>
          </Panel>
        </div>
      </div>

      <Panel kicker="/ EXIBIÇÃO" title="O que aparece no telão">
        <div className="grid gap-3 md:grid-cols-2">
          <SettingToggle eventId={eventId} name="hideScoresUntilRoundEnds" value={settings.hideScoresUntilRoundEnds} label="Ocultar notas até a rodada terminar" hint="O público vê só ✓ até todas as equipes jogarem. Aplicado no servidor." />
          <SettingToggle eventId={eventId} name="celebrateScores" value={settings.celebrateScores} label="Comemorar cada nota" hint="Tela cheia com confete quando uma nota chega." />
          <SettingToggle eventId={eventId} name="highlightLeader" value={settings.highlightLeader} label="Destacar a líder" />
          <SettingToggle eventId={eventId} name="showTicker" value={settings.showTicker} label="Letreiro de resultados" hint="Últimas notas e resultados rolando no rodapé. Avisos da organização aparecem em destaque, um de cada vez." />
          <SettingToggle eventId={eventId} name="showTimer" value={settings.showTimer} label="Mostrar cronômetro" />
          <SettingToggle eventId={eventId} name="showBrackets" value={settings.showBrackets} label="Mostrar chave dos playoffs" />
          <SettingToggle eventId={eventId} name="showTeamDetails" value={settings.showTeamDetails} label="Mostrar número e escola das equipes" hint="Desligue para um telão mais limpo ou por privacidade." />
          <SettingToggle eventId={eventId} name="showQrCode" value={settings.showQrCode} label="QR code para acompanhar no celular" hint="Canto do telão com o link do evento. Some quando o evento sai do ar." />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-tl-xl rounded-br-xl bg-base-200/70 px-4 py-3">
          <span className="text-sm font-medium">Equipes por página</span>
          <input type="range" min={5} max={20} value={rows} onChange={(e) => setRows(Number(e.target.value))} className="range range-sm range-primary w-48" />
          <span className="w-6 font-mono font-bold">{rows}</span>
          <button
            type="button"
            className="btn btn-xs"
            disabled={rows === settings.rowsPerPage || pending}
            onClick={() =>
              start(async () => {
                const r = await updateSettings(eventId, { rowsPerPage: rows });
                if (!r.ok) addToast(r.error, "error");
              })
            }
          >
            Salvar
          </button>
          <span className="text-xs text-base-content/55">Com mais equipes, o telão alterna as páginas a cada 12 s.</span>
        </div>
      </Panel>
    </div>
  );
}


/* ------------------------------------------------------------ helpers */

function Section({ title, children, first }: { title: string; children: React.ReactNode; first?: boolean }) {
  return (
    <div className={first ? "" : "mt-6 border-t border-base-300 pt-5"}>
      <p className="kicker mb-3">{title}</p>
      {children}
    </div>
  );
}

function Option({ active, onClick, children, disabled }: { active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`relative rounded-tl-xl rounded-br-xl border p-2 text-left transition disabled:opacity-40 ${
        active ? "border-base-content bg-base-200 shadow-[2px_2px_0_0_var(--color-base-content)]" : "border-base-300 hover:border-base-content/40"
      }`}
    >
      {children}
    </button>
  );
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      <div className="flex rounded-tl-lg rounded-br-lg border border-base-300 p-0.5">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`flex-1 rounded-tl-md rounded-br-md px-2 py-1.5 text-xs font-semibold transition ${value === o.id ? "bg-base-content text-base-100" : "hover:bg-base-200"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-tl-lg rounded-br-lg border border-base-300 p-2">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="size-8 cursor-pointer rounded border-0 bg-transparent" />
      <span className="text-xs">
        <span className="block font-medium">{label}</span>
        <span className="font-mono text-base-content/50">{value}</span>
      </span>
    </label>
  );
}

function luminance(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function ContrastHint({ bg, fg }: { bg: string; fg: string }) {
  const [a, b] = [luminance(bg), luminance(fg)].sort((x, y) => y - x);
  const ratio = (a + 0.05) / (b + 0.05);
  if (ratio >= 7) return null;
  return (
    <p className={`mt-2 text-xs ${ratio < 4.5 ? "text-error" : "text-warning"}`}>
      Contraste texto/fundo {ratio.toFixed(1)}:1 — {ratio < 4.5 ? "difícil de ler num telão; escureça o fundo ou clareie o texto." : "aceitável, mas em projetor fica melhor acima de 7:1."}
    </p>
  );
}

function bgSwatch(id: TvStyle["bgStyle"], bg: string, accent: string, sec: string) {
  const m = (c: string, p: number) => `color-mix(in oklab, ${c} ${p}%, transparent)`;
  switch (id) {
    case "gradient":
      return `linear-gradient(135deg, ${bg} 30%, color-mix(in oklab, ${sec} 45%, ${bg}))`;
    case "spotlight":
      return `radial-gradient(90% 120% at 0% 0%, ${m(accent, 45)}, transparent 60%), ${bg}`;
    case "aurora":
      return `radial-gradient(60% 90% at 20% 10%, ${m(accent, 60)}, transparent 70%), radial-gradient(60% 90% at 85% 40%, ${m(sec, 55)}, transparent 70%), ${bg}`;
    case "mesh":
      return `radial-gradient(40% 60% at 15% 25%, ${m(accent, 40)}, transparent 70%), radial-gradient(40% 60% at 85% 20%, ${m(sec, 40)}, transparent 70%), radial-gradient(50% 60% at 60% 100%, ${m(accent, 30)}, transparent 70%), ${bg}`;
    default:
      return bg;
  }
}

function LayoutGlyph({ id }: { id: TvStyle["layout"] }) {
  const bar = "rounded-sm bg-base-content/25";
  return (
    <span className="flex h-12 w-full flex-col justify-center gap-[3px] rounded-tl-md rounded-br-md bg-base-200 p-1.5">
      {id === "table" && (
        <>
          <span className="h-1.5 rounded-sm bg-primary/70" />
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`h-1 ${bar}`} />
          ))}
        </>
      )}
      {id === "cards" && [0, 1, 2].map((i) => <span key={i} className={`h-2 ${bar} rounded-tl-sm rounded-br-sm`} />)}
      {id === "compact" && [0, 1, 2, 3, 4, 5].map((i) => <span key={i} className={`h-[3px] ${bar}`} />)}
      {id === "split" && (
        <span className="grid grid-cols-2 gap-1">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} className={`h-1.5 ${bar}`} />
          ))}
        </span>
      )}
    </span>
  );
}
