import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/components/stage";

/*
 * Link com o visual do ToolButton da Stage UI (o ToolButton só renderiza
 * <button>). Mesmas variantes e tamanhos do kit ferramenta.
 */
const variant = {
  primary: "bg-primary text-primary-content hover:bg-primary/90 border-transparent rounded-tl-lg rounded-br-lg rounded-tr-sm rounded-bl-sm",
  secondary: "bg-secondary text-secondary-content hover:bg-secondary/90 border-transparent rounded-md",
  outline: "bg-base-100 border-base-300 hover:border-base-content/30 hover:bg-base-200/60 rounded-md",
  ghost: "border-transparent bg-transparent hover:bg-base-content/[0.06] rounded-md",
};
const size = { xs: "h-7 px-2 text-xs gap-1", sm: "h-8 px-2.5 text-[13px] gap-1.5", md: "h-9 px-3.5 text-sm gap-2" };

export function toolLinkClass(v: keyof typeof variant = "outline", s: keyof typeof size = "sm", className?: string) {
  return cn(
    "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap border font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary [&_svg]:size-4",
    variant[v],
    size[s],
    className,
  );
}

export function ToolLink({
  variant: v = "outline",
  size: s = "sm",
  icon,
  iconRight,
  className,
  children,
  ...rest
}: ComponentProps<typeof Link> & { variant?: keyof typeof variant; size?: keyof typeof size; icon?: ReactNode; iconRight?: ReactNode }) {
  return (
    <Link {...rest} className={toolLinkClass(v, s, className)}>
      {icon}
      {children}
      {iconRight}
    </Link>
  );
}
