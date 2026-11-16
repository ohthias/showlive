import type { Metadata } from "next";
import { ClipboardCheck, NotebookPen, Tv } from "lucide-react";
import { EnterCodeForm } from "@/components/site/EnterCodeForm";
import { AnimatedBackground, ByRoboStage, Logo } from "@/components/ui/brand";
import { ThemeController } from "@/components/ui/ThemeController";

export const metadata: Metadata = { title: "Entrar com código" };

export default async function EnterPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code = "" } = await searchParams;
  return (
    <div className="relative isolate flex min-h-dvh flex-col">
      <AnimatedBackground />
      <header className="flex items-center justify-between px-6 py-5">
        <div className="flex items-baseline gap-3">
          <Logo />
          <ByRoboStage />
        </div>
        <ThemeController />
      </header>

      <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-12 px-6 pb-16 lg:grid-cols-[1fr_1.05fr]">
        <div>
          <p className="kicker">/ ENTRADA</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-6xl">
            Digite o{" "}
            <span className="inline-block -rotate-1 bg-primary px-2 italic text-primary-content">código.</span>
          </h1>
          <p className="mt-5 max-w-md text-base-content/65">
            A organização do evento passa um código de 6 caracteres. Ele decide o que você vai ver.
          </p>
          <ul className="mt-8 space-y-3">
            <li className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-tl-lg rounded-br-lg bg-accent/25 text-base-content">
                <Tv size={18} />
              </span>
              <span className="text-sm">
                <b>Código do evento</b> — telão com o ranking ao vivo. Funciona no projetor e no celular.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-tl-lg rounded-br-lg bg-secondary/15 text-secondary">
                <ClipboardCheck size={18} />
              </span>
              <span className="text-sm">
                <b>Código da mesa</b> — arbitragem para os juízes. Não precisa de conta.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-tl-lg rounded-br-lg bg-primary/10 text-primary">
                <NotebookPen size={18} />
              </span>
              <span className="text-sm">
                <b>Código da sala</b> — avaliação por rubricas (projeto, design, valores). Não precisa de conta.
              </span>
            </li>
          </ul>
        </div>

        <div className="rounded-tl-3xl rounded-br-3xl border-2 border-base-content bg-base-100 p-7 shadow-[8px_8px_0_0_var(--color-secondary)] sm:p-9">
          <EnterCodeForm initialCode={code} />
        </div>
      </main>
    </div>
  );
}
