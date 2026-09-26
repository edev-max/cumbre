<script lang="ts" generics="T extends Record<string, any>">
  import type { Snippet } from 'svelte';
  import type { Columna } from './tipos';
  let { cols, filas, onFila, celda, vacio = 'No hay nada todavía.', max = '' }:
    { cols: Columna<T>[]; filas: T[]; onFila?: (r: T) => void; celda?: Snippet<[T, Columna<T>]>; vacio?: string; max?: string } = $props();
  let orden = $state<{ k: string; asc: boolean } | null>(null);
  const vista = $derived.by(() => {
    if (!orden) return filas;
    const { k, asc } = orden;
    return [...filas].sort((a, b) => {
      const x = a[k], y = b[k];
      const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''), 'es', { numeric: true });
      return asc ? r : -r;
    });
  });
  function ordenar(k: string) { orden = orden?.k === k ? (orden.asc ? { k, asc: false } : null) : { k, asc: true }; }
</script>

<div class="t-wrap" style:max-height={max || null}>
  {#if filas.length}
    <table class="tabla">
      <thead>
        <tr>
          {#each cols as c}
            <th class={c.al || ''} style:width={c.w || null} onclick={() => ordenar(c.k)}>
              {c.t}{#if orden?.k === c.k}<span class="flecha">{orden.asc ? '↑' : '↓'}</span>{/if}
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each vista as r}
          <tr class:clic={!!onFila} onclick={() => onFila?.(r)}>
            {#each cols as c}
              <td class="{c.al || ''} {c.clase?.(r) || ''}">
                {#if celda}{@render celda(r, c)}{:else}{c.f ? c.f(r) : (r[c.k] ?? '')}{/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  {:else}
    <div class="vacio"><p>{vacio}</p></div>
  {/if}
</div>

<style>
  .t-wrap { overflow: auto; border-radius: inherit; }
  th { cursor: pointer; }
  .flecha { margin-left: 4px; color: var(--rojo-2); }
</style>
