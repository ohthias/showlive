import { resolveLiveKey } from "@/lib/audience";
import { getSnapshot, subscribe } from "@/lib/live-hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A conexão fecha sozinha antes do limite e o navegador reconecta.
export const maxDuration = 60;

const STREAM_MS = 50_000;
const HEARTBEAT_MS = 15_000;

/**
 * GET /api/live/:key/stream?since=REV&audience=public|staff
 * key = código público (evento ao vivo) ou id do evento (só staff).
 * Server-Sent Events. Manda `snapshot` sempre que a revisão do evento muda.
 */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const url = new URL(req.url);
  const since = Number(url.searchParams.get("since") ?? -1);
  const wantsStaff = url.searchParams.get("audience") === "staff";

  const { event, audience } = await resolveLiveKey(req, code, wantsStaff);
  if (!event) return new Response("Evento não encontrado ou fora do ar", { status: 404 });
  if (!audience) return new Response("Sem acesso", { status: 403 });

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let lastSent = Number.isFinite(since) ? since : -1;
      let sending = Promise.resolve();
      let unsubscribe = () => {};
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      let timeout: ReturnType<typeof setTimeout> | undefined;

      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          close();
        }
      };

      const close = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        clearInterval(heartbeat);
        clearTimeout(timeout);
        try {
          controller.close();
        } catch {}
      };
      cleanup = close;

      write(`retry: 1500\n\n`);

      unsubscribe = subscribe(event.id, (revision) => {
        if (revision === -2) {
          write(`event: gone\ndata: {}\n\n`);
          close();
          return;
        }
        if (revision === lastSent) return;
        sending = sending.then(async () => {
          if (closed || revision <= lastSent) return;
          const snap = await getSnapshot(event.id, audience, revision).catch(() => null);
          if (!snap || closed || snap.revision <= lastSent) return;
          lastSent = snap.revision;
          write(`id: ${snap.revision}\nevent: snapshot\ndata: ${JSON.stringify({ ...snap, serverNow: Date.now() })}\n\n`);
          // O código público deixou de valer (evento encerrado/em preparação):
          // o telão recebe o estado final e a conexão termina.
          if (audience === "public" && snap.event.status !== "live") {
            write(`event: gone\ndata: {}\n\n`);
            close();
          }
        });
      });

      heartbeat = setInterval(() => write(`: ping ${Date.now()}\n\n`), HEARTBEAT_MS);
      timeout = setTimeout(() => {
        write(`event: bye\ndata: {}\n\n`);
        close();
      }, STREAM_MS);

      req.signal.addEventListener("abort", close);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
