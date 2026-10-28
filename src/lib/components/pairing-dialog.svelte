<script lang="ts">
  import { browser } from '$app/env';
  import { resolve } from '$app/paths';
  import ShareIcon from '@lucide/svelte/icons/share-2';
  import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
  import SmartphoneIcon from '@lucide/svelte/icons/smartphone';
  import { buildPairingLink, renderQrSvg } from '../pairing.js';
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
  let idCopied = $state(false);
  let idCopyFailed = $state(false);

  // 配对链接固定指向首页（而非当前页面）：链接由浏览器打开时，
  // 首页的 fragment 接入逻辑会立即绑定并显示通行码；App 扫码则只解析
  // fragment，不关心目标路径。这样同一个码在两种消费方式下都成立。
  const link = $derived(
    browser ? buildPairingLink(new URL(resolve('/'), location.origin).toString(), openId) : ''
  );
  const qrSvg = $derived(
    link ? renderQrSvg(link, '扫码在其他设备上绑定同一个 Open ID', '配对二维码') : ''
  );
  const canShare = $derived(browser && typeof navigator !== 'undefined' && !!navigator.share);

  $effect(() => {
    // Reset the copy states whenever the dialog is closed, so the next handover
    // starts from a clean slate.
    if (!open) {
      copied = false;
      copyFailed = false;
      idCopied = false;
      idCopyFailed = false;
    }
  });

  async function shareLink() {
    try {
      await navigator.share({ title: '慧湖通通行码', url: link });
    } catch {
      // User dismissed the share sheet, or the platform refused it — the
      // QR code and the copy buttons remain available.
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
        出示配对码
      </Dialog.Title>
      <Dialog.Description>
        在手机 App 的「扫码绑定」中扫描下方二维码；其他设备的浏览器也可以打开链接完成绑定。
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

        <div class="flex flex-wrap items-center gap-2">
          <Input
            readonly
            value={link}
            aria-label="配对链接"
            class="min-w-0 flex-1 font-mono text-xs"
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
          <CopyButton
            bind:copied={idCopied}
            bind:failed={idCopyFailed}
            text={openId}
            label="复制 Open ID"
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
          <p class="text-status-ok text-xs">已复制链接，请发送至其他设备后用浏览器打开。</p>
        {/if}
        {#if idCopied}
          <p class="text-status-ok text-xs">
            已复制 Open ID，可在 App 的「手动粘贴导入」中粘贴使用。
          </p>
        {/if}
        {#if copyFailed || idCopyFailed}
          <p class="text-status-err text-xs">复制失败，请长按上方链接或二维码链接手动复制。</p>
        {/if}

        <p class="text-muted-foreground flex items-start gap-2 text-xs leading-5">
          <ShieldCheckIcon class="mt-0.5 size-4 shrink-0" />
          <span>
            二维码内含你的账号凭证（Open
            ID）。它只会保存在本地，不会发送到任何服务器；请勿截图或转发给他人。
          </span>
        </p>
      </div>
    {/if}
  </Dialog.Content>
</Dialog.Root>
