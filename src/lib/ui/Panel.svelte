<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icono from './Icono.svelte';
  /* panel lateral de vidrio para formularios */
  let { abierto = $bindable(false), titulo, sub = '', children, pie, ancho = 520 }:
    { abierto?: boolean; titulo: string; sub?: string; children: Snippet; pie?: Snippet; ancho?: number } = $props();
  function tecla(e: KeyboardEvent) { if (abierto && e.key === 'Escape') abierto = false; }
</script>

<svelte:window onkeydown={tecla} />
{#if abierto}
  <div class="velo" role="presentation" onclick={() => (abierto = false)}></div>
  <div class="panel glass" style:width="min({ancho}px, 100vw - 24px)" role="dialog" aria-label={titulo}>
    <header class="panel__h">
      <div><h2>{titulo}</h2>{#if sub}<p class="mute">{sub}</p>{/if}</div>
      <button class="btn btn--ghost btn--icon" onclick={() => (abierto = false)} aria-label="Cerrar"><Icono n="x" /></button>
    </header>
    <div class="panel__b">{@render children()}</div>
    {#if pie}<footer class="panel__f">{@render pie()}</footer>{/if}
  </div>
{/if}

<style>
  .velo { position: fixed; inset: 0; z-index: 50; background: rgba(4, 6, 14, 0.38); backdrop-filter: blur(2px); animation: f 0.2s both; }
  .panel {
    position: fixed; z-index: 51; top: 12px; right: 12px; bottom: 12px; display: grid; grid-template-rows: auto 1fr auto;
    border-radius: var(--r-xl); background: var(--glass-solid); animation: s 0.32s var(--ease) both;
  }
  .panel__h { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 20px 20px 12px; }
  .panel__h p { margin-top: 4px; font-size: 12.5px; }
  .panel__b { overflow: auto; padding: 6px 20px 20px; }
  .panel__f { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 20px; border-top: 1px solid var(--line); }
  @keyframes s { from { transform: translateX(24px); opacity: 0; } }
  @keyframes f { from { opacity: 0; } }
</style>
