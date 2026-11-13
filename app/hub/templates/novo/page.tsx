import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ChallengeBuilder } from "@/components/challenge/ChallengeBuilder";
import { blankChallenge, CHALLENGE_PRESETS, CHALLENGE_TYPES, type ChallengeType } from "@/lib/challenge";

export default async function NewTemplatePage({ searchParams }: { searchParams: Promise<{ modelo?: string; tipo?: string }> }) {
  const { modelo, tipo } = await searchParams;
  const preset = CHALLENGE_PRESETS.find((p) => p.id === modelo)?.challenge;
  const type = (tipo && tipo in CHALLENGE_TYPES ? tipo : "missions") as ChallengeType;
  const initial = preset ? structuredClone(preset) : blankChallenge(type);
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Link href="/hub/templates" className="inline-flex items-center gap-1 text-xs text-base-content/55 hover:text-base-content">
        <ArrowLeft size={13} /> Templates
      </Link>
      <h1 className="mb-5 mt-1 text-2xl font-bold tracking-tight">{preset ? `Novo template a partir de “${preset.name}”` : "Novo template de desafio"}</h1>
      <ChallengeBuilder initial={initial} mode={{ kind: "template", templateId: null }} />
    </main>
  );
}
