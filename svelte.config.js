import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    // App is alleen LAN/Tailscale, geen auth, en bereikbaar via meerdere origins
    // (LAN-IP, Tailscale-naam, localhost) → een vaste ORIGIN is te broos. Bewust uit.
    csrf: { trustedOrigins: ['*'] }
  }
};

export default config;
