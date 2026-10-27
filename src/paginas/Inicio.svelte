<script lang="ts">
  import { q, uno } from '../lib/db';
  import { app } from '../lib/estado.svelte';
  import { ir } from '../lib/rutas.svelte';
  import { usd, bsDeC, num, entero, fecha, hoy, ahora, tasaFmt } from '../lib/formato';
  import Pagina from '../lib/ui/Pagina.svelte';
  import Columnas from '../lib/ui/Columnas.svelte';
  import Icono from '../lib/ui/Icono.svelte';

  let k = $state<any>({}), dias = $state<any[]>([]), bajos = $state<any[]>([]), despachos = $state<any[]>([]);
  $effect(() => { app.version; cargar(); });
  async function cargar() {
    const d = hoy(), mes = d.slice(0, 7);
    k = {
      hoy: await uno(`SELECT COALESCE(SUM(total_c), 0) AS t, COUNT(*) AS n FROM ventas WHERE estado = 'confirmada' AND substr(fecha, 1, 10) = ?`, [d]),
      mes: await uno(`SELECT COALESCE(SUM(total_c), 0) AS t, COUNT(*) AS n FROM ventas WHERE estado = 'confirmada' AND substr(fecha, 1, 7) = ?`, [mes]),
      cobrar: await uno(`SELECT COALESCE(SUM(total_c - pagado_c), 0) AS t, COUNT(DISTINCT cliente_id) AS n FROM ventas WHERE estado = 'confirmada' AND total_c > pagado_c`),
      pagar: await uno(`SELECT COALESCE(SUM(total_c - pagado_c), 0) AS t, COUNT(DISTINCT proveedor_id) AS n FROM compras WHERE estado IN ('parcial','recibida') AND total_c > pagado_c`),
      inv: await uno(`SELECT COALESCE(SUM(s.cantidad * p.costo_c), 0) AS t, COUNT(DISTINCT p.id) AS n FROM stock s JOIN productos p ON p.id = s.producto_id WHERE s.cantidad > 0`)
    };
    const desde = ahora(-13).slice(0, 10);
    const filas = await q(`SELECT substr(fecha, 1, 10) AS d, SUM(total_c) AS t, COUNT(*) AS n FROM ventas WHERE estado = 'confirmada' AND substr(fecha, 1, 10) >= ? GROUP BY d`, [desde]);
    const m = new Map(filas.map((f) => [f.d, f]));
    dias = Array.from({ length: 14 }, (_, i) => {
      const dd = ahora(i - 13).slice(0, 10), f: any = m.get(dd);
      return { etiqueta: i === 13 ? 'Hoy' : fecha(dd).split(' ').slice(0, 2).join(' '), valor: f?.t || 0, detalle: f ? `${f.n} ventas` : 'Sin ventas' };
    });
    bajos = await q(`SELECT p.id, p.nombre, p.unidad, p.stock_min, COALESCE((SELECT SUM(cantidad) FROM stock s WHERE s.producto_id = p.id), 0) AS hay
                     FROM productos p WHERE p.activo = 1 AND p.stock_min > 0 AND hay <= p.stock_min ORDER BY hay / p.stock_min LIMIT 7`);
    despachos = await q(`SELECT d.id, d.numero, d.estado, d.programado, c.nombre AS cliente, r.nombre AS ruta FROM despachos d LEFT JOIN clientes c ON c.id = d.cliente_id
                         LEFT JOIN rutas r ON r.id = d.ruta_id WHERE d.estado IN ('pendiente','en_ruta') ORDER BY d.fecha LIMIT 6`);
  }
  const saludo = $derived(new Date().getHours() < 12 ? 'Buenos días' : new Date().getHours() < 19 ? 'Buenas tardes' : 'Buenas noches');
</script>

