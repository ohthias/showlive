import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Mesa, type MesaForm } from "@/components/mesa/Mesa";
import { AllianceMesa } from "@/components/mesa/AllianceMesa";
import { loadPrefs } from "@/lib/hub-data";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { rounds } from "@/db/schema";
import { defaultLeague } from "@/lib/obr";
import { getScorer } from "@/lib/access";
import { normalizeCode } from "@/lib/codes";
import { getMissions } from "@/lib/missions";
import { buildSnapshot, getEventByCode } from "@/lib/snapshot";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mesa de arbitragem", robots: { index: false } };

/**
 * Mesa de arbitragem: /mesa/CODIGO_DO_EVENTO (só existe com o evento ao vivo)
 * Entra quem tem o cookie da mesa (código de voluntário) ou é membro do evento.
 */
export default async function MesaPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const event = await getEventByCode(normalizeCode(code));
  if (!event) notFound();

  const scorer = await getScorer(event);
  if (!scorer) redirect("/entrar");

  const snapshot = await buildSnapshot(event, "staff");
  const { userId } = await auth();
  const prefs = scorer.via === "member" && userId ? await loadPrefs(userId) : null;

  if (event.format === "alliance" && event.challenge?.alliance) {
    return (
      <AllianceMesa
        initial={snapshot}
        challenge={event.challenge}
        scorerLabel={scorer.label}
        via={scorer.via}
        confirmBeforeSend={prefs?.mesaConfirmBeforeSend ?? true}
        keepScreenOn={prefs?.mesaKeepScreenOn ?? true}
      />
    );
  }

  let form: MesaForm;
  if (event.format === "obr") {
    const db = await getDb();
    const rows = await db.select({ id: rounds.id, meta: rounds.meta }).from(rounds).where(eq(rounds.eventId, event.id));
    const roundArena = Object.fromEntries(rows.filter((r) => r.meta?.arenaId).map((r) => [r.id, r.meta!.arenaId!]));
    form = { kind: "obr", league: event.league ?? defaultLeague(), roundArena };
  } else if ((event.format === "custom" || event.format === "fll_fe") && event.challenge) {
    form = { kind: "custom", challenge: event.challenge };
  } else {
    form = { kind: "fll", missions: getMissions(event.season) };
  }
  // Membro logado: aplica as preferências dele. Voluntário com código: padrão.
  return (
    <Mesa
      initial={snapshot}
      form={form}
      scorerLabel={scorer.label}
      via={scorer.via}
      confirmBeforeSend={prefs?.mesaConfirmBeforeSend ?? true}
      keepScreenOn={prefs?.mesaKeepScreenOn ?? true}
      scorerId={scorer.by}
      allowedRoundIds={scorer.allowedRoundIds}
    />
  );
}
