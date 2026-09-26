<script lang="ts">
  import { q, uno, lote } from '../../lib/db';
  import { app, avisar, fallo, confirmar, refrescar } from '../../lib/estado.svelte';
  import { ir } from '../../lib/rutas.svelte';
  import { recibir, registrarPago, anularOrden, ESTADOS_COMPRA as ESTADOS } from '../../lib/servicios/compras';
  import { usd, bsDeC, num, fecha, fechaHora, leerNumero, leerMonto, montoEditable } from '../../lib/formato';
  import Pagina from '../../lib/ui/Pagina.svelte';
  import Panel from '../../lib/ui/Panel.svelte';
  import Cobro from '../../lib/ui/Cobro.svelte';
  import Icono from '../../lib/ui/Icono.svelte';

  let { id }: { id: string } = $props();
  let c = $state<any>(null), lineas = $state<any[]>([]), recs = $state<any[]>([]), pagos = $state<any[]>([]);
  let verRecibir = $state(false), rec = $state<{ id: string; desc: string; falta: number; cant: string; costo: string; unidad: string; factor: number; base: string }[]>([]), notaRec = $state('');
  let pagar = $state(false);
  $effect(() => { app.version; cargar(); });
  async function cargar() {
    c = await uno(`SELECT c.*, p.nombre AS proveedor, p.rif, a.nombre AS almacen FROM compras c LEFT JOIN proveedores p ON p.id = c.proveedor_id LEFT JOIN almacenes a ON a.id = c.almacen_id WHERE c.id = ?`, [id]);
    lineas = await q(`SELECT l.*, p.unidad FROM compra_lineas l LEFT JOIN productos p ON p.id = l.producto_id WHERE l.compra_id = ?`, [id]);
    recs = await q(`SELECT r.*, (SELECT COUNT(*) FROM recepcion_lineas x WHERE x.recepcion_id = r.id) AS n FROM recepciones r WHERE r.compra_id = ? ORDER BY r.fecha`, [id]);
    pagos = await q(`SELECT p.*, m.nombre AS metodo FROM pagos p LEFT JOIN metodos_pago m ON m.id = p.metodo_id WHERE p.compra_id = ? ORDER BY p.fecha`, [id]);
  }
  const saldo = $derived(c ? Math.max(0, c.total_c - c.pagado_c) : 0);
  const abierta = $derived(c && ['ordenada', 'parcial'].includes(c.estado));
  function abrirRecibir() {
    rec = lineas.filter((l) => l.cantidad > l.recibido).map((l) => ({ id: l.id, desc: l.descripcion, falta: l.cantidad - l.recibido, cant: num(l.cantidad - l.recibido), costo: montoEditable(l.costo_c), unidad: l.presentacion || l.unidad || 'und', factor: l.factor || 1, base: l.unidad || 'und' }));
    notaRec = ''; verRecibir = true;
  }
  async function confirmarRecibir() {
    try {
      const r = await recibir(id, rec.map((x) => ({ compra_linea_id: x.id, cantidad: leerNumero(x.cant), costo_c: leerMonto(x.costo) })), undefined, notaRec);
      verRecibir = false; avisar(`Recepción ${r.numero}: la mercancía ya está en el inventario.`); refrescar();
    } catch (e) { fallo(e); }
  }
  async function confirmarOrden() {
    try { await lote([{ sql: `UPDATE compras SET estado = 'ordenada' WHERE id = ? AND estado = 'borrador'`, params: [id] }]); avisar('Orden confirmada.'); refrescar(); } catch (e) { fallo(e); }
  }
  async function anular() {
    if (!(await confirmar(`¿Anular ${c.numero}?`, 'La orden queda anulada. No se puede deshacer.', 'Anular orden', true))) return;
    try { await anularOrden(id); avisar('Orden anulada.'); refrescar(); } catch (e) { fallo(e); }
  }
  async function pagarOrden(ps: any[]) {
    for (const p of ps) await registrarPago({ proveedor_id: c.proveedor_id, compra_id: id, ...p });
    avisar('Pago registrado.'); refrescar();
  }
</script>

