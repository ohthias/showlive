"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ClipboardList, Gauge, KeyRound, Map as MapIcon, Palette, Settings2, Sparkles, Users } from "lucide-react";

const ITEMS = [
  { href: "", label: "Visão geral", icon: Gauge, admin: false },
  { href: "/desafio", label: "Desafio", icon: Sparkles, admin: true, only: "custom" },
  { href: "/desafio", label: "Regras", icon: BookOpen, admin: false, only: "fll_fe" },
  { href: "/arenas", label: "Arenas e extras", icon: MapIcon, admin: true, only: "obr" },
  { href: "/equipes", label: "Equipes", icon: Users, admin: true },
  { href: "/pontuacoes", label: "Pontuações", icon: ClipboardList, admin: true, scoresEditor: true },
  { href: "/telao", label: "Telão", icon: Palette, admin: true },
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
    <nav aria-label="Seções do evento" className="flex gap-1 overflow-x-auto lg:flex-col">
      {ITEMS.filter((i) => (isAdmin || !i.admin || ("scoresEditor" in i && canEditScores)) && (!("only" in i) || i.only === format)).map(({ href, label, icon: Icon }) => {
        const full = base + href;
        const active = href ? path.startsWith(full) : path === base;
        return (
          <Link
            key={href + label}
            href={full}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2.5 rounded-tl-lg rounded-br-lg px-3 py-2 text-sm font-medium transition ${
              active ? "bg-base-content text-base-100" : "text-base-content/70 hover:bg-base-300/60 hover:text-base-content"
            }`}
          >
            <Icon size={16} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
