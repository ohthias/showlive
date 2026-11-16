"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { deleteTemplate, duplicateTemplate } from "@/app/actions/challenges";
import { useConfirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";

export function TemplateActions({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  const confirm = useConfirm();
  const { addToast } = useToast();
  return (
    <div className="mt-4 flex items-center gap-1 border-t border-base-300 pt-3">
      <Link href={`/hub/templates/${id}`} className="btn btn-ghost btn-xs">
        <Pencil size={12} /> Editar
      </Link>
      <button
        type="button"
        className="btn btn-ghost btn-xs"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await duplicateTemplate(id);
            if (!r.ok) addToast(r.error, "error");
          })
        }
      >
        <Copy size={12} /> Duplicar
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-xs ml-auto text-error"
        disabled={pending}
        onClick={async () => {
          if ((await confirm({ title: `Apagar “${name}”?`, message: "Eventos que já usaram este template mantêm a própria cópia.", confirmLabel: "Apagar", danger: true })) === false) return;
          start(async () => {
            const r = await deleteTemplate(id);
            if (!r.ok) addToast(r.error, "error");
          });
        }}
      >
        <Trash2 size={12} /> Apagar
      </button>
    </div>
  );
}
