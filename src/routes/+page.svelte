<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/env';
  import qrcode from 'qrcode-generator';
  import LockKeyholeIcon from '@lucide/svelte/icons/lock-keyhole';
  import Maximize2Icon from '@lucide/svelte/icons/maximize-2';
  import Minimize2Icon from '@lucide/svelte/icons/minimize-2';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import SaveIcon from '@lucide/svelte/icons/save';
  import SmartphoneIcon from '@lucide/svelte/icons/smartphone';
  import * as api from '../lib/api.js';
  import { readOpenIdFromHash } from '../lib/pairing.js';
  import { Button } from '../lib/components/ui/button';
  import * as Card from '../lib/components/ui/card';
  import { Input } from '../lib/components/ui/input';
  import { Label } from '../lib/components/ui/label';
  import * as Alert from '../lib/components/ui/alert';
  import CopyButton from '../lib/components/copy-button.svelte';
  import PairingDialog from '../lib/components/pairing-dialog.svelte';

  const OPENID_KEY = 'hh_openid';
  const REFRESH_MS = 10_000;

  const POWERSHELL_GITHUB =
    'powershell -NoProfile -c "iex (irm https://raw.githubusercontent.com/Naptie/wxmp-storage-dumper/main/scripts/install.ps1)"';
  const POWERSHELL_GITEE =
    'powershell -NoProfile -c "iex (irm https://gitee.com/naptie/wxmp-storage-dumper/raw/main/scripts/install.ps1)"';

  let openid = $state<string | null>(null);
  let booted = $state(false);

  let qrSvg = $state<string | null>(null);
  let info = $state<api.CodeInfo | null>(null);
  let issuedAt = $state(0);
  let error = $state<string | null>(null);
  let countdown = $state(0);
  let busy = $state(false);

  let isFullscreen = $state(false);
  let fullscreenHint = $state<string | null>(null);

  let pairingOpen = $state(false);
  let pairingOpenId = $state('');

  let timer: ReturnType<typeof setInterval> | null = null;
  let nextAt = 0;

  const inactive = $derived(info !== null && info.mackCode === 0 && info.passTime != null);

  onMount(() => {
    adoptOpenIdFromUrl();

    if (!openid) {
      const stored = localStorage.getItem(OPENID_KEY);
      if (stored && api.isValidOpenId(stored)) {
        openid = stored;
        start();
      }
    }
    booted = true;

    const syncFullscreen = () => {
      isFullscreen = !!document.fullscreenElement;
    };
    syncFullscreen();
    document.addEventListener('fullscreenchange', syncFullscreen);

    const onHashChange = () => {
      adoptOpenIdFromUrl();
    };
    window.addEventListener('hashchange', onHashChange);

    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener('fullscreenchange', syncFullscreen);
      window.removeEventListener('hashchange', onHashChange);
    };
  });

  /**
   * Adopt an openId handed over through the URL fragment (a pairing link).
   */
  function adoptOpenIdFromUrl() {
    const url = new URL(location.href);
    const incoming = readOpenIdFromHash(url.hash);

    if (incoming && api.isValidOpenId(incoming)) {
      localStorage.setItem(OPENID_KEY, incoming);
      if (openid !== incoming) {
        openid = incoming;
        info = null;
        qrSvg = null;
        start();
      }
    }

    if (url.hash) {
      history.replaceState(null, '', url.pathname + url.search);
    }
  }

  function saveFromInput() {
    const value = document.getElementById('openid-input') as HTMLInputElement | null;
    const candidate = value?.value.trim() ?? '';
    if (!api.isValidOpenId(candidate)) {
      error = 'Open ID 格式不正确（应为 o 开头的 28 位字符串）。';
      return;
    }
    error = null;
    localStorage.setItem(OPENID_KEY, candidate);
    openid = candidate;
    start();
  }

  function forget() {
    if (!confirm('清除本机保存的 Open ID？')) return;
    localStorage.removeItem(OPENID_KEY);
    openid = null;
    qrSvg = null;
    info = null;
    error = null;
    pairingOpenId = '';
    if (timer) clearInterval(timer);
    timer = null;
  }

  function start() {
    poll().then(tick);
    if (!timer) timer = setInterval(tick, 500);
  }

  async function poll() {
    if (!openid || busy) return;
    busy = true;
    try {
      // Fetch the permission status block alongside the first QR; it is
      // also refreshed implicitly whenever info is cleared.
      if (!info) {
        info = await api.fetchCodeInfo(openid);
      }
      const payload = await api.fetchQr(openid);
      qrSvg = renderQr(payload.qr);
      issuedAt = payload.issuedAt;
      error = null;
      nextAt = Date.now() + REFRESH_MS;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      nextAt = Date.now() + 10000;
    } finally {
      busy = false;
    }
  }

  function tick() {
    countdown = Math.max(0, Math.ceil((nextAt - Date.now()) / 1000));
    if (nextAt && Date.now() >= nextAt) poll();
  }

  function renderQr(qr: string): string {
    // EC level 'L' matches the mini program's canvas renderer — the module
    // matrix is identical down to the mask pattern (verified).
    const q = qrcode(0, 'L');
    q.addData(qr);
    q.make();
    return q.createSvgTag({ cellSize: 6, margin: 0, scalable: true });
  }

  /**
   * Fullscreen is a toggle: enter it, and come back out of it again.
   * `document.fullscreenElement` is the source of truth — it also flips when
   * the user leaves fullscreen with Esc or the browser's own affordance.
   */
  async function toggleFullscreen() {
    fullscreenHint = null;
    const root = document.documentElement;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (typeof root.requestFullscreen === 'function') {
        await root.requestFullscreen();
      } else {
        fullscreenHint = '当前浏览器不支持网页全屏。';
      }
    } catch (e) {
      fullscreenHint = `无法切换全屏：${e instanceof Error ? e.message : String(e)}`;
    }
  }

  /** Hand the credential over to a phone via a pairing QR code. */
  function openPairing(id: string) {
    pairingOpenId = id;
    pairingOpen = true;
  }

  function pairFromInput() {
    const value = document.getElementById('openid-input') as HTMLInputElement | null;
    const candidate = value?.value.trim() ?? '';
    if (!api.isValidOpenId(candidate)) {
      error = 'Open ID 格式不正确（应为 o 开头的 28 位字符串）。';
      return;
    }
    error = null;
    openPairing(candidate);
  }

  function issuedTime(ts: number): string {
    return new Date(ts).toLocaleTimeString('zh-CN', { hour12: false });
  }
