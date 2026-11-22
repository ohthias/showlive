import Link from "next/link";
import { ArrowLeft, ClipboardCheck, KeyRound, Tv } from "lucide-react";
import { CopyChip } from "@/components/hub/CopyChip";
import { EventNav } from "@/components/hub/EventNav";
import { StatusSwitch } from "@/components/hub/StatusSwitch";
import { Kicker } from "@/components/stage";
import { toolLinkClass } from "@/components/ui/tool";
import { hasRole } from "@/lib/auth/access";
import { loadHubEvent } from "@/lib/live/hub-data";
import { formatLabel } from "@/lib/competition/event-format";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { eventSettings } from "@/db/schema";

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { event, role } = await loadHubEvent(eventId);
  const isAdmin = hasRole(role, "admin");
  const site = process.env.NEXT_PUBLIC_SHOWLIVE_URL ?? "";
  const label = formatLabel(event);
  const db = await getDb();
  const [st] = await db.select({ scorersCanEdit: eventSettings.scorersCanEdit }).from(eventSettings).where(eq(eventSettings.eventId, event.id)).limit(1);
  const canEditScores = isAdmin || (role === "scorer" && !!st?.scorersCanEdit);

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        {/* basis 28rem: quando as ações não cabem ao lado, o título fica numa linha própria em vez de espremido. */}
        <div className="min-w-0 flex-[1_1_28rem]">
          <Link href="/hub" className="inline-flex items-center gap-1 text-xs text-base-content/55 hover:text-base-content">
            <ArrowLeft size={13} /> Meus eventos
          </Link>
          <Kicker className="mt-2 text-[11px]">
            {label.kind} · {label.name}
          </Kicker>
          <h1 className="stage-display mt-1 line-clamp-2 break-words text-2xl sm:text-4xl">{event.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusSwitch eventId={event.id} status={event.status} disabled={!isAdmin} />
          {event.code ? (
            <>
              <CopyChip label="EVENTO" value={`${site}/e/${event.code}`} display={event.code} />
              <Link href={`/e/${event.code}`} target="_blank" className={toolLinkClass("outline")}>
                <Tv size={15} /> Telão
              </Link>
              <Link href={`/mesa/${event.code}`} target="_blank" className={toolLinkClass("secondary")}>
                <ClipboardCheck size={15} /> Mesa
              </Link>
            </>
          ) : (
            <>
              <span
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed border-base-content/25 px-3 py-1.5 text-xs text-base-content/60"
                title="Os códigos de acesso só existem com o evento ao vivo"
              >
                <KeyRound size={13} /> Códigos gerados ao ficar ao vivo
              </span>
              <Link href={`/hub/${event.id}/previa`} target="_blank" className={toolLinkClass("outline")}>
                <Tv size={15} /> Prévia do telão
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 sm:mt-6 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-6">
        {/* No celular/tablet a navegação vira uma faixa de abas fixa logo abaixo do cabeçalho (h-14). */}
        <aside className="sticky top-14 z-30 -mx-4 min-w-0 border-b border-base-300 bg-base-100/95 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6 lg:top-20 lg:z-auto lg:mx-0 lg:self-start lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          <EventNav eventId={event.id} isAdmin={isAdmin} format={event.format} canEditScores={canEditScores} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
