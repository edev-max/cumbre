<script lang="ts" module>
  export interface ProductoSel { id: string; codigo: string; barra: string; nombre: string; unidad: string; precio_c: number; costo_c: number; iva: number; existencia: number }
</script>
<script lang="ts">
  import { q } from '../db';
  import { usd, num } from '../formato';
  import Icono from './Icono.svelte';
  /* buscador de productos por nombre, código o código de barras.
     Enter con un código exacto (lector de barras) lo agrega directo. */
  let { alElegir, almacen = '', compra = false, placeholder = 'Buscar producto o escanear código…', grande = false, enfocar = $bindable(0) }:
    { alElegir: (p: ProductoSel) => void; almacen?: string; compra?: boolean; placeholder?: string; grande?: boolean; enfocar?: number } = $props();
  let texto = $state(''), res = $state<ProductoSel[]>([]), sel = $state(0), abierto = $state(false);
  let input: HTMLInputElement;
  $effect(() => { if (enfocar) input?.focus(); });
  async function buscar() {
    const t = texto.trim();
    if (!t) { res = []; abierto = false; return; }
    res = await q(
      `SELECT p.id, p.codigo, p.barra, p.nombre, p.unidad, p.precio_c, p.costo_c, COALESCE(i.tasa, 0) AS iva,
              COALESCE((SELECT SUM(cantidad) FROM stock s WHERE s.producto_id = p.id ${almacen ? 'AND s.almacen_id = ?' : ''}), 0) AS existencia
       FROM productos p LEFT JOIN impuestos i ON i.id = p.impuesto_id
       WHERE p.activo = 1 AND ${compra ? 'p.se_compra' : 'p.se_vende'} = 1 AND (p.nombre LIKE ? OR p.codigo LIKE ? OR p.barra = ?)
       ORDER BY CASE WHEN p.barra = ? OR p.codigo = ? THEN 0 ELSE 1 END, p.nombre LIMIT 12`,
      [...(almacen ? [almacen] : []), `%${t}%`, `${t}%`, t, t, t]) as ProductoSel[];
    sel = 0; abierto = true;
  }
  function elegir(p: ProductoSel) { alElegir(p); texto = ''; res = []; abierto = false; input?.focus(); }
  function tecla(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, res.length - 1); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); e.preventDefault(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (res[sel]) elegir(res[sel]); }
    else if (e.key === 'Escape') { abierto = false; }
  }
</script>

<div class="bp" class:grande>
  <Icono n="buscar" size={grande ? 20 : 16} />
  <input bind:this={input} class="input" bind:value={texto} oninput={buscar} onkeydown={tecla} onfocus={buscar}
    onblur={() => setTimeout(() => (abierto = false), 150)} {placeholder} autocomplete="off" />
  {#if abierto}
    <div class="res glass">
      {#each res as p, i}
        <button class:on={i === sel} onmousedown={(e) => { e.preventDefault(); elegir(p); }} onmouseenter={() => (sel = i)}>
          <span class="n"><b>{p.nombre}</b><small>{p.codigo || ''}{p.barra ? ' · ' + p.barra : ''}</small></span>
          <span class="s mute">{num(p.existencia)} {p.unidad}</span>
          <span class="p">{usd(compra ? p.costo_c : p.precio_c)}</span>
        </button>
      {:else}
        <p class="mute nada">Ningún producto coincide.</p>
      {/each}
    </div>
  {/if}
</div>

<style>
  .bp { position: relative; flex: 1; min-width: 200px; }
  .bp > :global(svg) { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--ink-3); pointer-events: none; }
  .bp .input { padding-left: 36px; }
  .grande .input { height: 50px; font-size: 16px; border-radius: 14px; padding-left: 44px; }
  .grande > :global(svg) { left: 15px; }
  .res { position: absolute; z-index: 30; left: 0; right: 0; top: calc(100% + 6px); display: grid; padding: 6px; border-radius: 16px; background: var(--glass-solid); max-height: 360px; overflow: auto; }
  .res button { display: flex; align-items: center; gap: 12px; padding: 9px 10px; border: 0; border-radius: 10px; background: transparent; text-align: left; }
  .res button.on { background: var(--hover); }
  .n { flex: 1; display: grid; min-width: 0; }
  .n b { font-weight: 650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .n small { color: var(--ink-3); font-size: 11.5px; }
  .s { font-size: 12px; white-space: nowrap; }
  .p { font-weight: 700; font-variant-numeric: tabular-nums; }
  .nada { padding: 10px; }
</style>
