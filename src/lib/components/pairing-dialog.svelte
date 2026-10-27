<script lang="ts">
  import { browser } from '$app/env';
  import qrcode from 'qrcode-generator';
  import ShareIcon from '@lucide/svelte/icons/share-2';
  import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
  import SmartphoneIcon from '@lucide/svelte/icons/smartphone';
  import { buildPairingLink } from '../pairing.js';
  import { Button } from './ui/button';
  import * as Dialog from './ui/dialog';
  import { Input } from './ui/input';
  import CopyButton from './copy-button.svelte';

  interface Props {
    /** bindable so the trigger button can open/close the dialog */
    open?: boolean;
    /** the credential to hand over to the phone */
    openId: string;
  }

  let { open = $bindable(false), openId }: Props = $props();

  let copied = $state(false);
  let copyFailed = $state(false);

  // Built from the live page URL so the link always points at the origin the
  // user is actually on — including the `/dushu-qr` base path GitHub Pages
  // serves the site under.
  const link = $derived(browser ? buildPairingLink(location.href, openId) : '');
  const qrSvg = $derived(link ? renderQr(link) : '');
  const canShare = $derived(browser && typeof navigator !== 'undefined' && !!navigator.share);

  function renderQr(text: string): string {
    // Error correction 'M' instead of the mini program's 'L': this QR is read
    // by a phone camera off a screen, so it can afford the extra redundancy.
    // `margin: 24` is a 4-module quiet zone (cellSize 6) — scanners need it.
    const q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    // `alt`/`title` are honoured by the library but missing from its bundled
    // typings, so the options object is kept out of the call expression.
    const options = {
      cellSize: 6,
      margin: 24,
      scalable: true,
      title: '扫码在手机上绑定同一个 Open ID',
      alt: '配对二维码'
    };
    return q.createSvgTag(options);
  }

  $effect(() => {
    // Reset the copy state whenever the dialog is closed, so the next handover
    // starts from a clean slate.
    if (!open) {
      copied = false;
      copyFailed = false;
    }
  });

  async function shareLink() {
    try {
      await navigator.share({ title: '慧湖通通行码', url: link });
    } catch {
      // User dismissed the share sheet, or the platform refused it — the
      // QR code and the copy button remain available.
    }
  }

  function selectAll(event: Event) {
    (event.currentTarget as HTMLInputElement).select();
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2">
        <SmartphoneIcon class="size-5" />
        发送到手机
      </Dialog.Title>
      <Dialog.Description>
        使用手机扫描下方二维码，并在系统浏览器中打开。随后根据提示完成后续配置步骤。
      </Dialog.Description>
    </Dialog.Header>

    {#if link}
      <div class="flex flex-col gap-4">
        <div class="flex justify-center">
          <div class="rounded-xl bg-white p-3 shadow-xs">
            <div class="w-[min(60vmin,300px)] [&_svg]:h-auto [&_svg]:w-full">
              <!-- eslint-disable-next-line svelte/no-at-html-tags — pairing URL rendered locally -->
              {@html qrSvg}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Input
            readonly
            value={link}
            aria-label="配对链接"
            class="font-mono text-xs"
            onclick={selectAll}
            onfocus={selectAll}
          />
          <CopyButton
            bind:copied
            bind:failed={copyFailed}
            text={link}
            label="复制配对链接"
            variant="outline"
            size="icon"
            resetAfter={null}
          />
          {#if canShare}
            <Button variant="outline" size="icon" onclick={shareLink} aria-label="分享配对链接">
              <ShareIcon />
            </Button>
          {/if}
        </div>

        {#if copied}
          <p class="text-status-ok text-xs">已复制，请发送至手机后使用系统浏览器打开。</p>
        {:else if copyFailed}
          <p class="text-status-err text-xs">复制失败，请长按上方链接手动复制。</p>
        {/if}

        <p class="text-muted-foreground flex items-start gap-2 text-xs leading-5">
          <ShieldCheckIcon class="mt-0.5 size-4 shrink-0" />
          <span>
            二维码内含你的账号凭证（Open
            ID）。它只会保存到本地，不会发送到任何服务器；请勿截图或转发给他人。
          </span>
        </p>
      </div>
    {/if}
  </Dialog.Content>
</Dialog.Root>
