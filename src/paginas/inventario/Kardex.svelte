<script lang="ts">
  import { q, uno } from '../../lib/db';
  import { app } from '../../lib/estado.svelte';
  import { ruta } from '../../lib/rutas.svelte';
  import { num, fechaHora, usd } from '../../lib/formato';
  import Pagina from '../../lib/ui/Pagina.svelte';
  import BuscaProducto from '../../lib/ui/BuscaProducto.svelte';

  const TIPOS: Record<string, string> = { inicial: 'Inventario inicial', venta: 'Venta', compra: 'Compra', ajuste: 'Ajuste', traslado: 'Traslado', anulacion: 'Anulación de venta', devolucion: 'Devolución' };
  let prod = $state<any>(null), filas = $state<any[]>([]), almacenes = $state<any[]>([]), almacen = $state('');
  $effect(() => { const p = ruta.query.get('p'); if (p) elegir(p); });
  $effect(() => { app.version; almacen; if (prod) cargar(); });
  async function elegir(id: string) { prod = await uno('SELECT * FROM productos WHERE id = ?', [id]); }
  async function cargar() {
    almacenes = await q('SELECT id, nombre FROM almacenes ORDER BY principal DESC, nombre');
    const movs = await q(`SELECT m.*, a.nombre AS almacen FROM movimientos m LEFT JOIN almacenes a ON a.id = m.almacen_id
                          WHERE m.producto_id = ? ${almacen ? 'AND m.almacen_id = ?' : ''} ORDER BY m.fecha, m.rowid`, almacen ? [prod.id, almacen] : [prod.id]);
    let saldo = 0;
    filas = movs.map((m) => { saldo += m.cantidad; return { ...m, saldo }; }).reverse();
  }
  const ent = $derived(filas.reduce((a, f) => a + (f.cantidad > 0 ? f.cantidad : 0), 0));
  const sal = $derived(filas.reduce((a, f) => a + (f.cantidad < 0 ? -f.cantidad : 0), 0));
</script>

<Pagina titulo="Kardex" desc="La historia de un producto: cada entrada y salida con su saldo.">
  {#snippet acciones()}
    <div style="width:340px"><BuscaProducto alElegir={(p) => elegir(p.id)} placeholder="Elige un producto…" /></div>
    <select class="select" style="width:170px" bind:value={almacen}><option value="">Todos los almacenes</option>{#each almacenes as a}<option value={a.id}>{a.nombre}</option>{/each}</select>
  {/snippet}
  {#if prod}
    <div class="kpis">
      <div class="glass kpi"><span>Producto</span><b class="nom">{prod.nombre}</b><small>{prod.codigo || ''} · costo {usd(prod.costo_c)}</small></div>
      <div class="glass kpi"><span>Entradas</span><b class="ok">+{num(ent)}</b></div>
      <div class="glass kpi"><span>Salidas</span><b class="bad">−{num(sal)}</b></div>
      <div class="glass kpi"><span>Saldo</span><b>{num(ent - sal)} {prod.unidad}</b></div>
    </div>
    <div class="glass">
      <table class="tabla">
        <thead><tr><th>Fecha</th><th>Movimiento</th><th>Documento</th><th>Almacén</th><th class="r">Entra</th><th class="r">Sale</th><th class="r">Saldo</th><th class="r">Costo</th></tr></thead>
        <tbody>
          {#each filas as f}
            <tr><td>{fechaHora(f.fecha)}</td><td>{TIPOS[f.tipo] || f.tipo}{f.nota ? ' · ' + f.nota : ''}</td><td class="mute">{f.ref_numero || '—'}</td><td>{f.almacen}</td>
              <td class="r ok">{f.cantidad > 0 ? num(f.cantidad) : ''}</td><td class="r bad">{f.cantidad < 0 ? num(-f.cantidad) : ''}</td>
              <td class="r fuerte">{num(f.saldo)}</td><td class="r mute">{usd(f.costo_c)}</td></tr>
          {:else}<tr><td colspan="8" class="mute">Sin movimientos.</td></tr>{/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div class="glass vacio"><p>Busca un producto para ver su historia.</p></div>
  {/if}
</Pagina>

<style>.nom { font-size: 17px !important; }</style>