{#if c}
  <Pagina titulo="Orden {c.numero}" desc="{fechaHora(c.fecha)} · {c.proveedor} · entra a {c.almacen}{c.factura_proveedor ? ' · factura ' + c.factura_proveedor : ''}">
    {#snippet acciones()}
      <button class="btn" onclick={() => ir('compras/ordenes')}><Icono n="atras" />Volver</button>
      {#if ['borrador', 'ordenada'].includes(c.estado)}
        <button class="btn btn--danger" onclick={anular}>Anular</button>
        <button class="btn" onclick={() => ir(`compras/ordenes/${id}/editar`)}><Icono n="editar" />Editar</button>
      {/if}
      {#if c.estado === 'borrador'}<button class="btn btn--primary" onclick={confirmarOrden}><Icono n="check" />Confirmar orden</button>{/if}
      {#if abierta}<button class="btn btn--primary" onclick={abrirRecibir}><Icono n="recibir" />Recibir mercancía</button>{/if}
      {#if c.estado !== 'borrador' && c.estado !== 'anulada' && saldo > 0}<button class="btn" onclick={() => (pagar = true)}><Icono n="pagar" />Registrar pago</button>{/if}
    {/snippet}
    <div class="kpis">
      <div class="glass kpi"><span>Total</span><b>{usd(c.total_c)}</b><small>{bsDeC(c.total_c, app.tasa)}</small></div>
      <div class="glass kpi"><span>Pagado</span><b>{usd(c.pagado_c)}</b></div>
      <div class="glass kpi"><span>Por pagar</span><b class:warn={saldo > 0}>{usd(saldo)}</b>{#if c.vence && saldo > 0}<small>Vence {fecha(c.vence)}</small>{/if}</div>
      <div class="glass kpi"><span>Estado</span><span class="tag tag--{ESTADOS[c.estado]?.[1]}">{ESTADOS[c.estado]?.[0]}</span></div>
    </div>
    <div class="glass">
      <table class="tabla">
        <thead><tr><th>Producto</th><th class="r">Pedido</th><th class="r">Recibido</th><th class="r">Costo</th><th class="r">IVA</th><th class="r">Total</th></tr></thead>
        <tbody>
          {#each lineas as l}
            <tr><td><b>{l.descripcion}</b>{#if l.presentacion}<br /><small class="mute">{l.presentacion} · {num(l.cantidad * l.factor)} {l.unidad} en total</small>{/if}</td><td class="r">{num(l.cantidad)} {l.presentacion || l.unidad}</td>
              <td class="r" class:ok={l.recibido >= l.cantidad} class:warn={l.recibido > 0 && l.recibido < l.cantidad}>{num(l.recibido)}</td>
              <td class="r">{usd(l.costo_c)}</td><td class="r mute">{l.impuesto_tasa ? l.impuesto_tasa + ' %' : 'E'}</td><td class="r fuerte">{usd(l.total_c)}</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
    <div class="dos">
      <div class="glass card stack"><h2>Recepciones</h2>
        {#each recs as r}<div class="row fila"><b>{r.numero}</b><span class="mute">{fechaHora(r.fecha)} · {r.n} productos</span></div>{:else}<p class="mute">Todavía no ha llegado nada.</p>{/each}
      </div>
      <div class="glass card stack"><h2>Pagos</h2>
        {#each pagos as p}<div class="row fila"><span class="spacer"><b>{p.metodo}</b><br /><small class="mute">{fechaHora(p.fecha)}{p.referencia ? ' · ref. ' + p.referencia : ''}</small></span><b class="num">{p.moneda === 'VES' ? 'Bs ' + num(p.monto) : usd(p.monto_c)}</b></div>{:else}<p class="mute">Sin pagos.</p>{/each}
      </div>
    </div>
  </Pagina>

  <Panel bind:abierto={verRecibir} titulo="Recibir mercancía" sub="Escribe lo que llegó. Si el costo cambió, corrígelo aquí." ancho={640}>
    <div class="stack">
      {#each rec as r}
        <div class="rec">
          <span><b>{r.desc}</b><br /><small class="mute">Faltan {num(r.falta)} {r.unidad}{r.factor !== 1 ? ` · entran ${num(leerNumero(r.cant) * r.factor)} ${r.base} a ${usd(Math.round(leerMonto(r.costo) / r.factor))} c/u` : ''}</small></span>
          <label class="field"><span>Llegó</span><input class="input num" bind:value={r.cant} inputmode="decimal" /></label>
          <label class="field"><span>Costo $ c/u</span><input class="input num" bind:value={r.costo} inputmode="decimal" /></label>
        </div>
      {/each}
      <label class="field"><span>Notas</span><input class="input" bind:value={notaRec} placeholder="Opcional: guía, chofer…" /></label>
    </div>
    {#snippet pie()}
      <button class="btn" onclick={() => (verRecibir = false)}>Cancelar</button>
      <button class="btn btn--primary" onclick={confirmarRecibir}><Icono n="check" />Recibir</button>
    {/snippet}
  </Panel>
  <Cobro bind:abierto={pagar} total_c={saldo} titulo="Pagar a {c.proveedor}" permiteCredito textoParcial="Registrar abono" alConfirmar={pagarOrden} />
{/if}

<style>
  .dos { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .fila { padding: 8px 0; border-bottom: 1px solid var(--line); }
  .kpi b.warn { color: var(--warn); }
  .rec { display: grid; grid-template-columns: 1fr 110px 110px; gap: 10px; align-items: end; padding-bottom: 12px; border-bottom: 1px solid var(--line); }
</style>
