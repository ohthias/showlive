import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";
import { ArrowUpRight, KeyRound, LayoutDashboard } from "lucide-react";
import { ByRoboStage, Logo } from "@/components/ui/brand";
import { ButtonLink, Mascot, Sparkle } from "@/components/stage";
import { ThemeController } from "@/components/ui/ThemeController";

/** Barra do site no padrão do Navbar da Stage UI, com o logo do ShowLive e a conta Clerk. */
export function SiteHeader() {
  const link =
    "inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium text-base-content/70 transition-all duration-200 hover:bg-primary/10 hover:text-primary";
  return (
    <header className="stage-paper sticky top-0 z-40 border-b border-base-300/70 bg-base-100/80 backdrop-blur-md supports-[backdrop-filter]:bg-base-100/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-5 sm:px-8">
        <div className="flex items-baseline gap-3">
          <Logo />
          <ByRoboStage className="hidden sm:inline" />
        </div>

        <nav className="ml-6 hidden items-center gap-0.5 md:flex" aria-label="Principal">
          <a href="#como-funciona" className={link}>
            Como funciona
          </a>
          <a href="#recursos" className={link}>
            Recursos
          </a>
          <Link href="/entrar" className={link}>
            <KeyRound size={15} />
            Tenho um código
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeController />
          <Show when="signed-in">
            <ButtonLink href="/hub" size="sm" iconLeft={<LayoutDashboard size={15} />}>
              Meu hub
            </ButtonLink>
            <UserButton />
          </Show>
          <Show when="signed-out">
            <ButtonLink href="/hub" size="sm" iconRight={<ArrowUpRight size={15} />}>
              Entrar com RoboStage
            </ButtonLink>
          </Show>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const rs = process.env.NEXT_PUBLIC_ROBOSTAGE_URL ?? "https://www.robostage.com.br";
  const links = [
    { label: "RoboStage", href: rs },
    { label: "Pontuador FLL", href: `${rs}/fll/score` },
    { label: "Timers", href: `${rs}/fll/timers` },
    { label: "Sugerir melhoria", href: "https://github.com/ohthias/roboStage/issues/new?title=ShowLive%3A%20" },
  ];
  return (
    <footer className="stage-paper overflow-hidden border-t border-base-300 bg-base-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 pb-8 pt-14 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-baseline gap-3">
            <Logo size="text-2xl" />
            <ByRoboStage />
          </div>
          <p className="mt-3 max-w-sm text-sm text-base-content/60">Parte da plataforma RoboStage. Uma conta, todas as ferramentas.</p>
        </div>
        <nav aria-label="Rodapé">
          <h4 className="footer-title">Links</h4>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm sm:flex-col">
            {links.map((l) => (
              <li key={l.label}>
                <a href={l.href} className="link link-hover text-base-content/70 hover:text-base-content">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="relative mx-auto max-w-[1400px] px-2">
        <Mascot size={76} motion="wiggle" className="absolute left-[46%] top-0 z-10 -translate-y-1/2" />
        <Sparkle size={30} tone="accent" motion="spin" className="absolute right-[6%] top-[10%] z-10" />
        <p
          aria-hidden
          className="select-none whitespace-nowrap pr-[0.08em] text-center text-[19vw] font-black uppercase italic leading-[0.78] tracking-tighter text-base-content/[0.08] [margin-bottom:-0.1em] xl:text-[17rem]"
        >
          Show<span className="text-primary/25">Live</span>
        </p>
      </div>
    </footer>
  );
}
