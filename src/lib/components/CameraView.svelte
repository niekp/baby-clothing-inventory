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
    aspect: number; // breedte/hoogte van het cameraframe (voor een passend venster)
  }
</script>

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    canvasFromBitmap,
    canvasFromVideo,
    canvasIsBlack,
    canvasToJpegBlob,
    type CropRect
  } from '$lib/client/capture';

  let { onstate, hires = true }: { onstate?: (s: CamState) => void; hires?: boolean } = $props();

  let video: HTMLVideoElement;
  let stream: MediaStream | null = null;
  // ImageCapture voor full-res stills (achter de hires-vlag); null = niet beschikbaar
  let imageCapture: ImageCapture | null = null;
  let status = $state<CamStatus>('requesting');
  let torchOn = $state(false);
  let torchSupported = $state(false);
  let facing = $state<'environment' | 'user'>('environment');
  let aspect = $state(0.75); // default 3:4 staand tot het frame bekend is

  // Meld state-wijzigingen aan de ouder.
  $effect(() => {
    onstate?.({ status, torchOn, torchSupported, facing, aspect });
  });

  function stopStream() {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    imageCapture = null;
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
        // 4:3 met landschap-getallen: Android Chrome draait de ratio mee met de
        // schermstand → staand 3:4-frame met volle sensor-FOV (zoals de native foto).
        // 16:9 gaf 9:16 (te smal); aspectRatio expliciet gaf juist landschap.
        video: { facingMode: facing, width: { ideal: 3072 }, height: { ideal: 2304 } },
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
    // werkelijke frame-verhouding lezen zodra bekend (voor een passend venster)
    video.onloadedmetadata = () => {
      if (video.videoWidth && video.videoHeight) aspect = video.videoWidth / video.videoHeight;
    };
    torchOn = false;
    const track = stream.getVideoTracks()[0];
    torchSupported = Boolean(
      (track?.getCapabilities?.() as { torch?: boolean } | undefined)?.torch
    );
    // full-res still via ImageCapture (waar ondersteund + vlag aan); anders videoframe
    imageCapture = null;
    if (hires && track && typeof (window as { ImageCapture?: unknown }).ImageCapture === 'function') {
      try {
        imageCapture = new ImageCapture(track);
      } catch {
        imageCapture = null;
      }
    }
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

  export async function grabFrame(crop?: CropRect): Promise<Blob | null> {
    if (status !== 'live') return null;
    try {
      const canvas = canvasFromVideo(video, crop);
      if (canvasIsBlack(canvas)) {
        status = 'dead';
        return null;
      }
      return await canvasToJpegBlob(canvas);
    } catch {
      return null;
    }
  }

  // takePhoto kan op sommige toestellen hangen → hard begrenzen zodat de shutter niet vastloopt.
  const PHOTO_TIMEOUT_MS = 4000;

  // Full-res still via ImageCapture; null bij elke fout/timeout (caller valt terug op grabFrame).
  async function grabPhoto(crop?: CropRect): Promise<Blob | null> {
    if (!imageCapture) return null;
    try {
      const blob = await Promise.race([
        imageCapture.takePhoto(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('takePhoto timeout')), PHOTO_TIMEOUT_MS))
      ]);
      const bitmap = await createImageBitmap(blob);
      try {
        const canvas = canvasFromBitmap(bitmap, crop);
        if (canvasIsBlack(canvas)) return null;
        return await canvasToJpegBlob(canvas);
      } finally {
        bitmap.close();
      }
    } catch {
      return null;
    }
  }

  // Voorkeurspad: full-res still (hires); valt terug op het videoframe.
  export async function capture(crop?: CropRect): Promise<Blob | null> {
    if (status !== 'live') return null;
    return (await grabPhoto(crop)) ?? (await grabFrame(crop));
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
