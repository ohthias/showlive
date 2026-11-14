import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Telao } from "@/components/live/Telao";
import { normalizeCode } from "@/lib/codes";
import { buildSnapshot, getEventByCode } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const event = await getEventByCode(normalizeCode(code));
  return { title: event ? `${event.name} · ao vivo` : "Evento", robots: { index: false } };
}

/** Telão público: /e/CODIGO */
export default async function TelaoPage({ params }: Props) {
  const { code } = await params;
  const event = await getEventByCode(normalizeCode(code));
  if (!event) notFound();
  const snapshot = await buildSnapshot(event, "public");
  return <Telao initial={snapshot} />;
}
