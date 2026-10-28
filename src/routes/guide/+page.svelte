<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/env';
  import { asset, resolve } from '$app/paths';
  import type { AssetPath } from '$app/types';
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
  import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
  import QrCodeIcon from '@lucide/svelte/icons/qr-code';
  import ScanLineIcon from '@lucide/svelte/icons/scan-line';
  import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
  import * as Alert from '../../lib/components/ui/alert';
  import { Button } from '../../lib/components/ui/button';
  import PairingDialog from '../../lib/components/pairing-dialog.svelte';
  import { isPhone, isStandalone } from '../../lib/device.js';
  import { OPENID_KEY, renderQrSvg } from '../../lib/pairing.js';

  interface Step {
    img: AssetPath;
    alt: string;
    title: string;
    body: string[];
  }

  const steps: Step[] = [
    {
      img: 'guide/01-share-guide.webp',
      alt: '手机浏览器打开安装指南页面，红框标出底部中间的分享按钮',
      title: '点击分享按钮',
      body: [
        '在手机浏览器中打开本页（通过扫描电脑上的入口二维码）。',
        '点击底部中间或地址栏旁的「分享」按钮。'
      ]
    },
    {
      img: 'guide/02-add-to-home.webp',
      alt: '浏览器分享面板，红框标出「添加到主屏幕」选项',
      title: '选择「添加到主屏幕」',
      body: ['在分享面板中找到「添加到主屏幕」。若未直接显示，向下滑动或点击「更多」。']
    },
    {
      img: 'guide/03-confirm.webp',
      alt: 'iOS「添加到主屏幕」确认页，右上角为「添加」按钮',
      title: '确认添加',
      body: [
        '保持「作为网页 App 打开」处于开启状态，点击右上角「添加」。',
        '主屏幕会出现「慧湖通通行码」图标。'
      ]
    },
    {
      img: 'guide/04-open-app.webp',
      alt: '手机主屏幕上的「慧湖通通行码」图标',
      title: '打开 App',
      body: ['点开主屏幕上的「慧湖通通行码」图标。', '首次打开会显示「扫码绑定」页面。']
    },
    {
      img: 'guide/05-scan-pairing.webp',
      alt: 'App 内扫码页面正对电脑屏幕上的配对二维码',
      title: '扫码完成绑定',
      body: [
        '在电脑端本页下方点击「出示配对二维码」。',
        '在 App 中点击「扫码绑定」，对准电脑屏幕扫描；识别成功后自动绑定并显示通行二维码。'
      ]
    }
  ];

  let booted = $state(false);
  let standalone = $state(false);
  let phoneBrowser = $state(false);
  let hasOpenId = $state(false);

  let pairingOpen = $state(false);
  let pairingOpenId = $state('');

  const onDesktop = $derived(browser && booted && !standalone && !phoneBrowser);

  // 本页二维码指向当前地址（含 GitHub Pages 的 /dushu-qr 基路径），
  // 保证手机扫到的就是用户此刻所在环境的真实地址。
  const guideQrSvg = $derived(browser && booted ? renderQrSvg(location.href) : '');

  onMount(() => {
    standalone = isStandalone();
    phoneBrowser = isPhone() && !standalone;
    hasOpenId = !!localStorage.getItem(OPENID_KEY);
    pairingOpenId = localStorage.getItem(OPENID_KEY) ?? '';
    booted = true;
  });
</script>

<svelte:head>
  <title>使用指南 · 慧湖通通行码</title>
  <meta name="description" content="将慧湖通通行码添加到手机主屏幕的图文指南" />
</svelte:head>

