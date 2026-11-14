import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogOut, NotebookPen } from "lucide-react";
import { leaveBanca } from "@/app/actions/judging";
import { Logo, Tag } from "@/components/ui/brand";
import { getCodeJudge } from "@/lib/judging";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sala de avaliação", robots: { index: false } };

/**
 * Sala de avaliação: entra quem digitou o código da sala em /entrar.
 * Só existe com o evento ao vivo, como a mesa.
 */
export default async function BancaLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCodeJudge();
  if (!ctx) redirect("/entrar");
  return (
    <div className="min-h-dvh bg-base-200/50">
      <header className="sticky top-0 z-30 border-b border-base-300 bg-base-100/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Logo size="text-sm" href={null} />
              <Tag className="border-primary/40 bg-primary/10 text-primary">
                <NotebookPen size={11} /> AVALIAÇÃO
              </Tag>
            </div>
            <p className="mt-1 truncate text-sm font-bold">
              {ctx.room.name} · {ctx.event.name}
            </p>
            {ctx.name && <p className="truncate text-xs text-base-content/55">{ctx.name}</p>}
          </div>
          <form action={leaveBanca}>
            <button className="btn btn-ghost btn-sm" aria-label="Sair da sala">
              <LogOut size={16} /> Sair
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pt-5">{children}</main>
    </div>
  );
}
