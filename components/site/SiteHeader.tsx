import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";
import { ArrowUpRight, KeyRound, LayoutDashboard } from "lucide-react";
import { ByRoboStage, cornerBtn, Logo } from "@/components/ui/brand";
import { ThemeController } from "@/components/ui/ThemeController";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-base-300 bg-base-100/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-6">
        <div className="flex items-baseline gap-3">
          <Logo />
          <ByRoboStage className="hidden sm:inline" />
        </div>

        <nav className="ml-6 hidden items-center gap-1 text-sm md:flex" aria-label="Principal">
          <a href="#como-funciona" className="btn btn-ghost btn-sm font-medium">
            Como funciona
          </a>
          <a href="#recursos" className="btn btn-ghost btn-sm font-medium">
            Recursos
          </a>
          <Link href="/entrar" className="btn btn-ghost btn-sm font-medium">
            <KeyRound size={15} />
            Tenho um código
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeController />
          <Show when="signed-in">
            <Link href="/hub" className={`btn btn-primary btn-sm ${cornerBtn}`}>
              <LayoutDashboard size={15} />
              Meu hub
            </Link>
            <UserButton />
          </Show>
          <Show when="signed-out">
            <Link href="/hub" className={`btn btn-primary btn-sm ${cornerBtn}`}>
              Entrar com RoboStage
              <ArrowUpRight size={15} />
            </Link>
          </Show>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const rs = process.env.NEXT_PUBLIC_ROBOSTAGE_URL ?? "https://www.robostage.com.br";
  return (
    <footer className="border-t border-base-300 bg-base-200/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-baseline gap-3">
            <Logo size="text-lg" />
            <ByRoboStage />
          </div>
          <p className="mt-2 max-w-sm text-sm text-base-content/60">
            Parte da plataforma RoboStage. Uma conta, todas as ferramentas.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-base-content/70" aria-label="Rodapé">
          <a href={rs} className="hover:text-base-content">
            RoboStage
          </a>
          <a href={`${rs}/fll/score`} className="hover:text-base-content">
            Pontuador FLL
          </a>
          <a href={`${rs}/fll/timers`} className="hover:text-base-content">
            Timers
          </a>
          <a href="https://github.com/ohthias/roboStage/issues/new?title=ShowLive%3A%20" className="hover:text-base-content">
            Sugerir melhoria
          </a>
        </nav>
      </div>
    </footer>
  );
}
