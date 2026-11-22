import type { ReactNode } from "react";
import Link from "next/link";
import { cn, toneSoft, toneText, Mascot, StatusBadge } from "@/components/stage";

/*
 * Peças visuais do ShowLive sobre a Stage UI (components/stage).
 * As APIs antigas continuam iguais; o visual vem da biblioteca.
 */

export { SectionTitle, AnimatedBackground } from "@/components/stage";

/** Canto recortado da marca para botões daisyUI (`btn`). */
export const cornerBtn = "rounded-[0.75rem_0_0.75rem_0]!";

/** Sombra dura + "afunda no clique" dos CTAs de vitrine. */
export const ctaShadow = "stage-shadow stage-press stage-noise";

export const ACCENT_TEXT = toneText.accent;

export type Tone = "primary" | "secondary" | "accent";

export const toneClasses: Record<Tone, { icon: string; tag: string; hover: string; dot: string; solid: string }> = {
  primary: { icon: toneSoft.primary, tag: toneText.primary, hover: "hover:border-primary/40", dot: "bg-primary", solid: "bg-primary text-primary-content" },
  secondary: {
    icon: toneSoft.secondary,
    tag: toneText.secondary,
    hover: "hover:border-secondary/40",
    dot: "bg-secondary",
    solid: "bg-secondary text-secondary-content",
  },
  accent: { icon: toneSoft.accent, tag: toneText.accent, hover: "hover:border-accent/60", dot: "bg-accent", solid: "bg-accent text-accent-content" },
};

export function Logo({ size = "text-xl", href = "/" }: { size?: string; href?: string | null }) {
  const mark = (
    <span className={cn("font-black uppercase italic tracking-tight text-base-content", size)}>
      Show<span className="text-primary">Live</span>
    </span>
  );
  return href ? (
    <Link href={href} aria-label="ShowLive, página inicial" className="inline-flex items-baseline gap-2 opacity-90 transition-opacity hover:opacity-100">
      {mark}
    </Link>
  ) : (
    mark
  );
}

/** "by RoboStage" — o selo que liga o ShowLive à plataforma principal. */
export function ByRoboStage({ className = "" }: { className?: string }) {
  return (
    <a
      href={process.env.NEXT_PUBLIC_ROBOSTAGE_URL ?? "https://www.robostage.com.br"}
      className={cn("stage-kicker text-[10px] text-base-content/45 transition hover:text-base-content", className)}
    >
      BY ROBO<span className="text-primary">STAGE</span>
    </a>
  );
}

/** Etiqueta mono com canto recortado (as cores vêm do `className`). */
export function Tag({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "stage-corner-sm inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em]",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function LiveBadge({ label = "AO VIVO", className = "" }: { label?: string; className?: string }) {
  return (
    <StatusBadge status="live" className={className}>
      {label}
    </StatusBadge>
  );
}

/** Caixa padrão dos painéis do hub (kit ferramenta da Stage UI: borda fina, sem textura). */
export function Panel({
  title,
  kicker,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  kicker?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("min-w-0 rounded-tl-2xl rounded-br-2xl rounded-tr-md rounded-bl-md border border-base-300 bg-base-100", className)}>
      {(title || action || kicker) && (
        // Em telas estreitas as ações descem para baixo do título em vez de estourar a largura.
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-base-300 px-4 py-3 sm:px-5 sm:py-3.5">
          <div className="min-w-0 flex-1 basis-40">
            {kicker && <p className="kicker">{kicker}</p>}
            {title && <h2 className="truncate font-black tracking-tight">{title}</h2>}
          </div>
          {action && <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2">{action}</div>}
        </header>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

/** Estado vazio da Stage UI: o Bit, com o ícone da seção no visor. */
export function EmptyState({ icon, title, text, children }: { icon: ReactNode; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-tl-[2rem] rounded-br-[2rem] border border-dashed border-base-content/25 bg-base-200/40 px-6 py-10 text-center">
      <div className="relative">
        <Mascot size={72} motion="float" />
        <span className="absolute -right-3 -bottom-1 grid size-8 place-items-center rounded-tl-lg rounded-br-lg border border-base-300 bg-base-100 text-base-content/60 [&>svg]:size-4">
          {icon}
        </span>
      </div>
      <div>
        <p className="text-xl font-black tracking-tight">{title}</p>
        {text && <p className="mx-auto mt-1 max-w-sm text-sm text-base-content/65">{text}</p>}
      </div>
      {children && <div className="mt-1">{children}</div>}
    </div>
  );
}