</script>

<svelte:head>
  <title>慧湖通通行码</title>
  <meta name="description" content="慧湖通学生公寓通行二维码" />
</svelte:head>

{#if !browser || !booted}
  <!-- avoid SSR/CSR mismatch before localStorage is readable -->
  <div class="text-muted-foreground flex min-h-svh items-center justify-center">…</div>
{:else if !openid}
  <div class="flex min-h-svh items-center justify-center p-6">
    <Card.Root class="w-full max-w-xl">
      <Card.Header>
        <Card.Title>慧湖通通行码</Card.Title>
        <Card.Description>首次使用，请先绑定账号 ID。</Card.Description>
      </Card.Header>
      <Card.Content class="flex flex-col gap-4">
        <div class="flex items-start gap-2">
          <LockKeyholeIcon class="text-muted-foreground mt-1.5 size-4 shrink-0" />
          <div class="text-muted-foreground text-sm leading-7">
            <p>绑定前，你需要先找到自己的账号 ID（Open ID）。</p>
            <p>需用一台 Windows 10/11 x64 电脑，并登录 Windows 微信 4.x。</p>
            <ol class="list-outside list-decimal space-y-1 pl-5">
              <li>
                按 Win+R，粘贴并运行：
                <div class="flex items-start gap-2">
                  <code class="bg-muted block flex-1 rounded px-2 py-1 text-xs break-all">
                    {POWERSHELL_GITHUB}
                  </code>
                  <CopyButton text={POWERSHELL_GITHUB} label="复制安装命令" />
                </div>
                <p>如遇到网络问题，请运行：</p>
                <div class="flex items-start gap-2">
                  <code class="bg-muted block flex-1 rounded px-2 py-1 text-xs break-all">
                    {POWERSHELL_GITEE}
                  </code>
                  <CopyButton text={POWERSHELL_GITEE} label="复制备用安装命令" />
                </div>
              </li>
              <li>按提示在微信中打开「慧湖通」（若已打开，请先完全关闭再重新打开）。</li>
              <li>
                确认输出 <code>appId</code> 为 <code>wx2660b404a3b7575a</code>，复制
                <code>openId</code>。
              </li>
              <li>在下方输入框中粘贴 Open ID，并点击按钮保存。</li>
              <li>电脑上的操作完成后，用「生成手机配对二维码」把同一个 Open ID 带到手机上。</li>
            </ol>
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <Label for="openid-input">Open ID</Label>
          <Input id="openid-input" placeholder="在此处粘贴 Open ID" autocomplete="off" />
          <Button onclick={saveFromInput}>
            <SaveIcon />
            保存并显示通行码
          </Button>
          <Button variant="outline" onclick={pairFromInput}>
            <SmartphoneIcon />
            生成手机配对二维码
          </Button>
        </div>
        {#if error}
          <Alert.Root variant="destructive">
            <Alert.Title>出错</Alert.Title>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Root>
        {/if}
      </Card.Content>
    </Card.Root>
  </div>
{:else}
  <div class="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
    <h1 class="text-xl font-semibold">慧湖通 · 通行二维码</h1>

    <div class="bg-card rounded-xl border p-5">
      <div class="w-[min(72vmin,560px)] [&_svg]:h-auto [&_svg]:w-full">
        {#if qrSvg}
          <div class={inactive ? 'opacity-20 grayscale' : ''}>
            <!-- eslint-disable-next-line svelte/no-at-html-tags — server-signed QR string rendered locally -->
            {@html qrSvg}
          </div>
        {:else}
          <div class="text-muted-foreground grid h-[min(72vmin,560px)] place-items-center">
            {error ? '获取失败' : '正在获取…'}
          </div>
        {/if}
      </div>
    </div>

    {#if error}
      <Alert.Root variant="destructive" class="max-w-xl">
        <Alert.Title>刷新失败</Alert.Title>
        <Alert.Description>{error}</Alert.Description>
      </Alert.Root>
    {:else if info}
      <div class="text-status-ok font-medium">{info.text}</div>
    {/if}

    {#if info}
      <div class="text-muted-foreground text-sm leading-6">
        {info.name}
        <br />
        {info.apartment}
        {#if info.companyName}
          <br />
          {info.companyName}
        {/if}
      </div>
    {/if}

    <div class="text-muted-foreground/70 text-xs">
      {#if issuedAt}
        {issuedTime(issuedAt)}
        · {countdown}s
      {/if}
    </div>

    <div class="flex flex-wrap items-center justify-center gap-2">
      <Button onclick={toggleFullscreen}>
        {#if isFullscreen}
          <Minimize2Icon />
          退出全屏
        {:else}
          <Maximize2Icon />
          全屏
        {/if}
      </Button>
      <Button variant="outline" onclick={() => openPairing(openid!)}>
        <SmartphoneIcon />
        发送到手机
      </Button>
      <Button variant="ghost" size="sm" class="text-muted-foreground" onclick={forget}>
        <RefreshCwIcon />
        更换 Open ID
      </Button>
    </div>

    {#if fullscreenHint}
      <p class="text-status-err max-w-xl text-xs">{fullscreenHint}</p>
    {/if}
  </div>
{/if}

{#if browser && booted}
  <PairingDialog bind:open={pairingOpen} openId={pairingOpenId} />
{/if}
