<script lang="ts">
  import { q, uno } from '../../lib/db';
  import { app, avisar, fallo, confirmar, refrescar } from '../../lib/estado.svelte';
  import { ir } from '../../lib/rutas.svelte';
  import { anularVenta, registrarCobro, anularCobro } from '../../lib/servicios/ventas';
  import { usd, bsDeC, num, fechaHora, fecha, tasaFmt } from '../../lib/formato';
  import { estadoPago, diasVencida } from '../../lib/calculos';
  import { documentoVenta } from '../../lib/imprimir';
  import { ESTADOS_DESPACHO } from '../../lib/servicios/logistica';
  import Pagina from '../../lib/ui/Pagina.svelte';
  import Cobro from '../../lib/ui/Cobro.svelte';
  import Icono from '../../lib/ui/Icono.svelte';

  let { id }: { id: string } = $props();
  let v = $state<any>(null), lineas = $state<any[]>([]), cobros = $state<any[]>([]), desp = $state<any>(null), cobrar = $state(false);
  $effect(() => { app.version; cargar(); });
  async function cargar() {
    v = await uno(`SELECT v.*, c.nombre AS cliente, c.rif AS cliente_rif, c.telefono AS cliente_tel, a.nombre AS almacen FROM ventas v
                   LEFT JOIN clientes c ON c.id = v.cliente_id LEFT JOIN almacenes a ON a.id = v.almacen_id WHERE v.id = ?`, [id]);
    lineas = await q('SELECT * FROM venta_lineas WHERE venta_id = ?', [id]);
    cobros = await q('SELECT c.*, m.nombre AS metodo FROM cobros c LEFT JOIN metodos_pago m ON m.id = c.metodo_id WHERE c.venta_id = ? ORDER BY c.fecha', [id]);
    desp = await uno(`SELECT d.*, r.nombre AS ruta, t.nombre AS transportista FROM despachos d LEFT JOIN rutas r ON r.id = d.ruta_id LEFT JOIN transportistas t ON t.id = d.transportista_id WHERE d.venta_id = ?`, [id]);
  }
  const saldo = $derived(v ? Math.max(0, v.total_c - v.pagado_c) : 0);
  const utilidad = $derived(lineas.reduce((a, l) => a + (l.total_c / (1 + l.impuesto_tasa / 100) - l.cantidad * l.costo_c), 0));
  async function anular() {
    if (!(await confirmar(`¿Anular ${v.numero}?`, 'La mercancía vuelve al inventario y los cobros quedan anulados. No se puede deshacer.', 'Anular venta', true))) return;
    try { await anularVenta(id); avisar('Venta anulada.'); refrescar(); } catch (e) { fallo(e); }
  }
  async function cobrarPagos(pagos: any[]) {
    for (const p of pagos) await registrarCobro({ cliente_id: v.cliente_id, venta_id: id, ...p });
    avisar('Cobro registrado.'); refrescar();
  }
  async function quitarCobro(c: any) {
    if (!(await confirmar('¿Anular este cobro?', `${c.metodo}: ${usd(c.monto_c)}. El saldo de la venta vuelve a subir.`, 'Anular cobro', true))) return;
    try { await anularCobro(c.id); refrescar(); } catch (e) { fallo(e); }
  }
</script>

