// ─────────────────────────────────────────────────────────────────────────────
// GET /api/gameday/stream — Server-Sent Events push.
//
// SSE rather than websockets: the data flows one way (server -> dashboard),
// it needs no extra dependency or custom server, it reconnects automatically
// in the browser, and it survives phone screen-locks better than a raw socket.
// The dashboard falls back to plain polling if the stream drops.
// ─────────────────────────────────────────────────────────────────────────────

import { buildSnapshot, startPolling } from "@/lib/football/poller";
import { subscribe } from "@/lib/football/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Comment frames keep proxies from closing an idle connection. */
const HEARTBEAT_MS = 25_000;

export async function GET(request: Request) {
  startPolling();

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      // Send the current board immediately so the UI paints without waiting
      // for the next poll.
      safeEnqueue(`data: ${JSON.stringify(buildSnapshot())}\n\n`);

      const unsubscribe = subscribe((payload) => {
        safeEnqueue(`data: ${payload}\n\n`);
      });

      const heartbeat = setInterval(() => {
        safeEnqueue(`: keep-alive\n\n`);
      }, HEARTBEAT_MS);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed by the runtime — nothing to do.
        }
      };

      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Stops nginx/Vercel from buffering the stream into uselessness.
      "X-Accel-Buffering": "no",
    },
  });
}
