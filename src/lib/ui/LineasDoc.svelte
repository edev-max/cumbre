<script lang="ts" module>
  export interface LineaEd { producto_id: string | null; descripcion: string; unidad: string; cantidad: string; precio: string; descuento: string; iva: number; existencia?: number }
</script>
<script lang="ts">
  import { app } from '../estado.svelte';
  import { usd, bsDeC, num, montoEditable, leerMonto, leerNumero } from '../formato';
  import { linea as calc, totales } from '../calculos';
  import BuscaProducto from './BuscaProducto.svelte';
  import Icono from './Icono.svelte';
  /* líneas de un documento (nota de venta u orden de compra) */
  let { lineas = $bindable([]), modo = 'venta', almacen = '' }: { lineas?: LineaEd[]; modo?: 'venta' | 'compra'; almacen?: string } = $props();
  function aCalc(l: LineaEd) { return { cantidad: leerNumero(l.cantidad), precio_c: leerMonto(l.precio), descuento: leerNumero(l.descuento), impuesto_tasa: l.iva }; }
  const t = $derived(totales(lineas.map(aCalc)));
</script>

<div class="ld">
  <div class="glass tabla-wrap">
    <table class="tabla">
      <thead><tr>
        <th>Producto</th><th class="r" style="width:110px">Cantidad</th><th class="r" style="width:120px">{modo === 'venta' ? 'Precio $' : 'Costo $'}</th>
        {#if modo === 'venta'}<th class="r" style="width:80px">Desc. %</th>{/if}
        <th class="r" style="width:70px">IVA</th><th class="r" style="width:110px">Total</th><th style="width:40px"></th>
      </tr></thead>
      <tbody>
        {#each lineas as l, i}
          <tr>
            <td><b>{l.descripcion}</b>{#if modo === 'venta' && l.existencia !== undefined}<br /><small class="mute">Hay {num(l.existencia)} {l.unidad}</small>{/if}</td>
            <td><input class="input num" bind:value={l.cantidad} inputmode="decimal" /></td>
            <td><input class="input num" bind:value={l.precio} inputmode="decimal" /></td>
            {#if modo === 'venta'}<td><input class="input num" bind:value={l.descuento} inputmode="decimal" /></td>{/if}
            <td class="r mute">{l.iva ? l.iva + ' %' : 'E'}</td>
            <td class="r fuerte">{usd(calc(aCalc(l)).total_c)}</td>
            <td><button class="btn btn--ghost btn--icon btn--sm" onclick={() => lineas.splice(i, 1)} aria-label="Quitar"><Icono n="x" size={14} /></button></td>
          </tr>
        {/each}
        <tr class="agregar"><td colspan={modo === 'venta' ? 7 : 6}>
          <BuscaProducto {almacen} compra={modo === 'compra'} placeholder="Agregar producto…"
            alElegir={(p) => { const ya = lineas.find((x) => x.producto_id === p.id); if (ya) ya.cantidad = String(leerNumero(ya.cantidad) + 1); else lineas.push({ producto_id: p.id, descripcion: p.nombre, unidad: p.unidad, cantidad: '1', precio: montoEditable(modo === 'venta' ? p.precio_c : p.costo_c), descuento: '0', iva: p.iva, existencia: p.existencia }); }} />
        </td></tr>
      </tbody>
    </table>
  </div>
  <div class="tot glass">
    <div class="row"><span class="mute">Subtotal</span><span class="spacer"></span><span class="num">{usd(t.subtotal_c)}</span></div>
    {#if t.descuento_c}<div class="row"><span class="mute">Descuento</span><span class="spacer"></span><span class="num">−{usd(t.descuento_c)}</span></div>{/if}
    <div class="row"><span class="mute">IVA</span><span class="spacer"></span><span class="num">{usd(t.impuesto_c)}</span></div>
    <div class="row gran"><span>Total</span><span class="spacer"></span><b class="num">{usd(t.total_c)}</b></div>
    <div class="row"><span class="spacer"></span><span class="num dim">{bsDeC(t.total_c, app.tasa)}</span></div>
  </div>
</div>

<style>
  .ld { display: grid; gap: 14px; }
  .tabla-wrap { overflow: visible; }
  .tabla td .input { height: 32px; }
  .agregar td { padding: 12px 14px; }
  .tot { justify-self: end; width: min(360px, 100%); display: grid; gap: 6px; padding: 16px 18px; }
  .gran { padding-top: 8px; margin-top: 4px; border-top: 1px solid var(--line); font-weight: 700; }
  .gran b { font-size: 22px; font-weight: 850; }
</style>
