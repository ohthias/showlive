"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";

type ToastType = "info" | "success" | "warning" | "error";
interface Toast {
  id: number;
  message: string;
  type: ToastType;
  leaving?: boolean;
}

const Ctx = createContext<{ addToast: (message: string, type?: ToastType, duration?: number) => void } | null>(null);

const STYLES: Record<ToastType, { className: string; icon: ReactNode }> = {
  info: { className: "border-info/30 bg-base-100", icon: <Info size={18} className="text-info" /> },
  success: { className: "border-success/30 bg-base-100", icon: <CheckCircle2 size={18} className="text-success" /> },
  warning: { className: "border-warning/40 bg-base-100", icon: <TriangleAlert size={18} className="text-warning" /> },
  error: { className: "border-error/40 bg-base-100", icon: <AlertCircle size={18} className="text-error" /> },
};

/** Versão enxuta do ToastContext do RoboStage (mesmas animações em CSS). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((p) => p.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 150);
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType = "info", duration = 3500) => {
      const id = ++seq.current;
      setToasts((p) => [...p.slice(-3), { id, message, type }]);
      setTimeout(() => remove(id), duration);
    },
    [remove],
  );

  const value = useMemo(() => ({ addToast }), [addToast]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed top-4 right-4 z-[9999] flex w-full max-w-sm flex-col gap-3" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${t.leaving ? "toast-leave" : "toast-enter"} pointer-events-auto flex items-start gap-3 rounded-tl-2xl rounded-br-2xl border-2 p-4 shadow-[4px_4px_0_0_var(--color-base-content)] ${STYLES[t.type].className}`}
          >
            <div className="mt-0.5 shrink-0">{STYLES[t.type].icon}</div>
            <p className="flex-1 text-sm leading-relaxed">{t.message}</p>
            <button type="button" onClick={() => remove(t.id)} className="btn btn-ghost btn-xs btn-square" aria-label="Fechar aviso">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast precisa do ToastProvider");
  return ctx;
}
