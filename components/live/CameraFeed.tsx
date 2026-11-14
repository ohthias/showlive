"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Check, Video } from "lucide-react";
import { cameraEmbed, type CameraSettings } from "@/lib/screen";

/**
 * Câmera do telão.
 *
 * - "local": câmera ligada ao computador do telão (webcam, placa de captura,
 *   celular como webcam). Só liga no aparelho em que o operador ativou —
 *   quem abre o telão no celular não recebe pedido de câmera.
 * - "url": transmissão (YouTube, Twitch, Vimeo ou vídeo direto) — aparece em
 *   todas as telas, inclusive no celular do público.
 */

type LocalPref = { use: boolean; deviceId: string | null };
const key = (eventId: string) => `sl-cam:${eventId}`;

export function useLocalCamera(eventId: string) {
  const [pref, setPref] = useState<LocalPref>({ use: false, deviceId: null });
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key(eventId));
      if (raw) setPref({ use: false, deviceId: null, ...JSON.parse(raw) });
    } catch {
      /* armazenamento indisponível: fica desligado */
    }
  }, [eventId]);
  const update = useCallback(
    (p: Partial<LocalPref>) =>
      setPref((cur) => {
        const next = { ...cur, ...p };
        try {
          localStorage.setItem(key(eventId), JSON.stringify(next));
        } catch {
          /* ignora */
        }
        return next;
      }),
    [eventId],
  );
  return [pref, update] as const;
}

export function CameraFeed({
  camera,
  deviceId,
  preview = false,
  className = "",
  rounded = "tv-r-xl",
}: {
  camera: CameraSettings;
  deviceId: string | null;
  preview?: boolean;
  className?: string;
  rounded?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [host, setHost] = useState<string | undefined>(undefined);
  useEffect(() => setHost(window.location.hostname), []);
  const embed = camera.source === "url" ? cameraEmbed(camera.url, host) : null;

  useEffect(() => {
    if (camera.source !== "local" || preview) return;
    let stream: MediaStream | null = null;
    let cancelled = false;
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Este navegador não libera a câmera (o telão precisa estar em https).");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: deviceId ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } } : { width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play().catch(() => undefined);
        }
      })
      .catch((err: DOMException) => {
        if (cancelled) return;
        setError(
          err?.name === "NotAllowedError"
            ? "Permissão de câmera negada. Libere a câmera para este site no navegador."
            : err?.name === "NotFoundError" || err?.name === "OverconstrainedError"
              ? "Câmera não encontrada. Escolha outra no menu da câmera."
              : "Não foi possível abrir a câmera.",
        );
      });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [camera.source, deviceId, preview]);

  return (
    <div className={`tv-panel relative isolate overflow-hidden bg-black ${rounded} ${className}`} style={{ aspectRatio: "16 / 9" }}>
      {preview && camera.source === "local" ? (
        <Placeholder text="Câmera do computador do telão" />
      ) : error ? (
        <Placeholder text={error} off />
      ) : camera.source === "local" ? (
        <video ref={video} muted playsInline autoPlay className="absolute inset-0 size-full object-cover" style={camera.mirror ? { transform: "scaleX(-1)" } : undefined} />
      ) : !embed ? (
        <Placeholder text="Link de transmissão inválido. Use YouTube, Twitch, Vimeo ou um vídeo .mp4/.webm." off />
      ) : embed.kind === "iframe" ? (
        host ? (
          <iframe
            src={embed.src}
            title={camera.label || `Transmissão ${embed.provider}`}
            allow="autoplay; encrypted-media; picture-in-picture"
            className="absolute inset-0 size-full border-0"
          />
        ) : null
      ) : (
        <video src={embed.src} muted playsInline autoPlay loop className="absolute inset-0 size-full object-cover" />
      )}
      {camera.label && (
        <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded bg-black/65 px-2 py-1 font-mono text-[11px] font-bold tracking-[0.15em] text-white">
          <span className="size-2 animate-pulse rounded-full bg-red-500" /> {camera.label.toUpperCase()}
        </span>
      )}
    </div>
  );
}

function Placeholder({ text, off = false }: { text: string; off?: boolean }) {
  return (
    <div className="absolute inset-0 grid place-items-center p-4 text-center text-white/75">
      <div>
        {off ? <CameraOff className="mx-auto" size={28} /> : <Video className="mx-auto" size={28} />}
        <p className="mt-2 text-sm">{text}</p>
      </div>
    </div>
  );
}

/** Botão discreto no topo do telão: ativa a câmera deste aparelho e escolhe qual. */
export function CameraMenu({ pref, onChange }: { pref: LocalPref; onChange: (p: Partial<LocalPref>) => void }) {
  const [open, setOpen] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  const list = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all.filter((d) => d.kind === "videoinput"));
    } catch {
      setDevices([]);
    }
  }, []);
  useEffect(() => {
    if (open) void list();
  }, [open, list, pref.use]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`btn btn-ghost btn-sm btn-square text-current ${pref.use ? "" : "animate-pulse"}`}
        aria-label="Câmera deste aparelho"
        title="Câmera do telão"
      >
        {pref.use ? <Camera size={18} /> : <CameraOff size={18} />}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-72 rounded-lg border border-black/10 bg-white p-3 text-left text-sm text-neutral-900 shadow-xl">
          <p className="font-bold">Câmera no telão</p>
          <p className="mt-1 text-xs text-neutral-600">A organização ligou a câmera do computador do telão. Ative só no aparelho que está no projetor.</p>
          <label className="mt-3 flex cursor-pointer items-center justify-between gap-2">
            <span>Usar a câmera deste aparelho</span>
            <input type="checkbox" className="toggle toggle-sm" checked={pref.use} onChange={(e) => onChange({ use: e.target.checked })} />
          </label>
          {pref.use && (
            <div className="mt-3 space-y-1">
              <p className="text-xs text-neutral-600">Qual câmera</p>
              {devices.length === 0 && <p className="text-xs text-neutral-500">Autorize a câmera para ver a lista.</p>}
              {devices.map((d, i) => (
                <button
                  key={d.deviceId || i}
                  type="button"
                  onClick={() => onChange({ deviceId: d.deviceId || null })}
                  className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-neutral-100"
                >
                  <span className="w-4">{(pref.deviceId ?? devices[0]?.deviceId) === d.deviceId && <Check size={14} />}</span>
                  <span className="truncate">{d.label || `Câmera ${i + 1}`}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
