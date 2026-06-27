/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `bci-cache-${version}`;
const ASSETS = new Set([...build, ...files]); // app-shell + statics (incl. manifest/icons)
const NAV_FALLBACK = '/'; // laatste redmiddel bij een onbekende route offline

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll([...ASSETS]).then(() => c.add(NAV_FALLBACK).catch(() => {})))
      .then(() => sw.skipWaiting())
  );
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== CACHE) await caches.delete(key);
      }
      await sw.clients.claim();
    })()
  );
});

// Gebouwde app-shell/assets cache-first; data (API, /photos) altijd via het netwerk.
// Navigaties network-first met cached fallback: voorkomt de Chrome-foutpagina als
// het netwerk bij hervatten (na idle/lock) nog niet wakker is.
sw.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  if (ASSETS.has(url.pathname)) {
    event.respondWith(caches.match(event.request).then((cached) => cached ?? fetch(event.request)));
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(event.request);
          if (res.ok) (await caches.open(CACHE)).put(event.request, res.clone());
          return res;
        } catch {
          return (
            (await caches.match(event.request)) ??
            (await caches.match(NAV_FALLBACK)) ??
            Response.error()
          );
        }
      })()
    );
  }
});
