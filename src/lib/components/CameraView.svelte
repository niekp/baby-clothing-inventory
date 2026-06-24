<script lang="ts" module>
  export type CamStatus =
    | 'requesting'
    | 'live'
    | 'denied'
    | 'nocamera'
    | 'insecure'
    | 'error'
    | 'dead';
  export interface CamState {
    status: CamStatus;
    torchOn: boolean;
    torchSupported: boolean;
    facing: 'environment' | 'user';
  }
</script>

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { canvasFromVideo, canvasIsBlack, canvasToJpegBlob } from '$lib/client/capture';

  let { onstate }: { onstate?: (s: CamState) => void } = $props();

  let video: HTMLVideoElement;
  let stream: MediaStream | null = null;
  let status = $state<CamStatus>('requesting');
  let torchOn = $state(false);
  let torchSupported = $state(false);
  let facing = $state<'environment' | 'user'>('environment');

  // Meld state-wijzigingen aan de ouder.
  $effect(() => {
    onstate?.({ status, torchOn, torchSupported, facing });
  });

  function stopStream() {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
  }

  async function acquire() {
    // getUserMedia vereist een secure context; over http-LAN is mediaDevices undefined.
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      status = 'insecure';
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      status = 'nocamera';
      return;
    }
    status = 'requesting';
    stopStream();
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
    } catch (e) {
      const name = (e as DOMException)?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        status = 'denied';
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        status = 'nocamera'; // bv. desktop zonder webcam → upload-modus
      } else {
        status = 'error';
      }
      return;
    }
    video.srcObject = stream;
    torchOn = false;
    const track = stream.getVideoTracks()[0];
    torchSupported = Boolean(
      (track?.getCapabilities?.() as { torch?: boolean } | undefined)?.torch
    );
    // dode stream detecteren (iOS na suspend)
    track?.addEventListener('ended', () => {
      status = 'dead';
    });
    try {
      await video.play();
    } catch {
      /* autoplay kan blokkeren; frame is er toch */
    }
    status = 'live';
  }

  // iOS: stream sterft na suspend/app-switch → bij terugkeer opnieuw verwerven.
  function onVisible() {
    if (document.visibilityState !== 'visible') return;
    const track = stream?.getVideoTracks()[0];
    if (!stream || !track || track.readyState === 'ended' || status === 'dead') {
      void acquire();
    }
  }

  onMount(() => {
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
    };
  });
  onDestroy(stopStream);

  // --- publieke API (via bind:this) ---

  export async function grabFrame(): Promise<Blob | null> {
    if (status !== 'live') return null;
    try {
      const canvas = canvasFromVideo(video);
      if (canvasIsBlack(canvas)) {
        status = 'dead';
        return null;
      }
      return await canvasToJpegBlob(canvas);
    } catch {
      return null;
    }
  }

  export async function flip(): Promise<void> {
    facing = facing === 'environment' ? 'user' : 'environment';
    await acquire();
  }

  export async function toggleTorch(): Promise<void> {
    const track = stream?.getVideoTracks()[0];
    if (!track || !torchSupported) return;
    try {
      await track.applyConstraints({
        advanced: [{ torch: !torchOn }]
      } as unknown as MediaTrackConstraints);
      torchOn = !torchOn;
    } catch {
      torchSupported = false;
    }
  }

  export function retry(): void {
    void acquire();
  }
</script>

<div class="camera">
  <!-- svelte-ignore a11y_media_has_caption -->
  <video bind:this={video} playsinline autoplay muted class:hidden={status !== 'live'}></video>
  {#if status !== 'live'}
    <div class="overlay">
      {#if status === 'requesting'}
        <p>Camera starten…</p>
      {:else if status === 'dead'}
        <p>Camera onderbroken.</p>
        <button onclick={retry}>Opnieuw verbinden</button>
      {:else if status === 'error'}
        <p>Camera niet beschikbaar.</p>
        <button onclick={retry}>Opnieuw proberen</button>
      {/if}
      <!-- 'denied' en 'nocamera' handelt de ouder af (upload-modus) -->
    </div>
  {/if}
</div>

<style>
  .camera {
    position: absolute;
    inset: 0;
    background: #000;
    overflow: hidden;
  }
  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  video.hidden {
    visibility: hidden;
  }
  .overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    color: #fff;
    text-align: center;
    padding: var(--space-5);
  }
  .overlay button {
    background: rgba(255, 255, 255, 0.18);
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.4);
    border-radius: var(--radius);
    padding: var(--space-3) var(--space-4);
  }
</style>
