<script lang="ts">
  import { q } from '../../lib/db';
  import { app, avisar, fallo, refrescar } from '../../lib/estado.svelte';
  import { ajustar, trasladar } from '../../lib/servicios/inventario';
  import { num, fechaHora, leerNumero, usd } from '../../lib/formato';
  import Pagina from '../../lib/ui/Pagina.svelte';
  import Tabla from '../../lib/ui/Tabla.svelte';
  import Panel from '../../lib/ui/Panel.svelte';
  import BuscaProducto from '../../lib/ui/BuscaProducto.svelte';
  import Icono from '../../lib/ui/Icono.svelte';

  const TIPOS: Record<string, string> = { inicial: 'Inicial', venta: 'Venta', compra: 'Compra', ajuste: 'Ajuste', traslado: 'Traslado', anulacion: 'Anulación', devolucion: 'Devolución' };
  let movs = $state<any[]>([]), almacenes = $state<any[]>([]), filtro = $state('');
  let abierto = $state(false), modo = $state<'entrada' | 'salida' | 'conteo' | 'traslado'>('salida');
  let almacen = $state(''), destino = $state(''), motivo = $state(''), lineas = $state<{ id: string; nombre: string; unidad: string; hay: number; cant: string }[]>([]);
  $effect(() => { app.version; cargar(); });
  async function cargar() {
    almacenes = await q('SELECT id, nombre FROM almacenes WHERE activo = 1 ORDER BY principal DESC, nombre');
    movs = await q(`SELECT m.*, p.nombre AS producto, p.unidad, a.nombre AS almacen FROM movimientos m JOIN productos p ON p.id = m.producto_id
                    LEFT JOIN almacenes a ON a.id = m.almacen_id ORDER BY m.fecha DESC LIMIT 400`);
  }
  const vista = $derived(filtro ? movs.filter((m) => m.tipo === filtro) : movs);
  const MOTIVOS = { entrada: ['Sobrante', 'Devolución de cliente', 'Producción', 'Otro'], salida: ['Merma o daño', 'Vencido', 'Consumo interno', 'Robo o pérdida', 'Otro'], conteo: ['Conteo físico'], traslado: ['Reposición de tienda', 'Otro'] };
  function abrir(m: typeof modo) {
    modo = m; almacen = almacenes[0]?.id || ''; destino = almacenes[1]?.id || ''; motivo = MOTIVOS[m][0]; lineas = []; abierto = true;
  }
  async function agregar(p: any) {
    if (lineas.some((l) => l.id === p.id)) return;
    const hay = (await q('SELECT COALESCE(SUM(cantidad), 0) AS h FROM stock WHERE producto_id = ? AND almacen_id = ?', [p.id, almacen]))[0].h;
    lineas.push({ id: p.id, nombre: p.nombre, unidad: p.unidad, hay, cant: modo === 'conteo' ? num(hay) : '1' });
  }
  async function guardar() {
    try {
      let nro = '';
      if (modo === 'traslado') nro = await trasladar(almacen, destino, lineas.map((l) => ({ producto_id: l.id, cantidad: leerNumero(l.cant) })), motivo);
      else {
        const signo = modo === 'salida' ? -1 : 1;
        const ls = lineas.map((l) => ({ producto_id: l.id, cantidad: modo === 'conteo' ? leerNumero(l.cant) - l.hay : signo * Math.abs(leerNumero(l.cant)) }));
        nro = await ajustar(almacen, ls, motivo);
      }
      abierto = false; avisar(`${nro} registrado.`); refrescar();
    } catch (e) { fallo(e); }
  }
  const TITULOS = { entrada: 'Entrada de mercancía', salida: 'Salida de mercancía', conteo: 'Conteo físico', traslado: 'Traslado entre almacenes' };
</script>

