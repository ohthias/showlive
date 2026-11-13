import type { Metadata } from "next";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { ArrowUpRight, LayoutTemplate, SlidersHorizontal } from "lucide-react";
import { ByRoboStage, Logo, Tag } from "@/components/ui/brand";
import { ThemeController } from "@/components/ui/ThemeController";
import { claimPendingInvites, getIdentity } from "@/lib/access";

export const metadata: Metadata = { title: "Hub", robots: { index: false } };

export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const me = await getIdentity();
  // Convites feitos para este e-mail viram acesso ativo no primeiro login.
  if (me) await claimPendingInvites(me.userId, me.email, me.name);

  const rs = process.env.NEXT_PUBLIC_ROBOSTAGE_URL ?? "https://www.robostage.com.br";

  return (
    <div className="min-h-dvh bg-base-200/40">
      <header className="sticky top-0 z-40 border-b border-base-300 bg-base-100/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link href="/hub" className="flex items-baseline gap-2">
            <Logo href={null} size="text-lg" />
          </Link>
          <Tag className="border-base-content/20 text-base-content/60">HUB</Tag>
          <ByRoboStage className="ml-1 hidden sm:inline" />
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Link href="/hub/templates" className="btn btn-ghost btn-sm">
              <LayoutTemplate size={15} /> <span className="hidden md:inline">Templates</span>
            </Link>
            <Link href="/hub/preferencias" className="btn btn-ghost btn-sm">
              <SlidersHorizontal size={15} /> <span className="hidden md:inline">Preferências</span>
            </Link>
            <a href={`${rs}/dashboard`} className="btn btn-ghost btn-sm hidden xl:inline-flex">
              Dashboard RoboStage <ArrowUpRight size={14} />
            </a>
            <ThemeController />
            <UserButton />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
