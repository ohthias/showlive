import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { ArrowUpRight, CalendarClock, Radio, Trophy, Users } from "lucide-react";
import { CreateEventButton } from "@/components/hub/CreateEventDialog";
import { StatusPill } from "@/components/hub/StatusPill";
import { EmptyState } from "@/components/ui/brand";
import { AnimatedBackground, DisplayHeading } from "@/components/stage";
import { getIdentity } from "@/lib/auth/access";
import { listMyEvents, loadPrefs, loadTemplates } from "@/lib/live/hub-data";
import { formatLabel } from "@/lib/competition/event-format";

export const dynamic = "force-dynamic";

const ROLE_LABEL = { owner: "Dono", admin: "Admin", scorer: "Apurador" } as const;

export default async function HubHome() {
  const { userId } = await auth();
  const [me, events, prefs, templates] = await Promise.all([getIdentity(), listMyEvents(userId!), loadPrefs(userId!), loadTemplates(userId!)]);
  const tpls = templates.map((t) => ({ id: t.id, name: t.name, type: t.type, alliance: !!t.definition.alliance }));
  const live = events.filter((e) => e.status === "live").length;

  return (
    <main>
      <section className="relative isolate overflow-hidden border-b border-base-300 bg-base-100 px-4 py-12 sm:px-6">
        <AnimatedBackground />
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-6">
          <div>
            <DisplayHeading as="h1" tag="Hub de eventos" size="md">
              Olá, {me?.name?.split(" ")[0] ?? "organizador"}
              <span className="text-primary">.</span>
            </DisplayHeading>
            <p className="mt-3 max-w-xl text-base-content/65">
              Seus eventos e os eventos em que você foi convidado para ajudar.{" "}
              {live > 0 && (
                <span className="font-semibold text-primary">
                  {live} ao vivo agora.
                </span>
              )}
            </p>
          </div>
          <CreateEventButton big prefs={prefs} templates={tpls} />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        {events.length === 0 ? (
          <EmptyState
            icon={<Radio size={22} />}
            title="Nenhum evento ainda"
            text="Crie seu primeiro evento ao vivo. Você pode testar à vontade em modo preparação e zerar as notas depois."
          >
            <CreateEventButton prefs={prefs} templates={tpls} />
          </EmptyState>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((e) => {
              const [bg, accent, text] = e.theme.colors;
              return (
                <li key={e.id}>
                  <Link
                    href={`/hub/${e.id}`}
                    className="group block overflow-hidden rounded-tl-[1.5rem] rounded-br-[1.5rem] rounded-tr-md rounded-bl-md border border-base-300 bg-base-100 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_12px_30px_-18px_color-mix(in_oklab,var(--color-base-content)_45%,transparent)] focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <div className="relative h-28 overflow-hidden" style={{ background: bg, color: text }}>
                      {e.theme.background && !e.theme.background.endsWith(".mp4") && (
                        <div className="absolute inset-0 bg-cover bg-center opacity-50" style={{ backgroundImage: `url(${e.theme.background})` }} />
                      )}
                      <div aria-hidden className="absolute -right-6 -top-6 size-24 rotate-12 rounded-tl-2xl rounded-br-2xl" style={{ background: accent }} />
                      <div className="relative flex h-full flex-col justify-end p-4">
                        <p className="font-mono text-[10px] font-bold tracking-[0.2em] opacity-70">
                          {formatLabel(e).kind.toUpperCase()} · {formatLabel(e).name.toUpperCase()}
                        </p>
                        <p className="truncate text-xl font-black">{e.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3 text-sm">
                      <StatusPill status={e.status} />
                      <span className="inline-flex items-center gap-1 text-base-content/60">
                        <Users size={14} /> {e.teams}
                      </span>
                      <span className="inline-flex items-center gap-1 text-base-content/60">
                        <Trophy size={14} /> {e.scores}
                      </span>
                      <span className="ml-auto font-mono text-[10px] tracking-wider text-base-content/45">
                        {ROLE_LABEL[e.role]}
                      </span>
                      <ArrowUpRight size={16} className="text-base-content/30 transition group-hover:text-primary" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-10 flex items-center gap-2 text-xs text-base-content/50">
          <CalendarClock size={14} />
          Convidaram você com outro e-mail? Peça para convidarem o e-mail da sua conta RoboStage.
        </p>
      </section>
    </main>
  );
}
