"use client";

import { useMemo } from "react";
import { useToast as useStageToast } from "@/components/stage";

/* Avisos da Stage UI (pilha animada, pausa no hover, barra de tempo).
   `addToast(message, type, duration)` continua sem retorno, como antes,
   para caber em `startTransition(async () => …)`; o resto da API
   (toast, promise, update, dismiss) vem direto da biblioteca. */
export { ToastProvider } from "@/components/stage";

type ToastType = "info" | "success" | "warning" | "error";

export function useToast() {
  const api = useStageToast();
  return useMemo(
    () => ({
      ...api,
      addToast: (message: string, type?: ToastType, duration?: number): void => {
        api.addToast(message, type, duration);
      },
    }),
    [api],
  );
}
