"use client";

import { useState, useTransition } from "react";
import { Monitor, Save, Video, VideoOff, Youtube } from "lucide-react";
import { updateCamera } from "@/app/actions/settings";
import { cornerBtn, Panel, Tag } from "@/components/ui/brand";
import { useToast } from "@/components/ui/Toast";
import { cameraEmbed, type CameraSettings } from "@/lib/screen";

const LAYOUTS: { id: CameraSettings["layout"]; label: string; hint: string }[] = [
  { id: "pip", label: "Janela no canto", hint: "A classificação continua inteira; a câmera fica por cima, num canto." },
  { id: "split", label: "Lado a lado", hint: "Classificação à esquerda, câmera à direita." },
  { id: "full", label: "Tela cheia", hint: "A câmera ocupa o telão (finais, apresentações). Cabeçalho e aviso continuam." },
];

/** Configuração da câmera do telão (página Telão do hub). */
export function CameraSettingsPanel({ eventId, initial }: { eventId: string; initial: CameraSettings }) {
  const [cam, setCam] = useState(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [pending, start] = useTransition();
  const { addToast } = useToast();
  const dirty = JSON.stringify(cam) !== saved;
  const set = (p: Partial<CameraSettings>) => setCam((c) => ({ ...c, ...p }));
  const embed = cam.source === "url" && cam.url ? cameraEmbed(cam.url) : null;

  const save = (patch: Partial<CameraSettings> = {}) =>
    start(async () => {
      const next = { ...cam, ...patch };
      const r = await updateCamera(eventId, next);
      if (!r.ok) return addToast(r.error, "error", 5000);
      setCam(r.data);
      setSaved(JSON.stringify(r.data));
      addToast(r.data.enabled ? "Câmera no telão." : "Configuração da câmera salva.", "success");
    });

  return (
    <div id="camera" className="scroll-mt-24">
      <Panel
        kicker="/ CÂMERA"
        title="Câmera no telão"
        action={
          <div className="flex items-center gap-2">
            {initial.enabled || cam.enabled ? (
              <Tag className="border-error/50 bg-error/10 text-error">
                <span className="live-dot" /> {cam.enabled ? "LIGADA" : "DESLIGADA"}
              </Tag>
            ) : null}
            <button
              type="button"
              className={`btn btn-sm ${cam.enabled ? "btn-outline" : "btn-error"} ${cornerBtn}`}
              disabled={pending}
              onClick={() => save({ enabled: !cam.enabled })}
            >
              {cam.enabled ? <VideoOff size={14} /> : <Video size={14} />} {cam.enabled ? "Desligar" : "Ligar câmera"}
            </button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["local", Monitor, "Câmera do computador do telão", "Webcam, placa de captura ou celular como webcam ligados ao computador do projetor."],
              ["url", Youtube, "Transmissão por link", "YouTube, Twitch, Vimeo ou vídeo .mp4/.webm. Aparece também no celular do público."],
            ] as const
          ).map(([id, Icon, label, hint]) => (
            <button
              key={id}
              type="button"
              onClick={() => set({ source: id })}
              className={`rounded-tl-xl rounded-br-xl border-2 p-3 text-left transition ${cam.source === id ? "border-primary bg-primary/5" : "border-base-300 hover:border-base-content/30"}`}
            >
              <Icon size={18} className="text-primary" />
              <span className="mt-1 block font-bold">{label}</span>
              <span className="text-xs text-base-content/60">{hint}</span>
            </button>
          ))}
        </div>

        {cam.source === "local" ? (
          <div className="mt-3 rounded-tl-xl rounded-br-xl bg-base-200/70 px-4 py-3 text-xs text-base-content/70">
            Depois de ligar, no computador do telão passe o mouse no canto superior direito e clique no ícone de câmera →{" "}
            <b>Usar a câmera deste aparelho</b> (e escolha qual, se houver mais de uma). O navegador pede permissão uma vez. Celulares do público
            não recebem pedido de câmera.
            <label className="mt-2 flex cursor-pointer items-center gap-2">
              <input type="checkbox" className="checkbox checkbox-xs" checked={cam.mirror} onChange={(e) => set({ mirror: e.target.checked })} />
              Espelhar a imagem (webcam virada para a plateia)
            </label>
          </div>
        ) : (
          <label className="mt-3 block">
            <span className="text-xs font-medium">Link da transmissão</span>
            <input
              value={cam.url}
              onChange={(e) => set({ url: e.target.value })}
              placeholder="https://www.youtube.com/live/…"
              className={`input input-bordered input-sm mt-1 w-full ${cam.url && !embed ? "input-error" : ""}`}
            />
            <span className="mt-1 block text-xs text-base-content/55">
              {cam.url ? (embed ? `Reconhecido: ${embed.provider}. Começa sem som.` : "Link não reconhecido. Use YouTube, Twitch, Vimeo ou um vídeo .mp4/.webm.") : "A transmissão começa sem som."}
            </span>
          </label>
        )}

        <p className="kicker mb-2 mt-5">Onde aparece</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {LAYOUTS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => set({ layout: l.id })}
              className={`rounded-tl-xl rounded-br-xl border-2 p-3 text-left transition ${cam.layout === l.id ? "border-primary bg-primary/5" : "border-base-300 hover:border-base-content/30"}`}
            >
              <LayoutIcon layout={l.id} corner={cam.corner} />
              <span className="mt-2 block text-sm font-bold">{l.label}</span>
              <span className="text-xs text-base-content/60">{l.hint}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {cam.layout === "pip" && (
            <>
              <label>
                <span className="text-xs font-medium">Canto</span>
                <select value={cam.corner} onChange={(e) => set({ corner: e.target.value as CameraSettings["corner"] })} className="select select-bordered select-sm mt-1 w-full">
                  <option value="br">Inferior direito</option>
                  <option value="bl">Inferior esquerdo</option>
                  <option value="tr">Superior direito</option>
                  <option value="tl">Superior esquerdo</option>
                </select>
              </label>
              <label>
                <span className="text-xs font-medium">Tamanho</span>
                <select value={cam.size} onChange={(e) => set({ size: e.target.value as CameraSettings["size"] })} className="select select-bordered select-sm mt-1 w-full">
                  <option value="s">Pequena</option>
                  <option value="m">Média</option>
                  <option value="l">Grande</option>
                </select>
              </label>
            </>
          )}
          <label className={cam.layout === "pip" ? "" : "sm:col-span-3"}>
            <span className="text-xs font-medium">Legenda (opcional)</span>
            <input value={cam.label} maxLength={40} onChange={(e) => set({ label: e.target.value })} placeholder="Ex.: Arena 1 · ao vivo" className="input input-bordered input-sm mt-1 w-full" />
          </label>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <p className="mr-auto text-xs text-base-content/55">A prévia do telão mostra onde a câmera vai ficar.</p>
          <button type="button" className={`btn btn-sm btn-primary ${cornerBtn}`} disabled={pending || !dirty} onClick={() => save()}>
            <Save size={14} /> Salvar
          </button>
        </div>
      </Panel>
    </div>
  );
}

function LayoutIcon({ layout, corner }: { layout: CameraSettings["layout"]; corner: CameraSettings["corner"] }) {
  const pos = { br: "bottom-1 right-1", bl: "bottom-1 left-1", tr: "top-1 right-1", tl: "top-1 left-1" }[corner];
  return (
    <span className="relative block h-12 w-20 rounded border border-base-content/30 bg-base-200">
      {layout !== "full" && (
        <span className={`absolute inset-y-1 left-1 space-y-1 ${layout === "split" ? "right-9" : "right-1"}`}>
          {[0, 1, 2].map((i) => (
            <span key={i} className="block h-1.5 rounded-sm bg-base-content/25" />
          ))}
        </span>
      )}
      {layout === "pip" && <span className={`absolute h-4 w-6 rounded-sm bg-error/70 ${pos}`} />}
      {layout === "split" && <span className="absolute inset-y-1 right-1 w-7 rounded-sm bg-error/70" />}
      {layout === "full" && <span className="absolute inset-1 rounded-sm bg-error/70" />}
    </span>
  );
}
