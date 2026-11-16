"use client";

import { useTransition } from "react";
import { CircleDot, Flag, Radio } from "lucide-react";
import { setEventStatus } from "@/app/actions/events";
import { useConfirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";

const OPTIONS = [
  { id: "draft", label: "Preparação", icon: CircleDot },
  { id: "live", label: "Ao vivo", icon: Radio },
  { id: "finished", label: "Encerrado", icon: Flag },
] as const;

/** Liga/desliga o envio de notas (substitui o "event_active" da versão anterior). */
export function StatusSwitch({ eventId, status, disabled }: { eventId: string; status: "draft" | "live" | "finished"; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const confirm = useConfirm();
  const { addToast } = useToast();

  const set = async (next: (typeof OPTIONS)[number]["id"]) => {
    if (next === status) return;
    if (next === "finished") {
      const ok = await confirm({
        title: "Encerrar o evento?",
        message: "As mesas não poderão mais enviar notas e o telão passa a mostrar o resultado final. Dá para reabrir depois.",
        confirmLabel: "Encerrar",
      });
      if (ok === false) return;
    }
    start(async () => {
      const r = await setEventStatus(eventId, next);
      if (!r.ok) addToast(r.error, "error");
    });
  };

  return (
    <div className="join rounded-tl-xl rounded-br-xl border border-base-300 bg-base-100 p-0.5" role="radiogroup" aria-label="Status do evento">
      {OPTIONS.map(({ id, label, icon: Icon }) => {
        const active = status === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={pending || disabled}
            onClick={() => set(id)}
            className={`join-item btn btn-sm border-0 ${
              active ? (id === "live" ? "btn-primary" : id === "finished" ? "btn-success" : "btn-neutral") : "btn-ghost"
            }`}
          >
            <Icon size={14} className={active && id === "live" ? "animate-pulse" : ""} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
