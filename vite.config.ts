import adapter from '@sveltejs/adapter-static';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

const base = (process.env.PATH_BASE || '') as '' | `/${string}`;

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      preprocess: vitePreprocess(),
      adapter: adapter(),
      paths: {
        base
      }
    })
  ],
  // @lucide/svelte ships raw `.svelte` sources. Vite externalises it for SSR
  // by default, and Node then fails on the unknown `.svelte` extension — so
  // it has to go through Vite's transform pipeline (and the Svelte compiler)
  // instead of being loaded as plain ESM.
  ssr: {
    noExternal: [/^@lucide\/svelte/]
  }
});
