"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Megaphone, PartyPopper, Send, Settings2, TriangleAlert, Video, VideoOff, X } from "lucide-react";
import { clearMessage, postMessage, updateCamera } from "@/app/actions/settings";
import { Panel, Tag } from "@/components/ui/brand";
import { useToast } from "@/components/ui/Toast";
import { useServerClock } from "@/hooks/useLiveEvent";
import { MESSAGE_DURATIONS, MESSAGE_MAX, messageVisible, TONES, type CameraSettings, type ScreenMessage, type ScreenMessageTone } from "@/lib/screen";

const TONE_ICON = { info: Megaphone, alert: TriangleAlert, celebrate: PartyPopper } as const;
const TONE_CLS: Record<ScreenMessageTone, string> = {
  info: "border-primary/40 bg-primary/5",
  alert: "border-error/50 bg-error/10",
  celebrate: "border-accent bg-accent/15",
};

/**
 * Aviso no telão: mostra o que está no ar agora e permite trocar ou tirar.
 * Só existe um aviso por vez — enviar outro substitui o atual.
 */
export function ScreenMessageBox({ eventId, current, clockOffset }: { eventId: string; current: ScreenMessage | null; clockOffset: number }) {
  const [text, setText] = useState("");
  const [tone, setTone] = useState<ScreenMessageTone>("info");
  const [minutes, setMinutes] = useState(0);
  const [pending, start] = useTransition();
  const { addToast } = useToast();
  const now = useServerClock(clockOffset, 5000);
  const live = messageVisible(current, now) ? current : null;
  const left = live?.until ? Math.max(1, Math.ceil((live.until - now) / 60_000)) : null;
  const Icon = live ? TONE_ICON[live.tone] : Megaphone;

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await postMessage(eventId, text, { tone, minutes });
      if (!r.ok) return addToast(r.error, "error");
      setText("");
      addToast(live ? "Aviso substituído no telão." : "Aviso no telão.", "success");
    });
  };

  return (
    <Panel kicker="/ TELÃO" title="Aviso no telão" action={<Megaphone size={16} className="text-base-content/40" />}>
      {live ? (
        <div className={`mb-4 flex items-start gap-3 rounded-tl-xl rounded-br-xl border-2 p-3 ${TONE_CLS[live.tone]}`}>
          <Icon size={18} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-[11px] text-base-content/60">
              <Tag className="border-success/40 text-success">
                <span className="live-dot" /> NO AR
              </Tag>
              {TONES[live.tone].label} · {left ? `some em ${left} min` : "até você tirar"}
            </p>
            <p className="mt-1 font-semibold">{live.text}</p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await clearMessage(eventId);
                if (!r.ok) addToast(r.error, "error");
              })
            }
          >
            <X size={13} /> Tirar
          </button>
        </div>
      ) : (
        <p className="mb-3 text-xs text-base-content/55">Nenhum aviso no telão agora.</p>
      )}
      <form onSubmit={send} className="space-y-2">
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MESSAGE_MAX}
            placeholder={live ? "Novo aviso (substitui o atual)" : "Ex.: Intervalo de 15 minutos"}
            className="input input-bordered input-sm flex-1"
          />
          <button className="btn btn-sm btn-primary btn-square" disabled={pending || !text.trim()} aria-label="Enviar aviso">
            <Send size={14} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="join">
            {(Object.keys(TONES) as ScreenMessageTone[]).map((t) => {
              const I = TONE_ICON[t];
              return (
                <button
                  key={t}
                  type="button"
                  title={TONES[t].hint}
                  onClick={() => setTone(t)}
                  className={`btn join-item btn-xs ${tone === t ? "btn-neutral" : "btn-outline border-base-300"}`}
                >
                  <I size={12} /> {TONES[t].label}
                </button>
              );
            })}
          </div>
          <select className="select select-bordered select-xs" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} aria-label="Duração">
            {MESSAGE_DURATIONS.map((m) => (
              <option key={m} value={m}>
                {m ? `some em ${m} min` : "até eu tirar"}
              </option>
            ))}
          </select>
          <span className="ml-auto font-mono text-[10px] text-base-content/45">
            {text.length}/{MESSAGE_MAX}
          </span>
        </div>
      </form>
    </Panel>
  );
}

/** Liga/desliga a câmera do telão sem sair da visão geral. */
export function CameraQuickToggle({ eventId, camera }: { eventId: string; camera: CameraSettings }) {
  const [pending, start] = useTransition();
  const { addToast } = useToast();
  const configured = camera.source === "local" || !!camera.url;
  return (
    <Panel
      kicker="/ TELÃO"
      title="Câmera"
      action={
        <Link href={`/hub/${eventId}/telao#camera`} className="btn btn-ghost btn-xs">
          <Settings2 size={13} /> Ajustar
        </Link>
      }
    >
      <div className="flex items-center gap-3">
        <span className={`grid size-10 place-items-center rounded-tl-lg rounded-br-lg ${camera.enabled ? "bg-error text-error-content" : "bg-base-200"}`}>
          {camera.enabled ? <Video size={18} /> : <VideoOff size={18} />}
        </span>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium">{camera.enabled ? "Câmera no telão" : "Câmera desligada"}</p>
          <p className="truncate text-xs text-base-content/55">
            {camera.source === "local" ? "Câmera do computador do telão" : camera.url || "Sem link de transmissão"} ·{" "}
            {camera.layout === "pip" ? "janela no canto" : camera.layout === "split" ? "lado a lado" : "tela cheia"}
          </p>
        </div>
        <input
          type="checkbox"
          className="toggle toggle-error"
          checked={camera.enabled}
          disabled={pending || !configured}
          aria-label="Câmera no telão"
          onChange={(e) =>
            start(async () => {
              const r = await updateCamera(eventId, { enabled: e.target.checked });
              if (!r.ok) addToast(r.error, "error");
            })
          }
        />
      </div>
    </Panel>
  );
}
