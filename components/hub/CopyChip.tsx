"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyChip({ value, label, display, className = "" }: { value: string; label?: string; display?: string; className?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setOk(true);
        setTimeout(() => setOk(false), 1500);
      }}
      className={`group inline-flex items-center gap-2 rounded-tl-lg rounded-br-lg border border-base-300 bg-base-100 px-3 py-1.5 transition hover:border-base-content/40 ${className}`}
      title={`Copiar ${label ?? value}`}
    >
      {label && <span className="font-mono text-[10px] tracking-[0.14em] text-base-content/50">{label}</span>}
      <span className="font-mono font-bold tracking-[0.15em]">{display ?? value}</span>
      {ok ? <Check size={14} className="text-success" /> : <Copy size={14} className="text-base-content/40 group-hover:text-base-content" />}
    </button>
  );
}
