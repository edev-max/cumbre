<script lang="ts">
  import { app } from '../estado.svelte';
  /* con logo propio del cliente: su logo y su nombre, y Cumbre como firma */
  let { compacto = false, propio = true }: { compacto?: boolean; propio?: boolean } = $props();
  const logo = $derived(propio ? app.ajustes.marca_logo : '');
</script>
<div class="marca" class:compacto>
  {#if logo}
    <img class="logo" src={logo} alt="" />
    {#if !compacto}<div class="t"><b class="emp">{app.ajustes.empresa_nombre}</b><small>Cumbre · by Apex Consulting</small></div>{/if}
  {:else}
    <svg viewBox="0 0 520 200" aria-hidden="true">
      <path d="M8 176 L120 140 L190 112 L228 84 L242 94 L252 78 L268 96 L290 64 L318 86 L390 132 L470 164 L512 176" />
      <path class="a" d="M290 50 L284 60 L296 60 Z" />
    </svg>
    {#if !compacto}<div class="t"><b>Cumbre</b><small>by Apex Consulting</small></div>{/if}
  {/if}
</div>
<style>
  .marca { display: flex; align-items: center; gap: 10px; min-width: 0; }
  svg { width: 46px; height: 18px; flex: none; }
  path { fill: none; stroke: var(--ink); stroke-width: 16; stroke-linecap: round; stroke-linejoin: round; }
  .a { fill: var(--rojo); stroke: none; }
  .logo { height: 38px; max-width: 76px; object-fit: contain; flex: none; border-radius: 8px; }
  .t { display: grid; line-height: 1.05; min-width: 0; }
  b { font-size: 17px; font-weight: 850; font-stretch: 125%; letter-spacing: -0.02em; }
  b.emp { font-size: 14px; font-stretch: 110%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  small { font-size: 10.5px; color: var(--ink-3); font-weight: 550; letter-spacing: 0.01em; }
</style>
