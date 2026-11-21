"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Clapperboard, ClipboardList, Gauge, KeyRound, Map as MapIcon, NotebookPen, Palette, Settings2, Sparkles, Swords, Users } from "lucide-react";

const ITEMS = [
  { href: "", label: "Visão geral", icon: Gauge, admin: false },
  { href: "/desafio", label: "Desafio", icon: Sparkles, admin: true, only: "custom" },
  { href: "/desafio", label: "Súmula e alianças", icon: Sparkles, admin: true, only: "alliance" },
  { href: "/desafio", label: "Regras", icon: BookOpen, admin: false, only: "fll_fe" },
  { href: "/arenas", label: "Arenas e extras", icon: MapIcon, admin: true, only: "obr" },
  { href: "/equipes", label: "Equipes", icon: Users, admin: true },
  { href: "/pontuacoes", label: "Pontuações", icon: ClipboardList, admin: true, scoresEditor: true, not: "alliance" },
  { href: "/partidas", label: "Partidas", icon: Swords, admin: true, scoresEditor: true, only: "alliance" },
  { href: "/avaliacao", label: "Avaliação", icon: NotebookPen, admin: false },
  { href: "/telao", label: "Telão", icon: Palette, admin: true },
  { href: "/cenas", label: "Cenas", icon: Clapperboard, admin: true },
  { href: "/acessos", label: "Acessos", icon: KeyRound, admin: true },
  { href: "/configuracoes", label: "Configurações", icon: Settings2, admin: true },
];

export function EventNav({
  eventId,
  isAdmin,
  format,
  canEditScores = false,
}: {
  eventId: string;
  isAdmin: boolean;
  format: string;
  canEditScores?: boolean;
}) {
  const path = usePathname();
  const base = `/hub/${eventId}`;
  return (
    <nav aria-label="Seções do evento" className="flex gap-0.5 overflow-x-auto rounded-lg border border-base-300 bg-base-100 p-1.5 lg:flex-col">
      <p className="hidden px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-base-content/45 lg:block">Evento</p>
      {ITEMS.filter((i) => (isAdmin || !i.admin || ("scoresEditor" in i && canEditScores)) && (!("only" in i) || i.only === format) && (!("not" in i) || i.not !== format)).map(({ href, label, icon: Icon }) => {
        const full = base + href;
        const active = href ? path.startsWith(full) : path === base;
        return (
          <Link
            key={href + label}
            href={full}
            aria-current={active ? "page" : undefined}
            className={`group flex shrink-0 items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary ${
              active ? "bg-primary/10 text-primary" : "text-base-content/75 hover:bg-base-content/[0.05] hover:text-base-content"
            }`}
          >
            <span
              className={`grid size-7 shrink-0 place-items-center rounded-md transition-colors ${
                active ? "bg-primary text-primary-content" : "bg-base-200 text-base-content/70"
              }`}
            >
              <Icon size={15} />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
