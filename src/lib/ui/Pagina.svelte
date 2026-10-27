<script lang="ts">
  import type { Snippet } from 'svelte';
  let { titulo, desc = '', acciones, children, ancho = false }: { titulo: string; desc?: string; acciones?: Snippet; children: Snippet; ancho?: boolean } = $props();
</script>

<section class="pagina" class:ancho>
  <header class="pagina__head">
    <div class="pagina__t">
      <h1>{titulo}</h1>
      {#if desc}<p class="dim">{desc}</p>{/if}
    </div>
    {#if acciones}<div class="row row--wrap">{@render acciones()}</div>{/if}
  </header>
  <div class="pagina__body">{@render children()}</div>
</section>

<style>
  .pagina { display: grid; gap: 18px; padding: 22px 26px 40px; max-width: 1360px; margin: 0 auto; animation: entra 0.35s var(--ease) both; }
  .pagina.ancho { max-width: none; }
  .pagina__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .pagina__t { display: grid; gap: 6px; }
  .pagina__t p { font-size: 13.5px; }
  .pagina__body { display: grid; gap: 16px; min-width: 0; }
  @keyframes entra { from { opacity: 0; transform: translateY(6px); } }
</style>