<Pagina titulo={saludo} desc={app.ajustes.empresa_nombre || ''}>
  {#snippet acciones()}
    <button class="btn" onclick={() => ir('compras/ordenes/nueva')}><Icono n="compras" />Orden de compra</button>
    <button class="btn" onclick={() => ir('ventas/notas/nueva')}><Icono n="doc" />Nota de venta</button>
    <button class="btn btn--primary" onclick={() => ir('ventas/pos')}><Icono n="pos" />Abrir caja</button>
  {/snippet}

  {#if !app.tasa}
    <button class="glass card aviso-tasa" onclick={() => ir('config/tasas')}><Icono n="alerta" /> Registra la tasa BCV de hoy para vender en bolívares.</button>
  {/if}

  <div class="kpis">
    <div class="glass kpi"><span>Ventas de hoy</span><b>{usd(k.hoy?.t)}</b><small>{bsDeC(k.hoy?.t, app.tasa)} · {entero(k.hoy?.n)} ventas</small></div>
    <div class="glass kpi"><span>Ventas del mes</span><b>{usd(k.mes?.t)}</b><small>{entero(k.mes?.n)} ventas</small></div>
    <button class="glass kpi clic" onclick={() => ir('ventas/cobranza')}><span>Por cobrar</span><b>{usd(k.cobrar?.t)}</b><small>{entero(k.cobrar?.n)} clientes</small></button>
    <button class="glass kpi clic" onclick={() => ir('compras/pagar')}><span>Por pagar</span><b>{usd(k.pagar?.t)}</b><small>{entero(k.pagar?.n)} proveedores</small></button>
    <button class="glass kpi clic" onclick={() => ir('inventario/existencias')}><span>Inventario al costo</span><b>{usd(k.inv?.t)}</b><small>{entero(k.inv?.n)} productos con existencia</small></button>
  </div>

  <div class="dos">
    <div class="glass card stack">
      <div class="row"><h2>Ventas de los últimos 14 días</h2><span class="spacer"></span><a class="mute ver" href="#/ventas/reportes">Ver reportes →</a></div>
      <Columnas datos={dias} f={(v) => usd(v)} titulo="Ventas diarias en dólares" alto={230} />
    </div>
    <div class="stack">
      <div class="glass card stack">
        <div class="row"><h2>Por reponer</h2><span class="spacer"></span><a class="mute ver" href="#/inventario/existencias">Existencias →</a></div>
        {#each bajos as b}
          <div class="row fila"><span class="spacer">{b.nombre}</span><span class="num" class:bad={b.hay <= 0} class:warn={b.hay > 0}>{num(b.hay)} {b.unidad}</span><small class="mute num">mín. {num(b.stock_min)}</small></div>
        {:else}<p class="mute">Todo por encima del mínimo.</p>{/each}
      </div>
      <div class="glass card stack">
        <div class="row"><h2>Despachos abiertos</h2><span class="spacer"></span><a class="mute ver" href="#/logistica/despachos">Logística →</a></div>
        {#each despachos as d}
          <div class="row fila"><span class="spacer">{d.cliente}<br /><small class="mute">{d.numero} · {d.ruta || 'sin ruta'}</small></span>
            <span class="tag tag--{d.estado === 'en_ruta' ? 'info' : 'warn'}">{d.estado === 'en_ruta' ? 'En ruta' : 'Por despachar'}</span></div>
        {:else}<p class="mute">No hay entregas pendientes.</p>{/each}
      </div>
    </div>
  </div>
  <p class="mute pie">Tasa BCV en uso: {app.tasa ? tasaFmt(app.tasa) : 'sin registrar'}</p>
</Pagina>

<style>
  .clic { text-align: left; cursor: pointer; transition: transform 0.15s var(--ease); }
  .clic:hover { transform: translateY(-2px); }
  .dos { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(300px, 1fr); gap: 12px; align-items: start; }
  .fila { padding: 7px 0; border-bottom: 1px solid var(--line); }
  .fila:last-child { border-bottom: 0; }
  .ver { font-size: 12.5px; text-decoration: none; }
  .aviso-tasa { display: flex; gap: 10px; align-items: center; color: var(--warn); font-weight: 600; text-align: left; }
  .pie { font-size: 12px; }
  @media (max-width: 1100px) { .dos { grid-template-columns: 1fr; } }
</style>
