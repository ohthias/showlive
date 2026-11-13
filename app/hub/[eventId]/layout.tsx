import Link from "next/link";
import { ArrowLeft, ClipboardCheck, KeyRound, Tv } from "lucide-react";
import { CopyChip } from "@/components/hub/CopyChip";
import { EventNav } from "@/components/hub/EventNav";
import { StatusSwitch } from "@/components/hub/StatusSwitch";
import { cornerBtn } from "@/components/ui/brand";
import { hasRole } from "@/lib/access";
import { loadHubEvent } from "@/lib/hub-data";
import { formatLabel } from "@/lib/event-format";
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
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <Link href="/hub" className="inline-flex items-center gap-1 text-xs text-base-content/55 hover:text-base-content">
            <ArrowLeft size={13} /> Meus eventos
          </Link>
          <h1 className="mt-1 truncate text-2xl font-bold tracking-tight sm:text-3xl">{event.name}</h1>
          <p className="mt-1 font-mono text-[11px] tracking-[0.14em] text-base-content/50">
            {label.kind.toUpperCase()} · {label.name.toUpperCase()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusSwitch eventId={event.id} status={event.status} disabled={!isAdmin} />
          {event.code ? (
            <>
              <CopyChip label="EVENTO" value={`${site}/e/${event.code}`} display={event.code} />
              <Link href={`/e/${event.code}`} target="_blank" className={`btn btn-sm btn-outline ${cornerBtn}`}>
                <Tv size={15} /> Telão
              </Link>
              <Link href={`/mesa/${event.code}`} target="_blank" className={`btn btn-sm btn-secondary ${cornerBtn}`}>
                <ClipboardCheck size={15} /> Mesa
              </Link>
            </>
          ) : (
            <>
              <span
                className="inline-flex items-center gap-1.5 rounded-tl-lg rounded-br-lg border border-dashed border-base-content/25 px-3 py-1.5 text-xs text-base-content/60"
                title="Os códigos de acesso só existem com o evento ao vivo"
              >
                <KeyRound size={13} /> Códigos gerados ao ficar ao vivo
              </span>
              <Link href={`/hub/${event.id}/previa`} target="_blank" className={`btn btn-sm btn-outline ${cornerBtn}`}>
                <Tv size={15} /> Prévia do telão
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[200px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <EventNav eventId={event.id} isAdmin={isAdmin} format={event.format} canEditScores={canEditScores} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
