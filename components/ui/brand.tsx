import type { ReactNode } from "react";
import Link from "next/link";

/* Peças visuais do RoboStage, reaproveitadas no ShowLive. */

export const cornerBtn = "rounded-tl-xl rounded-br-xl rounded-tr-none rounded-bl-none";

export const ACCENT_TEXT =
  "text-[color-mix(in_oklab,var(--color-accent)_55%,var(--color-base-content))]";

export type Tone = "primary" | "secondary" | "accent";

export const toneClasses: Record<Tone, { icon: string; tag: string; hover: string; dot: string; solid: string }> = {
  primary: {
    icon: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-content",
    tag: "text-primary",
    hover: "hover:border-primary/40",
    dot: "bg-primary",
    solid: "bg-primary text-primary-content",
  },
  secondary: {
    icon: "bg-secondary/10 text-secondary group-hover:bg-secondary group-hover:text-secondary-content",
    tag: "text-secondary",
    hover: "hover:border-secondary/40",
    dot: "bg-secondary",
    solid: "bg-secondary text-secondary-content",
  },
  accent: {
    icon: `bg-accent/20 ${ACCENT_TEXT} group-hover:bg-accent group-hover:text-accent-content`,
    tag: ACCENT_TEXT,
    hover: "hover:border-accent/60",
    dot: "bg-accent",
    solid: "bg-accent text-accent-content",
  },
};

export function Logo({ size = "text-xl", href = "/" }: { size?: string; href?: string | null }) {
  const mark = (
    <span className={`${size} font-black uppercase italic tracking-tight text-base-content`}>
      Show<span className="text-primary">Live</span>
    </span>
  );
  return href ? (
    <Link href={href} aria-label="ShowLive, página inicial" className="inline-flex items-baseline gap-2">
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
      className={`font-mono text-[10px] font-bold tracking-[0.15em] text-base-content/45 transition hover:text-base-content ${className}`}
    >
      BY ROBO<span className="text-primary">STAGE</span>
    </a>
  );
}

export function SectionTitle({
  kicker,
  title,
  highlight,
  highlightClass = "bg-primary text-primary-content",
  description,
  align = "left",
  children,
}: {
  kicker: string;
  title: string;
  highlight: string;
  highlightClass?: string;
  description?: string;
  align?: "left" | "center";
  children?: ReactNode;
}) {
  const center = align === "center";
  return (
    <div className={`max-w-3xl ${center ? "mx-auto text-center" : ""}`}>
      <p className="font-mono text-xs tracking-[0.2em] text-base-content/45">{kicker}</p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
        {title}{" "}
        <span className={`mt-2 inline-block -rotate-1 px-3 py-1 italic ${highlightClass}`}>{highlight}</span>
      </h2>
      {description && (
        <p className={`mt-6 max-w-2xl text-base leading-7 text-base-content/60 sm:text-lg ${center ? "mx-auto" : ""}`}>
          {description}
        </p>
      )}
      {children}
    </div>
  );
}

export function AnimatedBackground() {
  return (
    <div className="rs-background" aria-hidden="true">
      <div className="rs-glow rs-glow-one" />
      <div className="rs-glow rs-glow-two" />
      <div className="rs-grid" />
    </div>
  );
}

export function Tag({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-tl-md rounded-br-md border px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.14em] ${className}`}
    >
      {children}
    </span>
  );
}

export function LiveBadge({ label = "AO VIVO", className = "" }: { label?: string; className?: string }) {
  return (
    <Tag className={`border-primary bg-primary/10 text-primary ${className}`}>
      <span className="live-dot" />
      {label}
    </Tag>
  );
}

/** Caixa padrão dos painéis do hub. */
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
    <section className={`rounded-tl-2xl rounded-br-2xl border border-base-300 bg-base-100 ${className}`}>
      {(title || action || kicker) && (
        <header className="flex items-center justify-between gap-3 border-b border-base-300 px-5 py-3.5">
          <div className="min-w-0">
            {kicker && <p className="kicker">{kicker}</p>}
            {title && <h2 className="truncate font-bold tracking-tight">{title}</h2>}
          </div>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function EmptyState({ icon, title, text, children }: { icon: ReactNode; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="rounded-tl-2xl rounded-br-2xl border-2 border-dashed border-base-300 px-6 py-12 text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-tl-xl rounded-br-xl bg-base-200 text-base-content/50">{icon}</div>
      <p className="mt-4 font-bold">{title}</p>
      {text && <p className="mx-auto mt-1 max-w-sm text-sm text-base-content/60">{text}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
