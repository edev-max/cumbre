<script lang="ts">
  import { q, uno } from '../../lib/db';
  import { app } from '../../lib/estado.svelte';
  import { usd, bsDeC, num, entero, fecha, hoy, pct } from '../../lib/formato';
  import Pagina from '../../lib/ui/Pagina.svelte';
  import Columnas from '../../lib/ui/Columnas.svelte';
  import BarrasH from '../../lib/ui/BarrasH.svelte';
  import Tabla from '../../lib/ui/Tabla.svelte';

  let desde = $state(hoy().slice(0, 8) + '01'), hasta = $state(hoy());
  let r = $state<any>({}), dias = $state<any[]>([]), prods = $state<any[]>([]), metodos = $state<any[]>([]), clientes = $state<any[]>([]), cats = $state<any[]>([]);
  $effect(() => { app.version; desde; hasta; cargar(); });
  const W = `v.estado = 'confirmada' AND substr(v.fecha, 1, 10) BETWEEN ? AND ?`;
  async function cargar() {
    const p = [desde, hasta];
    r = await uno(`SELECT COALESCE(SUM(v.total_c), 0) AS total, COALESCE(SUM(v.impuesto_c), 0) AS iva, COUNT(*) AS n,
                   COALESCE(SUM(v.total_c - v.pagado_c), 0) AS pendiente FROM ventas v WHERE ${W}`, p);
    const u = await uno<any>(`SELECT COALESCE(SUM(l.total_c * 100.0 / (100 + l.impuesto_tasa) - l.cantidad * l.costo_c), 0) AS u,
                              COALESCE(SUM(l.total_c * 100.0 / (100 + l.impuesto_tasa)), 0) AS base FROM venta_lineas l JOIN ventas v ON v.id = l.venta_id WHERE ${W}`, p);
    r = { ...r, utilidad: u?.u || 0, base: u?.base || 0 };
    dias = (await q(`SELECT substr(v.fecha, 1, 10) AS d, SUM(v.total_c) AS t, COUNT(*) AS n FROM ventas v WHERE ${W} GROUP BY d ORDER BY d`, p))
      .map((f) => ({ etiqueta: fecha(f.d).split(' ').slice(0, 2).join(' '), valor: f.t, detalle: `${f.n} ventas` }));
    prods = await q(`SELECT l.descripcion AS nombre, SUM(l.cantidad) AS cant, SUM(l.total_c) AS total, SUM(l.total_c * 100.0 / (100 + l.impuesto_tasa) - l.cantidad * l.costo_c) AS utilidad, SUM(l.total_c * 100.0 / (100 + l.impuesto_tasa)) AS base
                     FROM venta_lineas l JOIN ventas v ON v.id = l.venta_id WHERE ${W} GROUP BY l.producto_id, l.descripcion ORDER BY total DESC`, p);
    metodos = await q(`SELECT m.nombre, SUM(c.monto_c) AS t, COUNT(*) AS n FROM cobros c JOIN ventas v ON v.id = c.venta_id LEFT JOIN metodos_pago m ON m.id = c.metodo_id
                       WHERE c.anulado = 0 AND substr(c.fecha, 1, 10) BETWEEN ? AND ? GROUP BY m.id ORDER BY t DESC`, p);
    clientes = await q(`SELECT c.nombre, SUM(v.total_c) AS t, COUNT(*) AS n FROM ventas v JOIN clientes c ON c.id = v.cliente_id WHERE ${W} GROUP BY c.id ORDER BY t DESC LIMIT 8`, p);
    cats = await q(`SELECT COALESCE(ca.nombre, 'Sin categoría') AS nombre, SUM(l.total_c) AS t FROM venta_lineas l JOIN ventas v ON v.id = l.venta_id
                    LEFT JOIN productos pr ON pr.id = l.producto_id LEFT JOIN categorias ca ON ca.id = pr.categoria_id WHERE ${W} GROUP BY ca.id ORDER BY t DESC`, p);
  }
</script>

<Pagina titulo="Reportes de ventas" desc="Montos en dólares con IVA; la utilidad se calcula sin IVA, contra el costo del momento de la venta.">
  {#snippet acciones()}
    <label class="row mute">Desde <input class="input" type="date" bind:value={desde} style="width:160px" /></label>
    <label class="row mute">Hasta <input class="input" type="date" bind:value={hasta} style="width:160px" /></label>
  {/snippet}
  <div class="kpis">
    <div class="glass kpi"><span>Ventas</span><b>{usd(r.total)}</b><small>{bsDeC(r.total, app.tasa)} a la tasa de hoy</small></div>
    <div class="glass kpi"><span>Operaciones</span><b>{entero(r.n)}</b><small>Ticket promedio {usd(r.n ? r.total / r.n : 0)}</small></div>
    <div class="glass kpi"><span>Utilidad bruta</span><b>{usd(Math.round(r.utilidad || 0))}</b><small>Margen {pct(r.base ? (r.utilidad / r.base) * 100 : 0)}</small></div>
    <div class="glass kpi"><span>IVA cobrado</span><b>{usd(r.iva)}</b><small>Pendiente por cobrar {usd(r.pendiente)}</small></div>
  </div>
  <div class="glass card stack"><h2>Ventas por día</h2><Columnas datos={dias} f={(v) => usd(v)} titulo="Ventas por día" /></div>
  <div class="tres">
    <div class="glass card stack"><h2>Por método de pago</h2><BarrasH datos={metodos.map((m) => ({ etiqueta: m.nombre, valor: m.t, detalle: m.n + ' cobros' }))} f={(v) => usd(v)} /></div>
    <div class="glass card stack"><h2>Por categoría</h2><BarrasH datos={cats.map((m) => ({ etiqueta: m.nombre, valor: m.t }))} f={(v) => usd(v)} /></div>
    <div class="glass card stack"><h2>Mejores clientes</h2><BarrasH datos={clientes.map((m) => ({ etiqueta: m.nombre, valor: m.t, detalle: m.n + ' ventas' }))} f={(v) => usd(v)} /></div>
  </div>
  <div class="glass">
    <Tabla filas={prods} vacio="Sin ventas en este período." max="480px"
      cols={[
        { k: 'nombre', t: 'Producto', clase: () => 'fuerte' }, { k: 'cant', t: 'Cantidad', al: 'r', f: (p) => num(p.cant) },
        { k: 'total', t: 'Vendido', al: 'r', f: (p) => usd(p.total) }, { k: 'utilidad', t: 'Utilidad', al: 'r', f: (p) => usd(Math.round(p.utilidad)) },
        { k: 'margen', t: 'Margen', al: 'r', f: (p) => pct(p.base ? (p.utilidad / p.base) * 100 : 0), clase: () => 'mute' }
      ]} />
  </div>
</Pagina>

<style>
  .tres { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; align-items: start; }
  @media (max-width: 1100px) { .tres { grid-template-columns: 1fr; } }
</style>