{#if v}
  {@const e = estadoPago(v.total_c, v.pagado_c)}
  <Pagina titulo="{v.origen === 'pos' ? 'Ticket' : 'Nota'} {v.numero}" desc="{fechaHora(v.fecha)} · {v.cliente} · sale de {v.almacen}">
    {#snippet acciones()}
      <button class="btn" onclick={() => history.back()}><Icono n="atras" />Volver</button>
      <button class="btn" onclick={() => documentoVenta(id, v.origen === 'pos' ? 'ticket' : 'carta')}><Icono n="imprimir" />Imprimir</button>
      {#if v.estado !== 'anulada'}
        <button class="btn btn--danger" onclick={anular}>Anular</button>
        {#if saldo > 0}<button class="btn btn--primary" onclick={() => (cobrar = true)}><Icono n="cobro" />Registrar cobro</button>{/if}
      {/if}
    {/snippet}

    <div class="kpis">
      <div class="glass card k"><span class="mute">Total</span><b class="num">{usd(v.total_c)}</b><small class="num mute">{bsDeC(v.total_c, v.tasa)} · {tasaFmt(v.tasa)}</small></div>
      <div class="glass card k"><span class="mute">Cobrado</span><b class="num">{usd(v.pagado_c)}</b></div>
      <div class="glass card k"><span class="mute">Saldo</span><b class="num" class:warn={saldo > 0}>{usd(saldo)}</b>
        {#if saldo > 0 && v.vence}<small class="mute">Vence {fecha(v.vence)}{diasVencida(v.vence) ? ` · ${diasVencida(v.vence)} días de atraso` : ''}</small>{/if}</div>
      <div class="glass card k"><span class="mute">Estado</span>
        {#if v.estado === 'anulada'}<span class="tag">Anulada</span>{:else}<span class="tag tag--{e === 'pagada' ? 'ok' : e === 'parcial' ? 'info' : 'warn'}">{e === 'pagada' ? 'Pagada' : e === 'parcial' ? 'Abonada' : 'Por cobrar'}</span>{/if}
        <small class="mute num">Utilidad aprox. {usd(Math.round(utilidad))}</small>
      </div>
    </div>

    <div class="glass">
      <table class="tabla">
        <thead><tr><th>Producto</th><th class="r">Cantidad</th><th class="r">Precio</th><th class="r">Desc.</th><th class="r">IVA</th><th class="r">Total</th></tr></thead>
        <tbody>
          {#each lineas as l}
            <tr><td class="fuerte">{l.descripcion}{#if l.presentacion} <small class="mute">· {l.presentacion}</small>{/if}</td><td class="r">{num(l.cantidad)}</td><td class="r">{usd(l.precio_c)}</td><td class="r mute">{l.descuento ? l.descuento + ' %' : '—'}</td><td class="r mute">{l.impuesto_tasa ? l.impuesto_tasa + ' %' : 'E'}</td><td class="r fuerte">{usd(l.total_c)}</td></tr>
          {/each}
          <tr><td colspan="5" class="r mute">Subtotal · IVA</td><td class="r">{usd(v.subtotal_c - v.descuento_c)} · {usd(v.impuesto_c)}</td></tr>
        </tbody>
      </table>
    </div>

    <div class="dos">
      <div class="glass card stack">
        <h2>Cobros</h2>
        {#each cobros as c}
          <div class="row cobro" class:anulado={c.anulado}>
            <div class="spacer"><b>{c.metodo}</b><br /><small class="mute">{fechaHora(c.fecha)}{c.referencia ? ' · ref. ' + c.referencia : ''}{c.anulado ? ' · anulado' : ''}</small></div>
            <div class="r"><b class="num">{c.moneda === 'VES' ? 'Bs ' + num(c.monto) : usd(c.monto_c)}</b>{#if c.moneda === 'VES'}<br /><small class="mute num">{usd(c.monto_c)}</small>{/if}</div>
            {#if !c.anulado && v.estado !== 'anulada'}<button class="btn btn--ghost btn--icon btn--sm" title="Anular cobro" onclick={() => quitarCobro(c)}><Icono n="x" size={14} /></button>{/if}
          </div>
        {:else}<p class="mute">Sin cobros todavía.</p>{/each}
      </div>
      <div class="glass card stack">
        <h2>Entrega</h2>
        {#if desp}
          {@const est = ESTADOS_DESPACHO.find((x) => x.v === desp.estado)}
          <div class="row"><span class="tag tag--{est?.c}">{est?.t}</span><span class="mute">{desp.numero}</span></div>
          <p>{desp.direccion || 'Sin dirección'}</p>
          <p class="mute">{desp.ruta || 'Sin ruta'} · {desp.transportista || 'Sin transportista'}{desp.programado ? ' · ' + fecha(desp.programado) : ''}</p>
          <button class="btn btn--sm" onclick={() => ir('logistica/despachos')}>Ver en despachos</button>
        {:else}<p class="mute">El cliente retira en tienda.</p>{/if}
        {#if v.notas}<p class="dim">Notas: {v.notas}</p>{/if}
      </div>
    </div>
  </Pagina>
  <Cobro bind:abierto={cobrar} total_c={saldo} titulo="Registrar cobro · {v.numero}" permiteCredito textoParcial="Registrar abono" alConfirmar={(p) => cobrarPagos(p)} />
{/if}

<style>
  .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .k { display: grid; gap: 4px; align-content: start; }
  .k b { font-size: 22px; font-weight: 800; }
  .k b.warn { color: var(--warn); }
  .dos { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .cobro { padding: 8px 0; border-bottom: 1px solid var(--line); }
  .cobro.anulado { opacity: 0.5; text-decoration: line-through; }
  .r { text-align: right; }
</style>
