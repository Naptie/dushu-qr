<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';

  let { children } = $props();

  onMount(() => {
    if (!('serviceWorker' in navigator)) return;
    if (import.meta.env.DEV) return;

    navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {});
  });
</script>

<svelte:head>
  <meta name="theme-color" content="#ffffff" />
</svelte:head>

{@render children()}
