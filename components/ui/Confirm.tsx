"use client";

import { useCallback, type ReactNode } from "react";
import { ConfirmProvider as StageConfirmProvider, useConfirm as useStageConfirm } from "@/components/stage";

interface Options {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  /** Exige digitar este texto para liberar o botão (ações destrutivas). */
  typeToConfirm?: string;
}

/**
 * Confirmação da Stage UI (ConfirmModal: foco preso, Esc, bottom sheet no
 * celular). Mantém a API antiga do ShowLive: devolve o texto digitado
 * (ou "") ao confirmar e false ao cancelar.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  return <StageConfirmProvider>{children}</StageConfirmProvider>;
}

export function useConfirm() {
  const confirm = useStageConfirm();
  return useCallback(
    async (o: Options): Promise<string | false> => {
      const ok = await confirm({
        title: o.title,
        message: o.message,
        confirmLabel: o.confirmLabel ?? "Confirmar",
        intent: o.danger ? "danger" : "info",
        requireText: o.typeToConfirm,
      });
      return ok ? (o.typeToConfirm ?? "") : false;
    },
    [confirm],
  );
}
