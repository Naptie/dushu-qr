<script lang="ts">
  import CameraOffIcon from '@lucide/svelte/icons/camera-off';
  import ScanLineIcon from '@lucide/svelte/icons/scan-line';
  import XIcon from '@lucide/svelte/icons/x';
  import { Button } from './ui/button';

  interface Props {
    /** bindable — while true the camera overlay is mounted and streaming */
    open?: boolean;
    /** called once with the decoded QR content, then the scanner closes itself */
    onresult: (text: string) => void;
  }

  let { open = $bindable(false), onresult }: Props = $props();

  let videoEl: HTMLVideoElement | null = $state(null);
  let status = $state<'starting' | 'scanning' | 'denied' | 'unavailable'>('starting');
  let slowHint = $state(false);

  let stream: MediaStream | null = null;
  let raf = 0;
  let canvas: HTMLCanvasElement | null = null;
  let decode: ((data: Uint8ClampedArray, w: number, h: number) => string | null) | null = null;
  let lastDecode = 0;
  let hintTimer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    if (!open) return;
    void begin();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      halt();
    };
  });

  /** jsQR 体积较大（~40KB），首次打开扫码时才加载。 */
  async function ensureDecoder(): Promise<void> {
    if (decode) return;
    const { default: jsQR } = await import('jsqr');
    decode = (data, w, h) => jsQR(data, w, h, { inversionAttempts: 'dontInvert' })?.data ?? null;
  }

  async function begin(): Promise<void> {
    halt();
    status = 'starting';
    slowHint = false;
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = setTimeout(() => (slowHint = true), 10_000);

    if (!navigator.mediaDevices?.getUserMedia) {
      status = 'unavailable';
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
    } catch (e) {
      status = e instanceof DOMException && e.name === 'NotFoundError' ? 'unavailable' : 'denied';
      return;
    }
    const video = videoEl;
    if (!open || !video) {
      halt();
      return;
    }
    video.srcObject = stream;
    try {
      await video.play();
    } catch {
      // muted + playsinline 下一般不会失败；失败时 rAF 循环仍可从视频取帧。
    }
    await ensureDecoder();
    if (!open || !stream) {
      halt();
      return;
    }
    status = 'scanning';
    raf = requestAnimationFrame(loop);
  }

  function halt(): void {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = null;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    if (videoEl) videoEl.srcObject = null;
  }

  /** 解码节流到 ~10fps，并把长边压到 640px 以内，省电且足够识别屏幕二维码。 */
  function loop(): void {
    if (!open || !stream) return;
    const now = performance.now();
    if (now - lastDecode >= 100) {
      lastDecode = now;
      const video = videoEl;
      if (video && decode && video.readyState >= 2) {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (w > 0 && h > 0) {
          const scale = Math.min(1, 640 / Math.max(w, h));
          const cw = Math.round(w * scale);
          const ch = Math.round(h * scale);
          canvas ??= document.createElement('canvas');
          if (canvas.width !== cw || canvas.height !== ch) {
            canvas.width = cw;
            canvas.height = ch;
          }
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, cw, ch);
            const img = ctx.getImageData(0, 0, cw, ch);
            const text = decode(img.data, cw, ch);
            if (text) {
              found(text);
              return;
            }
          }
        }
      }
    }
    raf = requestAnimationFrame(loop);
  }

  function found(text: string): void {
    halt();
    open = false;
    onresult(text);
  }

  function onVisibility(): void {
    if (!open) return;
    // 切后台立即释放相机；回来时重新启动。
    if (document.hidden) halt();
    else void begin();
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') close();
  }
</script>

<svelte:window onkeydown={open ? onKeydown : undefined} />

{#if open}
  <div
    class="fixed inset-0 z-50 flex flex-col bg-black"
    role="dialog"
    aria-modal="true"
    aria-label="扫码绑定"
  >
    <header class="flex items-center justify-between px-4 py-3 text-white">
      <div class="flex items-center gap-2">
        <ScanLineIcon class="size-5" />
        <span class="text-sm font-medium">扫码绑定</span>
      </div>
      <button
        type="button"
        class="rounded-md p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        aria-label="关闭扫码"
        onclick={close}
      >
        <XIcon class="size-5" />
      </button>
    </header>

    <div class="relative min-h-0 flex-1 overflow-hidden">
      <video bind:this={videoEl} playsinline muted autoplay class="h-full w-full object-cover"
      ></video>

      {#if status === 'scanning'}
        <div class="pointer-events-none absolute inset-0 grid place-items-center">
          <div class="relative h-[min(72vmin,420px)] w-[min(72vmin,420px)]">
            <div
              class="absolute top-0 left-0 h-10 w-10 rounded-tl-lg border-t-3 border-l-3 border-white"
            ></div>
            <div
              class="absolute top-0 right-0 h-10 w-10 rounded-tr-lg border-t-3 border-r-3 border-white"
            ></div>
            <div
              class="absolute bottom-0 left-0 h-10 w-10 rounded-bl-lg border-b-3 border-l-3 border-white"
            ></div>
            <div
              class="absolute right-0 bottom-0 h-10 w-10 rounded-br-lg border-r-3 border-b-3 border-white"
            ></div>
          </div>
        </div>
      {:else if status === 'starting'}
        <div class="absolute inset-0 grid place-items-center">
          <p class="text-sm text-white/80">正在启动相机…</p>
        </div>
      {:else if status === 'denied'}
        <div
          class="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center"
        >
          <CameraOffIcon class="size-10 text-white/70" />
          <p class="text-sm font-medium text-white">无法使用相机</p>
          <p class="max-w-xs text-xs leading-5 text-white/60">
            相机权限被拒绝。请允许本 App 使用相机后重试，或返回使用手动粘贴导入。
          </p>
          <Button variant="outline" size="sm" class="mt-1" onclick={() => void begin()}>
            重试
          </Button>
        </div>
      {:else if status === 'unavailable'}
        <div
          class="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center"
        >
          <CameraOffIcon class="size-10 text-white/70" />
          <p class="text-sm font-medium text-white">无法使用相机</p>
          <p class="max-w-xs text-xs leading-5 text-white/60">
            当前环境不支持相机访问，请返回使用手动粘贴导入。
          </p>
        </div>
      {/if}
    </div>

    <footer class="px-4 pt-3 pb-8 text-center">
      <p class="text-xs leading-5 text-white/60">
        {#if slowHint && status === 'scanning'}
          尚未识别到二维码，请对准电脑屏幕上的配对码，注意避免屏幕反光。
        {:else if status === 'scanning'}
          对准电脑屏幕上的配对二维码
        {/if}
      </p>
    </footer>
  </div>
{/if}
