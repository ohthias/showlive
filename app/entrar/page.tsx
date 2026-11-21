import type { Metadata } from "next";
import { ClipboardCheck, NotebookPen, Tv } from "lucide-react";
import { EnterCodeForm } from "@/components/site/EnterCodeForm";
import { ByRoboStage, Logo } from "@/components/ui/brand";
import { AnimatedBackground, Card, DisplayHeading, Flower, Gear, Kicker } from "@/components/stage";
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
          <DisplayHeading as="h1" tag="Entrada" highlight="código." size="lg">
            Digite o
          </DisplayHeading>
          <p className="mt-5 max-w-md text-base-content/65">
            A organização do evento passa um código de 6 caracteres. Ele decide o que você vai ver.
          </p>
          <ul className="mt-8 space-y-3">
            <li className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center stage-noise rounded-tl-lg rounded-br-lg bg-accent/25 text-base-content">
                <Tv size={18} />
              </span>
              <span className="text-sm">
                <b>Código do evento</b> — telão com o ranking ao vivo. Funciona no projetor e no celular.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center stage-noise rounded-tl-lg rounded-br-lg bg-secondary/15 text-secondary">
                <ClipboardCheck size={18} />
              </span>
              <span className="text-sm">
                <b>Código da mesa</b> — arbitragem para os juízes. Não precisa de conta.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center stage-noise rounded-tl-lg rounded-br-lg bg-primary/10 text-primary">
                <NotebookPen size={18} />
              </span>
              <span className="text-sm">
                <b>Código da sala</b> — avaliação por rubricas (projeto, design, valores). Não precisa de conta.
              </span>
            </li>
          </ul>
        </div>

        <div className="relative">
          <Flower size={58} tone="accent" motion="spin" className="absolute -right-5 -top-6 z-10" />
          <Gear size={40} tone="secondary" motion="spin" className="absolute -bottom-5 -left-4 z-10 hidden sm:block" />
          <Card featured className="p-7 [--stage-shadow:var(--color-secondary)] sm:p-9">
            <Kicker className="mb-4 text-[11px]">Código de 6 caracteres</Kicker>
            <EnterCodeForm initialCode={code} />
          </Card>
        </div>
      </main>
    </div>
  );
}
