<script lang="ts">
  import CheckIcon from '@lucide/svelte/icons/check';
  import CopyIcon from '@lucide/svelte/icons/copy';
  import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
  import { writeToClipboard } from '../clipboard.js';
  import { Button, type ButtonSize, type ButtonVariant } from './ui/button';

  interface Props {
    /** the text that lands on the clipboard when the button is pressed */
    text: string;
    /** accessible name of the button */
    label?: string;
    /** bindable — true while the last copy succeeded */
    copied?: boolean;
    /** bindable — true when the last copy attempt failed */
    failed?: boolean;
    /**
     * How long the ✓ stays before the button reverts to the copy icon.
     * `null` keeps the current state until the parent resets it.
     */
    resetAfter?: number | null;
    variant?: ButtonVariant;
    size?: ButtonSize;
    class?: string;
  }

  let {
    text,
    label = '复制',
    copied = $bindable(false),
    failed = $bindable(false),
    resetAfter = 2000,
    variant = 'outline',
    size = 'icon-sm',
    class: className
  }: Props = $props();

  let timer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    // Drop the pending revert when the button goes away.
    return () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
  });

  async function copy() {
    const ok = await writeToClipboard(text);
    copied = ok;
    failed = !ok;

    if (timer) clearTimeout(timer);
    timer = null;
    if (resetAfter !== null && resetAfter > 0) {
      timer = setTimeout(() => {
        copied = false;
        failed = false;
        timer = null;
      }, resetAfter);
    }
  }
</script>

<Button {variant} {size} class={className} onclick={copy} aria-label={label} title={label}>
  {#if failed}
    <TriangleAlertIcon class="text-status-err" />
  {:else if copied}
    <CheckIcon class="text-status-ok" />
  {:else}
    <CopyIcon />
  {/if}
</Button>
