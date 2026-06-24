# baby-clothing-inventory

Een SvelteKit full-stack PWA om kinderkleding te inventariseren: hoog-tempo scannen
(foto + maat), async AI-verrijking via de lokale ollama (`moondream`), kledingkast
met filters/filtersets, heatmap maat × type, en een outfit-creator (vrijstaande
cutouts via een rembg-sidecar, gecombineerd op een vrij canvas).

LAN/Tailscale-only, geen auth (netwerk = de beveiliging).

## Architectuur

- **App** (`docker-compose.yml`, service `app`): SvelteKit `adapter-node`, één
  Node-proces. `better-sqlite3` (WAL) + `sharp`. In-proces AI-worker (concurrency 1).
  Bridge-netwerk, host-publish `:28871`.
- **rembg-sidecar** (service `rembg`): Python/FastAPI; achtergrond-verwijdering →
  PNG met alpha. Modellen **in het image gebakken**: `isnet-general-use` (eager,
  ~2s, behoudt dunne bandjes) + `birefnet-general` (on-demand "verbeter cutout",
  ~47s). Alleen intern bereikbaar; de app praat 'm aan op `http://rembg:28872`.
- **ollama**: draait als losse container (services-rol), gebonden op
  `127.0.0.1:11434`. De app bereikt 'm via het gedeelde docker-netwerk **`ollama-net`**
  op servicenaam `http://ollama:11434` (de docker-rol maakt dat netwerk aan).
- **Data** in `data/` (overleeft re-deploys): `app.db`, `photos/{orig,disp,cutout,outfit}/`.

## Vereisten op de NUC

- **moondream** moet op de ollama-container staan:
  `docker exec ollama ollama pull moondream` (staat er sinds het vooronderzoek;
  niet via ansible afgedwongen).
- Het gedeelde netwerk `ollama-net` wordt door de `docker`-rol aangemaakt; ollama
  sluit erop aan (services-rol). Een selectieve `--tags apps`/`--tags services`-deploy
  maakt het netwerk ook aan (de task draait onder die tags).

## HTTPS vereist voor de live camera

`getUserMedia` werkt alleen in een **secure context**. Over `http://192.168.2.200:28871`
(LAN) is de live-camera-scan dus niet beschikbaar — de app valt dan terug op de
**upload-modus** (foto's kiezen) met een nette uitleg. Voor de hoog-tempo
"foto-foto-foto"-flow op je telefoon: ontsluit de app via **HTTPS**, bv.
`tailscale serve --https=443 http://localhost:28871` op de NUC, en open de
Tailscale-hostname. (De upload-modus en de rest van de app werken wél over http.)

## Deploy

```bash
ansible-playbook site.yml --tags apps -e app=baby-clothing-inventory \
  --vault-password-file .vault_pass
```

De `apps`-rol synct de source naar `/opt/projects/baby-clothing-inventory/`, rendert
`.env` uit de `apps`-entry in `group_vars/all/main.yml`, en draait
`docker compose up` (build+recreate bij wijzigingen). Eerste deploy bouwt de
rembg-image inclusief de gebakken modellen (groot, ~2–3 GB; alleen de eerste keer).

## Backup

`roles/backup/templates/backup.sh.j2` synct `data/` (db + `orig/` + `disp/` +
`cutout/` + outfit-thumbs) naar de Hetzner Storage Box via `rclone sync`, zonder
exclude. **Let op de omvang:** per item ~origineel (1–3 MB) + display-webp (~50–150 KB)
+ cutout-PNG (~100–400 KB), plus outfit-thumbnails. Bij honderden items loopt dit op;
geen prune ingebouwd — in de gaten houden en zo nodig `orig/` later excluden.

## Ontwikkelen

```bash
npm install
npm run dev          # dev-server
npm run check        # svelte-check (types + a11y)
npm test             # vitest (datalaag, foto's, filters, worker, outfits, canvas-math)
npm run build        # productie-build (adapter-node)
```

Env (zie `docker-compose.yml` defaults): `PORT`, `OLLAMA_URL`, `OLLAMA_MODEL`,
`OLLAMA_THREADS`, `REMBG_URL`, `REMBG_MODEL`, `DATABASE_PATH`, `PHOTOS_DIR`, `HOST`, `TZ`.

## Browser-ondersteuning

Moderne PWA-doelgroep. De heatmap gebruikt `color-mix()` (Chrome 111+, Safari 16.2+,
Firefox 113+). App-icons in `static/icons/` zijn placeholders.
