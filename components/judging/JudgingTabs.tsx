"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, DoorOpen, ListChecks, Trophy } from "lucide-react";

const TABS = [
  { href: "", label: "Cronograma", icon: CalendarClock, admin: false },
  { href: "/rubricas", label: "Rubricas", icon: ListChecks, admin: true },
  { href: "/salas", label: "Salas", icon: DoorOpen, admin: true },
  { href: "/resultados", label: "Resultados", icon: Trophy, admin: true },
];

export function JudgingTabs({ eventId, isAdmin }: { eventId: string; isAdmin: boolean }) {
  const path = usePathname();
  const base = `/hub/${eventId}/avaliacao`;
  // A ficha de uma sessão é uma tela própria, sem abas.
  if (path.startsWith(`${base}/sessao/`)) return null;
  return (
    <nav aria-label="Avaliação" className="mb-5 flex gap-1 overflow-x-auto border-b border-base-300">
      {TABS.filter((t) => isAdmin || !t.admin).map(({ href, label, icon: Icon }) => {
        const full = base + href;
        const active = href ? path.startsWith(full) : path === base;
        return (
          <Link
            key={label}
            href={full}
            aria-current={active ? "page" : undefined}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
              active ? "border-primary text-base-content" : "border-transparent text-base-content/60 hover:text-base-content"
            }`}
          >
            <Icon size={15} /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
