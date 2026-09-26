<script lang="ts">
  import { q, uno } from '../../lib/db';
  import { app, avisar, fallo, refrescar } from '../../lib/estado.svelte';
  import { ir } from '../../lib/rutas.svelte';
  import { guardarOrden } from '../../lib/servicios/compras';
  import { leerNumero, leerMonto, montoEditable, ahora, num } from '../../lib/formato';
  import Pagina from '../../lib/ui/Pagina.svelte';
  import LineasDoc, { type LineaEd } from '../../lib/ui/LineasDoc.svelte';
  import Icono from '../../lib/ui/Icono.svelte';

  let { id = '' }: { id?: string } = $props();
  let proveedores = $state<any[]>([]), almacenes = $state<any[]>([]);
  let proveedor = $state(''), almacen = $state(''), factura = $state(''), dias = $state('0'), notas = $state(''), numero = $state('');
  let lineas = $state<LineaEd[]>([]), guardando = $state(false);
  $effect(() => { cargar(); });
  async function cargar() {
    proveedores = await q('SELECT id, nombre, dias_credito FROM proveedores WHERE activo = 1 ORDER BY nombre');
    almacenes = await q('SELECT id, nombre FROM almacenes WHERE activo = 1 ORDER BY principal DESC, nombre');
    almacen = app.ajustes.almacen_principal || almacenes[0]?.id || '';
    if (id) {
      const c = await uno<any>('SELECT * FROM compras WHERE id = ?', [id]);
      if (c) {
        proveedor = c.proveedor_id; almacen = c.almacen_id; factura = c.factura_proveedor || ''; notas = c.notas || ''; numero = c.numero;
        lineas = (await q(`SELECT l.*, p.unidad FROM compra_lineas l LEFT JOIN productos p ON p.id = l.producto_id WHERE compra_id = ?`, [id]))
          .map((l) => ({ producto_id: l.producto_id, descripcion: l.descripcion, unidad: l.unidad || 'und', cantidad: num(l.cantidad), precio: montoEditable(l.costo_c), descuento: '0', iva: l.impuesto_tasa }));
      }
    }
    // sugerencia: lo que está por debajo del mínimo
  }
  async function sugerir() {
    const bajos = await q(`SELECT p.id, p.nombre, p.unidad, p.costo_c, p.stock_min, COALESCE(i.tasa, 0) AS iva, COALESCE((SELECT SUM(cantidad) FROM stock s WHERE s.producto_id = p.id), 0) AS hay
                           FROM productos p LEFT JOIN impuestos i ON i.id = p.impuesto_id WHERE p.activo = 1 AND p.se_compra = 1 AND p.stock_min > 0 AND hay <= p.stock_min`);
    let n = 0;
    for (const b of bajos) if (!lineas.some((l) => l.producto_id === b.id)) {
      lineas.push({ producto_id: b.id, descripcion: b.nombre, unidad: b.unidad, cantidad: String(Math.max(1, Math.ceil(b.stock_min * 2 - b.hay))), precio: montoEditable(b.costo_c), descuento: '0', iva: b.iva }); n++;
    }
    avisar(n ? `Agregué ${n} productos por debajo del mínimo.` : 'No hay productos por debajo del mínimo.', 'info');
  }
  async function guardar(estado: 'borrador' | 'ordenada') {
    guardando = true;
    try {
      const p = proveedores.find((x) => x.id === proveedor);
      const r = await guardarOrden({
        id: id || undefined, proveedor_id: proveedor, almacen_id: almacen, factura_proveedor: factura, notas, estado,
        vence: ahora(Math.round(leerNumero(dias) || p?.dias_credito || 0)).slice(0, 10),
        lineas: lineas.map((l) => ({ producto_id: l.producto_id, descripcion: l.descripcion, cantidad: leerNumero(l.cantidad), costo_c: leerMonto(l.precio), impuesto_tasa: l.iva }))
      });
      avisar(`Orden ${r.numero} guardada.`); refrescar(); ir('compras/ordenes/' + r.id);
    } catch (e) { fallo(e); } finally { guardando = false; }
  }
</script>

<Pagina titulo={id ? `Editar orden ${numero}` : 'Nueva orden de compra'} desc="Costos en dólares sin IVA. Al recibir, el costo de cada producto se actualiza por promedio.">
  {#snippet acciones()}
    <button class="btn" onclick={() => history.back()}><Icono n="atras" />Volver</button>
    <button class="btn" onclick={sugerir}><Icono n="alerta" />Sugerir lo que falta</button>
    <button class="btn" disabled={guardando || !lineas.length} onclick={() => guardar('borrador')}>Guardar borrador</button>
    <button class="btn btn--primary" disabled={guardando || !lineas.length} onclick={() => guardar('ordenada')}><Icono n="check" />Confirmar orden</button>
  {/snippet}
  <div class="glass card grid-form cab">
    <label class="field"><span>Proveedor *</span>
      <select class="select" bind:value={proveedor} onchange={() => (dias = String(proveedores.find((x) => x.id === proveedor)?.dias_credito || 0))}>
        <option value="">Elige…</option>{#each proveedores as p}<option value={p.id}>{p.nombre}</option>{/each}
      </select></label>
    <label class="field"><span>Entra a</span><select class="select" bind:value={almacen}>{#each almacenes as a}<option value={a.id}>{a.nombre}</option>{/each}</select></label>
    <label class="field"><span>Factura del proveedor</span><input class="input" bind:value={factura} placeholder="Opcional" /></label>
    <label class="field"><span>Días de crédito</span><input class="input num" bind:value={dias} inputmode="numeric" /></label>
    <label class="field full"><span>Notas</span><input class="input" bind:value={notas} placeholder="Opcional" /></label>
  </div>
  <LineasDoc bind:lineas {almacen} modo="compra" />
</Pagina>

<style>.cab { grid-template-columns: repeat(4, minmax(0, 1fr)); }</style>
