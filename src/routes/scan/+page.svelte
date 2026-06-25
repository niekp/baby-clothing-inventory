<script lang="ts">
  import { onMount } from 'svelte';
  import CameraView, { type CamState } from '$lib/components/CameraView.svelte';
  import CaptureStrip, { type Capture } from '$lib/components/CaptureStrip.svelte';
  import CropFrame from '$lib/components/CropFrame.svelte';
  import SizeSlider from '$lib/components/SizeSlider.svelte';
  import BottomSheet from '$lib/components/BottomSheet.svelte';
  import Button from '$lib/components/Button.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { fileToNormalizedJpeg, uploadItem, type CropRect } from '$lib/client/capture';

  const SIZE_KEY = 'bci.scan.size';
  const CROP_KEY = 'bci.scan.crop';

  // hoogteband (volle breedte): ruime default, onthouden tussen sessies
  let crop = $state<CropRect>({ x: 0, y: 0.08, w: 1, h: 0.84 });
  function saveCrop(r: CropRect) {
    localStorage.setItem(CROP_KEY, JSON.stringify(r));
  }

  let cam = $state<CameraView>();
  let camState = $state<CamState>({
    status: 'requesting',
    torchOn: false,
    torchSupported: false,
    facing: 'environment'
  });

  let size = $state('68');
  let captures = $state<Capture[]>([]);
  let keySeq = 0;

  let activeKey = $state<number | null>(null);
  let active = $derived(captures.find((c) => c.key === activeKey) ?? null);
  let shutterBusy = false;
  let toast = $state<string | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  // Blobs voor retry van mislukte uploads, op capture-key.
  const blobs = new Map<number, Blob>();

  // Reactieve update: vervang het item door een nieuw object (nieuw array → zeker reactief).
  function patchCapture(key: number, patch: Partial<Capture>) {
    captures = captures.map((c) => (c.key === key ? { ...c, ...patch } : c));
  }

  onMount(() => {
    const saved = localStorage.getItem(SIZE_KEY);
    if (saved) size = saved;
    try {
      const c = localStorage.getItem(CROP_KEY);
      if (c) {
        const p = JSON.parse(c);
        crop = { x: 0, y: p.y, w: 1, h: p.h }; // band: altijd volle breedte
      }
    } catch {
      /* default crop */
    }
  });

  function showToast(msg: string) {
    toast = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = null), 2600);
  }

  function pickSize(s: string) {
    size = s;
    localStorage.setItem(SIZE_KEY, s); // steady: blijft staan tot je bewust wisselt
  }

  // Achtergrond-upload; UI wacht hier nooit op.
  function upload(blob: Blob, cap: Capture) {
    blobs.set(cap.key, blob);
    uploadItem(blob, cap.size)
      .then((item) => {
        // wissel naar de server-display-URL en geef de objectURL vrij (geen leak)
        const serverUrl = item.display_url ?? cap.url;
        if (item.display_url) URL.revokeObjectURL(cap.url);
        patchCapture(cap.key, { status: 'ok', id: item.id, url: serverUrl });
        blobs.delete(cap.key);
      })
      .catch(() => {
        patchCapture(cap.key, { status: 'failed' });
        showToast('Upload mislukt — tik de thumbnail om opnieuw te proberen');
      });
  }

  async function shutter() {
    if (shutterBusy) return; // dubbel-tik → geen dubbele opname
    shutterBusy = true;
    try {
      const blob = await cam?.grabFrame(crop);
      if (!blob) {
        showToast(
          camState.status === 'dead' ? 'Camera onderbroken — verbind opnieuw' : 'Geen frame'
        );
        return;
      }
      const cap: Capture = {
        key: keySeq++,
        url: URL.createObjectURL(blob),
        size,
        status: 'pending'
      };
      captures = [...captures, cap]; // shutter meteen weer klaar; POST loopt async
      upload(blob, cap);
    } finally {
      shutterBusy = false;
    }
  }

  // --- upload-modus (camera geweigerd / geen camera) ---
  async function onFiles(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    for (const file of files) {
      const blob = await fileToNormalizedJpeg(file);
      const cap: Capture = { key: keySeq++, url: URL.createObjectURL(blob), size, status: 'pending' };
      captures = [...captures, cap];
      upload(blob, cap);
    }
    input.value = '';
  }

  // --- thumbnail-acties (undo zonder scan te verlaten) ---
  function openThumb(c: Capture) {
    activeKey = c.key;
  }
  function closeThumb() {
    activeKey = null;
  }

  async function changeActiveSize(s: string) {
    const c = active;
    if (!c?.id) return;
    try {
      const res = await fetch(`/api/items/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ size: s })
      });
      if (!res.ok) throw new Error();
      patchCapture(c.key, { size: s });
      showToast(`Maat → ${s}`);
    } catch {
      showToast('Maat wijzigen mislukt');
    }
    closeThumb();
  }

  async function deleteActive() {
    const c = active;
    if (!c) return;
    if (c.id) {
      try {
        const res = await fetch(`/api/items/${c.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
      } catch {
        showToast('Verwijderen op de server mislukt');
      }
    }
    captures = captures.filter((x) => x.key !== c.key);
    URL.revokeObjectURL(c.url);
    blobs.delete(c.key);
    closeThumb();
  }

  function retryActive() {
    const c = active;
    if (!c) return;
    const blob = blobs.get(c.key);
    if (!blob) return;
    patchCapture(c.key, { status: 'pending' });
    upload(blob, c);
    closeThumb();
  }

  let uploadMode = $derived(
    camState.status === 'denied' ||
      camState.status === 'nocamera' ||
      camState.status === 'insecure'
  );
</script>

<div class="scan">
  {#if !uploadMode}
    <CameraView bind:this={cam} onstate={(s) => (camState = s)} />
    {#if camState.status === 'live'}
      <CropFrame bind:rect={crop} onchange={saveCrop} />
    {/if}
  {/if}

  <!-- topbar: sluiten -->
  <div class="topbar">
    <a class="close" href="/" aria-label="Sluiten"><Icon name="x" size={22} /></a>
  </div>

  {#if uploadMode}
    <div class="upload-pane">
      {#if camState.status === 'denied'}
        <p>Cameratoegang geweigerd. Je kunt foto's uploaden vanaf dit apparaat.</p>
      {:else if camState.status === 'insecure'}
        <p>De live camera vereist HTTPS (bv. via Tailscale serve). Upload zolang foto's vanaf dit apparaat.</p>
      {:else}
        <p>Geen camera gevonden. Upload foto's vanaf dit apparaat.</p>
      {/if}
      <label class="upload-btn">
        Foto's kiezen
        <input type="file" accept="image/*" multiple onchange={onFiles} hidden />
      </label>
    </div>
  {/if}

  <!-- onderbalk: maat-slider + torch · shutter · flip + strip -->
  <div class="bottombar">
    <div class="size-control">
      <SizeSlider current={size} onpick={pickSize} />
    </div>
    <div class="controls">
      <button
        class="ctrl"
        disabled={!camState.torchSupported}
        onclick={() => cam?.toggleTorch()}
        aria-label="Zaklamp"
        class:on={camState.torchOn}
      >
        <Icon name="flashlight" size={24} />
      </button>
      <button
        class="shutter"
        disabled={uploadMode || camState.status !== 'live'}
        onclick={shutter}
        aria-label="Foto maken"
      ></button>
      <button class="ctrl" onclick={() => cam?.flip()} disabled={uploadMode} aria-label="Camera draaien">
        <Icon name="switch-camera" size={24} />
      </button>
    </div>
    <CaptureStrip {captures} onthumb={openThumb} />
  </div>

  {#if toast}
    <div class="toast" role="status">{toast}</div>
  {/if}
</div>

<!-- thumbnail-editor -->
<BottomSheet open={active !== null} onclose={closeThumb} title="Item aanpassen">
  {#if active}
    <img class="preview" src={active.url} alt="" />
    {#if active.status === 'ok'}
      <p class="field-label">Maat wijzigen</p>
      <SizeSlider current={active.size} onpick={changeActiveSize} />
      <div class="editor-action"><Button variant="danger" block onclick={deleteActive}>Verwijderen</Button></div>
    {:else if active.status === 'pending'}
      <p>Bezig met opslaan…</p>
      <div class="editor-action"><Button variant="danger" block onclick={deleteActive}>Verwijderen</Button></div>
    {:else}
      <p>Upload mislukt.</p>
      <div class="row">
        <Button variant="ghost" block onclick={retryActive}>Opnieuw</Button>
        <Button variant="danger" block onclick={deleteActive}>Verwijderen</Button>
      </div>
    {/if}
  {/if}
</BottomSheet>

<style>
  .scan {
    position: fixed;
    inset: 0;
    background: #000;
    color: #fff;
  }
  .topbar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: calc(env(safe-area-inset-top) + var(--space-3)) var(--space-4) var(--space-3);
  }
  .close {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.55);
    border-radius: 50%;
    font-size: var(--fs-lg);
  }
  .bottombar {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    padding-bottom: calc(env(safe-area-inset-bottom) + var(--space-4));
    background: linear-gradient(to top, rgba(0, 0, 0, 0.55), transparent);
  }
  .size-control {
    background: rgba(0, 0, 0, 0.45);
    border-radius: var(--radius);
    padding: var(--space-2) var(--space-4) var(--space-3);
  }
  .controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .ctrl {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.18);
    font-size: 22px;
  }
  .ctrl.on {
    background: var(--accent);
  }
  .ctrl:disabled {
    opacity: 0.35;
  }
  .shutter {
    width: 76px;
    height: 76px;
    border-radius: 50%;
    background: #fff;
    border: 5px solid rgba(255, 255, 255, 0.55);
    box-shadow: 0 0 0 2px #000 inset;
  }
  .shutter:active {
    transform: scale(0.94);
  }
  .shutter:disabled {
    opacity: 0.4;
  }
  .upload-pane {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
    padding: var(--space-5);
    text-align: center;
  }
  .upload-btn {
    background: var(--accent);
    color: var(--accent-ink);
    padding: var(--space-3) var(--space-5);
    border-radius: var(--radius);
    font-weight: 600;
  }
  .toast {
    position: absolute;
    left: 50%;
    bottom: 180px;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.85);
    color: #fff;
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius);
    font-size: var(--fs-sm);
    max-width: 80%;
    text-align: center;
  }
  .preview {
    width: 100%;
    max-height: 40vh;
    object-fit: contain;
    border-radius: var(--radius);
    margin-bottom: var(--space-3);
  }
  .editor-action {
    margin-top: var(--space-3);
  }
  .row {
    display: flex;
    gap: var(--space-3);
  }
  .row :global(.btn) {
    flex: 1;
  }
</style>
