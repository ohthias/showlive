import { resolveLiveKey } from "@/lib/audience";
import { getSnapshot } from "@/lib/live-hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/live/:code/snapshot[?audience=staff] — estado do evento em JSON.
 * Usado como alternativa ao SSE (redes que bloqueiam streaming) e por
 * integrações (OBS, overlays). Cache curto na CDN absorve picos de acesso.
 */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const { event, audience } = await resolveLiveKey(req, code, new URL(req.url).searchParams.get("audience") === "staff");
  if (!event) return Response.json({ error: "Evento não encontrado ou fora do ar" }, { status: 404 });
  if (!audience) return Response.json({ error: "Sem acesso" }, { status: 403 });

  const snap = await getSnapshot(event.id, audience, event.revision);
  return Response.json(
    { ...snap, serverNow: Date.now() },
    {
      headers:
        audience === "public"
          ? { "Cache-Control": "public, max-age=0, s-maxage=1, stale-while-revalidate=4", "Access-Control-Allow-Origin": "*" }
          : { "Cache-Control": "private, no-store" },
    },
  );
}
