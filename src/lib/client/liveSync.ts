// Live-sync: één EventSource naar /api/events → onChange bij elke nieuwe revisie.
// Valt terug op polling van /api/revision na herhaalde SSE-fouten, pauzeert
// wanneer de tab verborgen is, en haalt bij terugkeer gemiste updates in.
//
// Pauzeren: pagina's met niet-opgeslagen lokale state (bewerk-formulier,
// review-deck) roepen setSyncPaused(true) aan zodat een inkomende sync die niet
// wegvaagt; een gemiste update wordt bij hervatten alsnog toegepast.

const SSE_MAX_ERRORS = 3;
const POLL_MS = 5000;
const DEBOUNCE_MS = 400; // coalesce broadcast-bursts (bulk-cutouts) tot één refetch

let paused = false;
let missedWhilePaused = false;
let fire: () => void = () => {};

export function setSyncPaused(value: boolean): void {
  paused = value;
  if (!paused && missedWhilePaused) {
    missedWhilePaused = false;
    fire();
  }
}

export function startLiveSync(onChange: () => void): () => void {
  let es: EventSource | null = null;
  let pollId: ReturnType<typeof setInterval> | null = null;
  let errors = 0;
  let lastRevision = -1;
  let stopped = false;
  let debounceId: ReturnType<typeof setTimeout> | null = null;

  function scheduleChange() {
    if (debounceId) clearTimeout(debounceId);
    debounceId = setTimeout(() => {
      debounceId = null;
      onChange();
    }, DEBOUNCE_MS);
  }

  fire = () => {
    if (paused) missedWhilePaused = true;
    else scheduleChange();
  };

  // Nieuwe revisie? Baseline zetten bij de eerste (connect), daarna vuren.
  function seen(rev: number): boolean {
    if (rev <= lastRevision) return false;
    const first = lastRevision === -1;
    lastRevision = rev;
    return !first;
  }

  function stopPolling() {
    if (pollId) {
      clearInterval(pollId);
      pollId = null;
    }
  }

  async function pollRevision() {
    try {
      const { revision } = await (await fetch('/api/revision')).json();
      if (seen(revision)) fire();
    } catch {
      /* offline */
    }
  }

  function startPolling() {
    if (pollId) return;
    pollId = setInterval(() => void pollRevision(), POLL_MS);
  }

  function closeSse() {
    if (es) {
      es.close();
      es = null;
    }
  }

  function openSse() {
    if (stopped || es) return;
    es = new EventSource('/api/events');
    es.onmessage = (e) => {
      errors = 0;
      try {
        const { revision } = JSON.parse(e.data);
        if (seen(revision)) fire();
      } catch {
        /* keep-alive-comment */
      }
    };
    es.onerror = () => {
      // EventSource reconnect zelf; pas na aanhoudende fouten naar polling.
      if (++errors >= SSE_MAX_ERRORS) {
        closeSse();
        startPolling();
      }
    };
  }

  function pause() {
    closeSse();
    stopPolling();
  }

  function resume() {
    if (stopped) return;
    errors = 0;
    openSse();
    void pollRevision(); // gemiste updates inhalen
  }

  const onVisibility = () => (document.visibilityState === 'hidden' ? pause() : resume());
  document.addEventListener('visibilitychange', onVisibility);
  resume();

  return () => {
    stopped = true;
    document.removeEventListener('visibilitychange', onVisibility);
    if (debounceId) clearTimeout(debounceId);
    pause();
    fire = () => {};
  };
}
