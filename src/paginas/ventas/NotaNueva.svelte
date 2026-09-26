<script lang="ts">
  import { q } from '../../lib/db';
  import { app, avisar, fallo, refrescar } from '../../lib/estado.svelte';
  import { ir } from '../../lib/rutas.svelte';
  import { crearVenta, CONTADO } from '../../lib/servicios/ventas';
  import { leerNumero, leerMonto, ahora, usd } from '../../lib/formato';
  import { totales } from '../../lib/calculos';
  import Pagina from '../../lib/ui/Pagina.svelte';
  import LineasDoc, { type LineaEd } from '../../lib/ui/LineasDoc.svelte';
  import Cobro from '../../lib/ui/Cobro.svelte';
  import Icono from '../../lib/ui/Icono.svelte';

  let clientes = $state<any[]>([]), almacenes = $state<any[]>([]), rutas = $state<any[]>([]), transportistas = $state<any[]>([]);
  let cliente = $state(''), almacen = $state(''), entrega = $state<'retira' | 'despacho'>('retira');
  let dias = $state('0'), notas = $state(''), direccion = $state(''), rutaId = $state(''), transp = $state(''), programado = $state('');
  let lineas = $state<LineaEd[]>([]), cobrar = $state(false), guardando = $state(false);
  $effect(() => { cargar(); });
  async function cargar() {
    clientes = await q(`SELECT id, nombre, rif, dias_credito, direccion FROM clientes WHERE activo = 1 AND id != 'contado' ORDER BY nombre`);
    almacenes = await q('SELECT id, nombre FROM almacenes WHERE activo = 1 ORDER BY principal DESC, nombre');
    rutas = await q('SELECT id, nombre FROM rutas WHERE activo = 1 ORDER BY nombre');
    transportistas = await q('SELECT id, nombre FROM transportistas WHERE activo = 1 ORDER BY nombre');
    almacen = app.ajustes.almacen_principal || almacenes[0]?.id || '';
  }
  function alCliente() {
    const c = clientes.find((x) => x.id === cliente);
    if (c) { dias = String(c.dias_credito || 0); direccion = c.direccion || ''; }
  }
  const lin = $derived(lineas.map((l) => ({ producto_id: l.producto_id, descripcion: l.descripcion, cantidad: leerNumero(l.cantidad), precio_c: leerMonto(l.precio), descuento: leerNumero(l.descuento), impuesto_tasa: l.iva })));
  const total = $derived(totales(lin).total_c);
  async function guardar(pagos: any[] = []) {
    if (!cliente) { avisar('Elige el cliente.', 'error'); return; }
    guardando = true;
    try {
      const r = await crearVenta({
        cliente_id: cliente, almacen_id: almacen, origen: 'nota', entrega, lineas: lin, pagos, notas,
        vence: ahora(Math.round(leerNumero(dias))).slice(0, 10),
        despacho: entrega === 'despacho' ? { direccion, ruta_id: rutaId || null, transportista_id: transp || null, programado: programado || null } : undefined
      });
      avisar(`Nota ${r.numero} registrada.`); refrescar(); ir('ventas/notas/' + r.id);
    } catch (e) { fallo(e); throw e; } finally { guardando = false; }
  }
</script>

<Pagina titulo="Nueva nota de venta" desc="Para ventas a crédito, pedidos grandes o con despacho.">
  {#snippet acciones()}
    <button class="btn" onclick={() => ir('ventas/notas')}><Icono n="atras" />Volver</button>
    <button class="btn" disabled={!lineas.length || guardando} onclick={() => guardar().catch(() => {})}>Guardar a crédito</button>
    <button class="btn btn--primary" disabled={!lineas.length || guardando} onclick={() => (cobrar = true)}><Icono n="cobro" />Cobrar y guardar</button>
  {/snippet}
  <div class="glass card grid-form cab">
    <label class="field"><span>Cliente *</span>
      <select class="select" bind:value={cliente} onchange={alCliente}><option value="">Elige…</option>{#each clientes as c}<option value={c.id}>{c.nombre}{c.rif ? ' · ' + c.rif : ''}</option>{/each}</select>
    </label>
    <label class="field"><span>Sale de</span><select class="select" bind:value={almacen}>{#each almacenes as a}<option value={a.id}>{a.nombre}</option>{/each}</select></label>
    <label class="field"><span>Días de crédito</span><input class="input num" bind:value={dias} inputmode="numeric" /></label>
    <label class="field"><span>Entrega</span>
      <select class="select" bind:value={entrega}><option value="retira">El cliente retira</option><option value="despacho">Despacho a domicilio</option></select>
    </label>
    {#if entrega === 'despacho'}
      <label class="field full"><span>Dirección de entrega</span><input class="input" bind:value={direccion} /></label>
      <label class="field"><span>Ruta</span><select class="select" bind:value={rutaId}><option value="">Sin asignar</option>{#each rutas as r}<option value={r.id}>{r.nombre}</option>{/each}</select></label>
      <label class="field"><span>Transportista</span><select class="select" bind:value={transp}><option value="">Sin asignar</option>{#each transportistas as r}<option value={r.id}>{r.nombre}</option>{/each}</select></label>
      <label class="field"><span>Fecha programada</span><input class="input" type="date" bind:value={programado} /></label>
    {/if}
    <label class="field full"><span>Notas</span><input class="input" bind:value={notas} placeholder="Opcional" /></label>
  </div>
  <LineasDoc bind:lineas {almacen} modo="venta" />
</Pagina>

<Cobro bind:abierto={cobrar} total_c={total} permiteCredito titulo="Cobrar nota" alConfirmar={(p) => guardar(p)} />

<style>
  .cab { grid-template-columns: repeat(4, minmax(0, 1fr)); }
</style>
