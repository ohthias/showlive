"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Canto do telão: QR com o link do evento para o público acompanhar no celular. */
export function QrBadge({ code, fg, bg }: { code: string; fg: string; bg: string }) {
  const [svg, setSvg] = useState("");
  const url = typeof window !== "undefined" ? `${window.location.origin}/e/${code}` : `/e/${code}`;
  useEffect(() => {
    QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: fg, light: bg } })
      .then(setSvg)
      .catch(() => setSvg(""));
  }, [url, fg, bg]);
  if (!svg) return null;
  return (
    <div
      className="hidden items-center gap-3 rounded-tl-2xl rounded-br-2xl p-3 shadow-lg md:flex"
      style={{ background: bg, color: fg }}
    >
      <div className="size-24 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="max-w-[9rem]">
        <p className="text-sm font-black leading-tight">Acompanhe no celular</p>
        <p className="mt-1 font-mono text-xs font-bold tracking-[0.2em] opacity-70">{code}</p>
      </div>
    </div>
  );
}
