// In-proces SSE-hub: revisieteller + open streams. Werkt bij één Node-proces
// (single-node, better-sqlite3) — geen externe pub/sub nodig.

type Client = ReadableStreamDefaultController<Uint8Array>;

let revision = 0;
const clients = new Set<Client>();
const encoder = new TextEncoder();

export function currentRevision(): number {
  return revision;
}

// Verhoog de revisie en meld 'iets is veranderd' aan alle verbonden clients.
export function broadcast(): void {
  revision++;
  const chunk = encoder.encode(`data: ${JSON.stringify({ revision })}\n\n`);
  for (const c of clients) {
    try {
      c.enqueue(chunk);
    } catch {
      clients.delete(c); // gesloten stream
    }
  }
}

export function addClient(c: Client): void {
  clients.add(c);
}

export function removeClient(c: Client): void {
  clients.delete(c);
}
