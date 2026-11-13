"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { cornerBtn } from "./brand";

interface Options {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  /** Exige digitar este texto para liberar o botão (ações destrutivas). */
  typeToConfirm?: string;
}

const Ctx = createContext<((o: Options) => Promise<string | false>) | null>(null);

/**
 * Diálogo de confirmação no estilo do RoboStage. Substitui window.confirm,
 * que trava a página (e o telão, se aberto na mesma aba).
 * Retorna o texto digitado (ou "" ) ao confirmar, false ao cancelar.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<Options | null>(null);
  const [typed, setTyped] = useState("");
  const resolver = useRef<((v: string | false) => void) | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const confirm = useCallback((o: Options) => {
    setOpts(o);
    setTyped("");
    requestAnimationFrame(() => dialog.current?.showModal());
    return new Promise<string | false>((resolve) => (resolver.current = resolve));
  }, []);

  const close = (value: string | false) => {
    dialog.current?.close();
    resolver.current?.(value);
    resolver.current = null;
  };

  const blocked = !!opts?.typeToConfirm && typed.trim() !== opts.typeToConfirm;

  return (
    <Ctx.Provider value={confirm}>
      {children}
      <dialog ref={dialog} className="modal" onCancel={(e) => (e.preventDefault(), close(false))}>
        {opts && (
          <div className="modal-box rounded-tl-3xl rounded-br-3xl rounded-tr-none rounded-bl-none border-2 border-base-content p-0 shadow-[8px_8px_0_0_var(--color-base-content)]">
            <div className="flex gap-4 p-6">
              {opts.danger && (
                <span className="grid size-11 shrink-0 place-items-center rounded-tl-xl rounded-br-xl bg-error/15 text-error">
                  <TriangleAlert size={22} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold tracking-tight">{opts.title}</h3>
                {opts.message && <div className="mt-2 text-sm leading-6 text-base-content/70">{opts.message}</div>}
                {opts.typeToConfirm && (
                  <label className="mt-4 block">
                    <span className="text-xs text-base-content/60">
                      Digite <b className="font-mono">{opts.typeToConfirm}</b> para confirmar
                    </span>
                    <input
                      autoFocus
                      className="input input-bordered mt-1 w-full"
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                    />
                  </label>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-base-300 bg-base-200/60 px-6 py-4">
              <button type="button" className="btn btn-ghost" onClick={() => close(false)}>
                Cancelar
              </button>
              <button
                type="button"
                disabled={blocked}
                className={`btn ${opts.danger ? "btn-error" : "btn-primary"} ${cornerBtn}`}
                onClick={() => close(typed)}
                autoFocus={!opts.typeToConfirm}
              >
                {opts.confirmLabel ?? "Confirmar"}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </Ctx.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useConfirm precisa do ConfirmProvider");
  return ctx;
}
