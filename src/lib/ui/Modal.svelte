<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icono from './Icono.svelte';
  let { abierto = $bindable(false), titulo, children, pie, ancho = 460, cerrable = true }:
    { abierto?: boolean; titulo: string; children: Snippet; pie?: Snippet; ancho?: number; cerrable?: boolean } = $props();
  function tecla(e: KeyboardEvent) { if (abierto && cerrable && e.key === 'Escape') abierto = false; }
</script>

<svelte:window onkeydown={tecla} />
{#if abierto}
  <div class="velo" role="presentation" onclick={() => cerrable && (abierto = false)}></div>
  <div class="modal glass" style:width="min({ancho}px, 100vw - 24px)" role="dialog" aria-modal="true" aria-label={titulo}>
    <header class="row"><h2>{titulo}</h2><span class="spacer"></span>
      {#if cerrable}<button class="btn btn--ghost btn--icon btn--sm" onclick={() => (abierto = false)} aria-label="Cerrar"><Icono n="x" /></button>{/if}
    </header>
    <div class="modal__b">{@render children()}</div>
    {#if pie}<footer class="row">{@render pie()}</footer>{/if}
  </div>
{/if}

<style>
  .velo { position: fixed; inset: 0; z-index: 60; background: rgba(4, 6, 14, 0.5); backdrop-filter: blur(3px); animation: f 0.2s both; }
  .modal {
    position: fixed; z-index: 61; left: 50%; top: 50%; transform: translate(-50%, -50%); max-height: calc(100vh - 40px);
    display: grid; grid-template-rows: auto 1fr auto; gap: 14px; padding: 20px; border-radius: var(--r-xl);
    background: var(--glass-solid); animation: z 0.28s var(--ease) both;
  }
  .modal__b { overflow: auto; }
  footer { justify-content: flex-end; }
  @keyframes z { from { opacity: 0; transform: translate(-50%, -48%) scale(0.98); } }
  @keyframes f { from { opacity: 0; } }
</style>
