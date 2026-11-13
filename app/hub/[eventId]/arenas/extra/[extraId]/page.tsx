import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ChallengeBuilder } from "@/components/challenge/ChallengeBuilder";
import { blankChallenge } from "@/lib/challenge";
import { loadHubEvent } from "@/lib/hub-data";

export const dynamic = "force-dynamic";

/** Construtor de um desafio extra da OBR ("novo" cria um). */
export default async function ExtraPage({ params }: { params: Promise<{ eventId: string; extraId: string }> }) {
  const { eventId, extraId } = await params;
  const { event } = await loadHubEvent(eventId, "admin");
  if (event.format !== "obr") notFound();
  const existing = extraId === "novo" ? null : event.league?.extras.find((x) => x.id === extraId);
  if (extraId !== "novo" && !existing) notFound();
  const { id: _id, ...challenge } = existing ?? { ...blankChallenge("time", "Desafio extra"), id: "" };
  void _id;
  return (
    <div>
      <Link href={`/hub/${event.id}/arenas`} className="inline-flex items-center gap-1 text-xs text-base-content/55 hover:text-base-content">
        <ArrowLeft size={13} /> Arenas e extras
      </Link>
      <h2 className="mb-4 mt-1 text-xl font-bold tracking-tight">{existing ? existing.name : "Novo desafio extra"}</h2>
      <ChallengeBuilder initial={challenge} mode={{ kind: "extra", eventId: event.id, extraId: existing?.id ?? null }} eventName={event.name} />
    </div>
  );
}
