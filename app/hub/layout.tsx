import type { Metadata } from "next";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { ArrowUpRight, LayoutTemplate, SlidersHorizontal } from "lucide-react";
import { ByRoboStage, Logo } from "@/components/ui/brand";
import { StickerTag, ToolScope } from "@/components/stage";
import { toolLinkClass } from "@/components/ui/tool";
import { ThemeController } from "@/components/ui/ThemeController";
import { claimPendingInvites, getIdentity } from "@/lib/auth/access";

export const metadata: Metadata = { title: "Hub", robots: { index: false } };

export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const me = await getIdentity();
  // Convites feitos para este e-mail viram acesso ativo no primeiro login.
  if (me) await claimPendingInvites(me.userId, me.email, me.name);

  const rs = process.env.NEXT_PUBLIC_ROBOSTAGE_URL ?? "https://www.robostage.com.br";

  return (
    <ToolScope className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-base-300 bg-base-100/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link href="/hub" className="flex items-baseline gap-2">
            <Logo href={null} size="text-lg" />
          </Link>
          <StickerTag tone="ink" size="sm" shadow={false}>Hub</StickerTag>
          <ByRoboStage className="ml-1 hidden sm:inline" />
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Link href="/hub/templates" className={toolLinkClass("ghost", "sm")}>
              <LayoutTemplate size={15} /> <span className="hidden md:inline">Templates</span>
            </Link>
            <Link href="/hub/preferencias" className={toolLinkClass("ghost", "sm")}>
              <SlidersHorizontal size={15} /> <span className="hidden md:inline">Preferências</span>
            </Link>
            <a href={`${rs}/dashboard`} className={toolLinkClass("ghost", "sm", "hidden xl:inline-flex")}>
              Dashboard RoboStage <ArrowUpRight size={14} />
            </a>
            <ThemeController />
            <UserButton />
          </div>
        </div>
      </header>
      {children}
    </ToolScope>
  );
}
