import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { ArrowLeft, LayoutTemplate, ListChecks, Plus, Ruler, Scale, Timer } from "lucide-react";
import { TemplateActions } from "@/components/challenge/TemplateActions";
import { cornerBtn, EmptyState, Panel } from "@/components/ui/brand";
import { CHALLENGE_PRESETS, CHALLENGE_TYPES, type ChallengeType } from "@/lib/challenge";
import { loadTemplates } from "@/lib/hub-data";

export const dynamic = "force-dynamic";
const ICON = { missions: ListChecks, time: Timer, judged: Scale, measure: Ruler } as const;
const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

export default async function TemplatesPage() {
  const { userId } = await auth();
  const templates = await loadTemplates(userId!);
  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/hub" className="inline-flex items-center gap-1 text-xs text-base-content/55 hover:text-base-content">
            <ArrowLeft size={13} /> Meus eventos
          </Link>
          <p className="kicker mt-3">/ TEMPLATES DE DESAFIO</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
            Seus{" "}
            <span className="inline-block -rotate-1 bg-accent px-2 italic text-accent-content">desafios.</span>
          </h1>
          <p className="mt-2 max-w-xl text-base-content/65">
            Monte uma vez — tipo, objetivo, regras e pontuação — e use em quantos eventos quiser. Cada evento guarda a própria cópia.
          </p>
        </div>
        <Link href="/hub/templates/novo" className={`btn btn-primary ${cornerBtn} shadow-[4px_4px_0_0_var(--color-base-content)]`}>
          <Plus size={16} /> Novo template
        </Link>
      </div>

      <Panel kicker={`/ ${templates.length} SALVOS`} title="Meus templates">
        {templates.length === 0 ? (
          <EmptyState icon={<LayoutTemplate size={22} />} title="Nenhum template ainda" text="Comece do zero ou a partir de um modelo pronto abaixo." />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {templates.map((t) => {
              const I = ICON[t.type as ChallengeType] ?? ListChecks;
              return (
                <li key={t.id} className="flex flex-col rounded-tl-2xl rounded-br-2xl border border-base-300 p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-tl-lg rounded-br-lg bg-primary/10 text-primary">
                      <I size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link href={`/hub/templates/${t.id}`} className="block truncate font-bold hover:underline">
                        {t.name}
                      </Link>
                      <p className="text-xs text-base-content/55">
                        {CHALLENGE_TYPES[t.type as ChallengeType]?.label} · {t.definition.items.length} itens · editado {fmt.format(t.updatedAt)}
                      </p>
                    </div>
                  </div>
                  {t.definition.objective && <p className="mt-3 line-clamp-2 text-sm text-base-content/65">{t.definition.objective}</p>}
                  <TemplateActions id={t.id} name={t.name} />
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel kicker="/ PONTO DE PARTIDA" title="Modelos prontos">
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {CHALLENGE_PRESETS.map(({ id, challenge }) => {
            const I = ICON[challenge.type];
            return (
              <li key={id}>
                <Link
                  href={`/hub/templates/novo?modelo=${id}`}
                  className="group block h-full rounded-tl-2xl rounded-br-2xl border border-base-300 p-4 transition hover:-translate-y-0.5 hover:border-base-content/40"
                >
                  <I size={18} className="text-base-content/50 group-hover:text-primary" />
                  <p className="mt-2 font-bold">{challenge.name}</p>
                  <p className="font-mono text-[10px] tracking-wider text-base-content/50">{CHALLENGE_TYPES[challenge.type].label.toUpperCase()}</p>
                  <p className="mt-2 line-clamp-3 text-xs text-base-content/60">{challenge.objective}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      </Panel>
    </main>
  );
}
