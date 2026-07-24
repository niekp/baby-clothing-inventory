import type { RequestHandler } from './$types';
import { addClient, removeClient, currentRevision } from '$lib/server/events';

// SSE-stream: stuurt bij elke mutatie de nieuwe revisie; clients refetchen dan.
export const GET: RequestHandler = ({ request }) => {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array>;
  let keepAlive: ReturnType<typeof setInterval>;

  const cleanup = () => {
    clearInterval(keepAlive);
    removeClient(controller);
  };

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
      addClient(c);
      c.enqueue(encoder.encode(`data: ${JSON.stringify({ revision: currentRevision() })}\n\n`));
      keepAlive = setInterval(() => {
        try {
          c.enqueue(encoder.encode(': keep-alive\n\n'));
        } catch {
          cleanup();
        }
      }, 30_000);
    },
    cancel: cleanup
  });

  // client-abort (tab dicht / navigatie): stream afsluiten
  request.signal.addEventListener('abort', () => {
    cleanup();
    try {
      controller.close();
    } catch {
      /* al gesloten */
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no' // proxy-buffering uit (edge/Caddy)
    }
  });
};
