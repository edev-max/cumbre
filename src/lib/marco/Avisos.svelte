<script lang="ts">
  import { avisos, dialogo } from '../estado.svelte';
  import Icono from '../ui/Icono.svelte';
  import Modal from '../ui/Modal.svelte';
  function responder(v: boolean) { dialogo.abierto = false; dialogo.resolver?.(v); dialogo.resolver = null; }
  let abierto = $state(false);
  $effect(() => { abierto = dialogo.abierto; });
  $effect(() => { if (!abierto && dialogo.abierto) responder(false); });
</script>

<div class="avisos" aria-live="polite">
  {#each avisos as a (a.id)}
    <div class="aviso glass {a.tipo}">
      <Icono n={a.tipo === 'error' ? 'alerta' : a.tipo === 'info' ? 'reloj' : 'check'} size={16} />
      <span>{a.texto}</span>
    </div>
  {/each}
</div>

<Modal bind:abierto titulo={dialogo.titulo} ancho={420}>
  {#if dialogo.texto}<p class="dim">{dialogo.texto}</p>{/if}
  {#snippet pie()}
    <button class="btn" onclick={() => responder(false)}>Cancelar</button>
    <button class="btn {dialogo.peligro ? 'btn--danger' : 'btn--primary'}" onclick={() => responder(true)}>{dialogo.accion}</button>
  {/snippet}
</Modal>

<style>
  .avisos { position: fixed; z-index: 90; right: 18px; bottom: 18px; display: grid; gap: 8px; justify-items: end; }
  .aviso { display: flex; align-items: center; gap: 10px; max-width: 420px; padding: 11px 14px; border-radius: 14px; font-weight: 550; font-size: 13px; background: var(--glass-solid); animation: e 0.3s var(--ease) both; }
  .aviso.ok :global(svg) { color: var(--ok); }
  .aviso.error { border-color: color-mix(in oklab, var(--bad) 45%, transparent); }
  .aviso.error :global(svg) { color: var(--bad); }
  @keyframes e { from { opacity: 0; transform: translateY(8px); } }
</style>