<div class="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
  <Button variant="ghost" size="sm" class="text-muted-foreground -ml-2" href={resolve('/')}>
    <ArrowLeftIcon />
    返回首页
  </Button>

  <header class="mt-4">
    <h1 class="text-2xl font-semibold tracking-tight">手机安装指南</h1>
    <p class="text-muted-foreground mt-2 text-sm leading-7">
      将「慧湖通通行码」添加到手机主屏幕，即可像原生 App 一样一键打开，直接出示通行二维码。
    </p>
  </header>

  {#if onDesktop}
    {#if hasOpenId}
      <Alert.Root class="mt-6">
        <CircleCheckIcon />
        <Alert.Title>电脑端已就绪</Alert.Title>
        <Alert.Description>Open ID 已验证并保存在本机。按下方步骤安装到手机即可。</Alert.Description
        >
      </Alert.Root>
    {:else}
      <Alert.Root variant="destructive" class="mt-6">
        <ShieldCheckIcon />
        <Alert.Title>尚未绑定 Open ID</Alert.Title>
        <Alert.Description>
          请先在首页完成 Open ID 获取与验证，再回到本页出示配对码。
        </Alert.Description>
      </Alert.Root>
    {/if}
  {:else if standalone}
    <Alert.Root class="mt-6">
      <ScanLineIcon />
      <Alert.Title>你已在 App 中</Alert.Title>
      <Alert.Description>
        安装已完成。点击下方按钮返回首页，扫描电脑屏幕上的配对二维码完成绑定。
      </Alert.Description>
    </Alert.Root>
    <div class="mt-4">
      <Button href={resolve('/')}>
        <ScanLineIcon />
        返回并扫码绑定
      </Button>
    </div>
  {/if}

  {#if onDesktop}
    <!-- 桌面专属：指南入口二维码 -->
    <section class="mt-12">
      <h2 class="text-lg font-semibold">第一步 · 手机扫码进入</h2>
      <div class="text-muted-foreground mt-3 space-y-2 text-sm leading-7">
        <p>用手机的系统相机扫描下方二维码，在手机浏览器中打开本指南。</p>
        <p>请使用系统相机或浏览器扫码——在微信等应用内打开将无法「添加到主屏幕」。</p>
      </div>
      <div class="mt-6 flex justify-center">
        <div class="rounded-xl bg-white p-3 shadow-xs">
          <div class="w-[min(60vmin,300px)] [&_svg]:h-auto [&_svg]:w-full">
            <!-- eslint-disable-next-line svelte/no-at-html-tags — 本站指南链接，本地生成 -->
            {@html guideQrSvg}
          </div>
        </div>
      </div>
    </section>
  {/if}

  <section class="mt-12">
    <h2 class="text-lg font-semibold">{onDesktop ? '第二步 · 安装步骤' : '安装步骤'}</h2>
    <ol class="mt-6 space-y-10">
      {#each steps as step, i (step.img)}
        <li class="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-3">
              <span
                class="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
              >
                {i + 1}
              </span>
              <h3 class="text-base font-semibold">{step.title}</h3>
            </div>
            <div class="text-muted-foreground mt-3 space-y-2 pl-10 text-sm leading-7">
              {#each step.body as para (para)}
                <p>{para}</p>
              {/each}
            </div>
          </div>
          <img
            src={asset(step.img)}
            alt={step.alt}
            width="1206"
            height="2622"
            loading="lazy"
            class="mx-auto w-44 shrink-0 rounded-xl border shadow-sm sm:mx-0 sm:w-48"
          />
        </li>
      {/each}
    </ol>
  </section>

  {#if onDesktop}
    <!-- 桌面专属：出示配对码 -->
    <section class="mt-12">
      <h2 class="text-lg font-semibold">第三步 · 出示配对码</h2>
      <p class="text-muted-foreground mt-3 text-sm leading-7">
        手机 App 打开后会停在「扫码绑定」页。此时回到电脑，点击下方按钮显示配对二维码，再用手机 App
        对准电脑屏幕扫描。
      </p>
      {#if hasOpenId}
        <div class="mt-6">
          <Button onclick={() => (pairingOpen = true)}>
            <QrCodeIcon />
            出示配对二维码
          </Button>
        </div>
      {:else}
        <div class="mt-6">
          <Button variant="outline" href={resolve('/')}>
            <ScanLineIcon />
            返回首页绑定 Open ID
          </Button>
        </div>
      {/if}
    </section>
  {/if}

  <Alert.Root class="mt-8">
    <ShieldCheckIcon />
    <Alert.Title>安全提示</Alert.Title>
    <Alert.Description>
      配对二维码、配对链接与通行码均等同于你的门禁凭证（内含 Open
      ID），请勿截图、拍照或转发给他人。凭证只保存在本机，页面不会把它发送到任何第三方服务器；如需在更多设备上使用，用「出示配对码」重新配对即可。
    </Alert.Description>
  </Alert.Root>
</div>

{#if browser && booted}
  <PairingDialog bind:open={pairingOpen} openId={pairingOpenId} />
{/if}
