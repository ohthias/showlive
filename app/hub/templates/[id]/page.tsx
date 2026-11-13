import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getDb } from "@/db/client";
import { challengeTemplates } from "@/db/schema";
import { ChallengeBuilder } from "@/components/challenge/ChallengeBuilder";

export const dynamic = "force-dynamic";

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const [tpl] = await db
    .select()
    .from(challengeTemplates)
    .where(and(eq(challengeTemplates.id, id), eq(challengeTemplates.ownerId, userId!)))
    .limit(1);
  if (!tpl) notFound();
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Link href="/hub/templates" className="inline-flex items-center gap-1 text-xs text-base-content/55 hover:text-base-content">
        <ArrowLeft size={13} /> Templates
      </Link>
      <h1 className="mb-5 mt-1 text-2xl font-bold tracking-tight">{tpl.name}</h1>
      <ChallengeBuilder initial={tpl.definition} mode={{ kind: "template", templateId: tpl.id }} />
    </main>
  );
}
