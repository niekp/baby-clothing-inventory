import { building } from '$app/environment';
import { startWorker } from '$lib/server/worker';

// Start de AI-worker bij server-init (niet tijdens build/prerender).
if (!building) startWorker();