<Pagina titulo="Ajustes y traslados" desc="Todo lo que mueve el inventario fuera de ventas y compras.">
  {#snippet acciones()}
    <select class="select" style="width:160px" bind:value={filtro}><option value="">Todos los tipos</option>{#each Object.entries(TIPOS) as [k, t]}<option value={k}>{t}</option>{/each}</select>
    <button class="btn" onclick={() => abrir('conteo')}><Icono n="kardex" />Conteo físico</button>
    <button class="btn" onclick={() => abrir('traslado')} disabled={almacenes.length < 2} title={almacenes.length < 2 ? 'Necesitas dos almacenes' : ''}><Icono n="mover" />Traslado</button>
    <button class="btn" onclick={() => abrir('entrada')}><Icono n="bajar" />Entrada</button>
    <button class="btn btn--primary" onclick={() => abrir('salida')}><Icono n="subir" />Salida</button>
  {/snippet}
  <div class="glass">
    <Tabla filas={vista} vacio="Sin movimientos."
      cols={[
        { k: 'fecha', t: 'Fecha', f: (m) => fechaHora(m.fecha) }, { k: 'tipo', t: 'Tipo', f: (m) => TIPOS[m.tipo] || m.tipo }, { k: 'ref_numero', t: 'Documento', f: (m) => m.ref_numero || '—' },
        { k: 'producto', t: 'Producto', clase: () => 'fuerte' }, { k: 'almacen', t: 'Almacén' },
        { k: 'cantidad', t: 'Cantidad', al: 'r', f: (m) => (m.cantidad > 0 ? '+' : '') + num(m.cantidad) + ' ' + m.unidad, clase: (m) => (m.cantidad > 0 ? 'ok fuerte' : 'bad fuerte') },
        { k: 'nota', t: 'Nota', f: (m) => m.nota || '', clase: () => 'mute' }, { k: 'usuario', t: 'Usuario', clase: () => 'mute' }
      ]} />
  </div>
</Pagina>

<Panel bind:abierto titulo={TITULOS[modo]} sub={modo === 'conteo' ? 'Escribe lo que contaste; Cumbre ajusta la diferencia.' : ''} ancho={620}>
  <div class="stack">
    <div class="grid-form">
      <label class="field"><span>{modo === 'traslado' ? 'Sale de' : 'Almacén'}</span><select class="select" bind:value={almacen} onchange={() => (lineas = [])}>{#each almacenes as a}<option value={a.id}>{a.nombre}</option>{/each}</select></label>
      {#if modo === 'traslado'}<label class="field"><span>Entra a</span><select class="select" bind:value={destino}>{#each almacenes as a}<option value={a.id}>{a.nombre}</option>{/each}</select></label>
      {:else}<label class="field"><span>Motivo</span><select class="select" bind:value={motivo}>{#each MOTIVOS[modo] as m}<option>{m}</option>{/each}</select></label>{/if}
    </div>
    <BuscaProducto {almacen} alElegir={agregar} placeholder="Agregar producto…" />
    {#each lineas as l, i}
      <div class="ln">
        <span><b>{l.nombre}</b><br /><small class="mute">Hay {num(l.hay)} {l.unidad}</small></span>
        <label class="field"><span>{modo === 'conteo' ? 'Contado' : 'Cantidad'}</span><input class="input num" bind:value={l.cant} inputmode="decimal" /></label>
        {#if modo === 'conteo'}{@const d = leerNumero(l.cant) - l.hay}<span class="num dif" class:ok={d > 0} class:bad={d < 0}>{d > 0 ? '+' : ''}{num(d)}</span>{/if}
        <button class="btn btn--ghost btn--icon btn--sm" onclick={() => lineas.splice(i, 1)} aria-label="Quitar"><Icono n="x" size={14} /></button>
      </div>
    {/each}
  </div>
  {#snippet pie()}
    <button class="btn" onclick={() => (abierto = false)}>Cancelar</button>
    <button class="btn btn--primary" disabled={!lineas.length} onclick={guardar}><Icono n="check" />Registrar</button>
  {/snippet}
</Panel>

<style>
  .ln { display: grid; grid-template-columns: 1fr 120px 70px 30px; gap: 10px; align-items: end; padding-bottom: 10px; border-bottom: 1px solid var(--line); }
  .dif { padding-bottom: 10px; text-align: right; font-weight: 700; }
</style>
