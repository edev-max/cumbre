<script lang="ts">
  import { q } from '../../lib/db';
  import { app, avisar, fallo, refrescar } from '../../lib/estado.svelte';
  import { ir } from '../../lib/rutas.svelte';
  import { actualizarDespacho, ESTADOS_DESPACHO } from '../../lib/servicios/logistica';
  import { usd, fecha, fechaHora } from '../../lib/formato';
  import Pagina from '../../lib/ui/Pagina.svelte';
  import Panel from '../../lib/ui/Panel.svelte';
  import Icono from '../../lib/ui/Icono.svelte';

  let filas = $state<any[]>([]), rutas = $state<any[]>([]), transportistas = $state<any[]>([]), filtroRuta = $state('');
  let sel = $state<any>(null), abierto = $state(false), recibe = $state('');
  $effect(() => { app.version; cargar(); });
  async function cargar() {
    rutas = await q('SELECT id, nombre FROM rutas WHERE activo = 1 ORDER BY nombre');
    transportistas = await q('SELECT id, nombre, vehiculo, placa FROM transportistas WHERE activo = 1 ORDER BY nombre');
    filas = await q(`SELECT d.*, c.nombre AS cliente, c.telefono, v.numero AS venta, v.total_c, v.total_c - v.pagado_c AS saldo_c, r.nombre AS ruta, t.nombre AS transportista
                     FROM despachos d LEFT JOIN clientes c ON c.id = d.cliente_id LEFT JOIN ventas v ON v.id = d.venta_id
                     LEFT JOIN rutas r ON r.id = d.ruta_id LEFT JOIN transportistas t ON t.id = d.transportista_id
                     WHERE d.estado IN ('pendiente','en_ruta') OR d.fecha >= date('now','localtime','-15 day') ORDER BY COALESCE(d.programado, d.fecha)`);
  }
  const vista = $derived(filtroRuta ? filas.filter((d) => d.ruta_id === filtroRuta) : filas);
  const COLS = [
    { v: 'pendiente', t: 'Por despachar' }, { v: 'en_ruta', t: 'En ruta' }, { v: 'entregado', t: 'Entregados (15 días)' }
  ];
  function abrir(d: any) { sel = { ...d }; recibe = d.recibe || ''; abierto = true; }
  async function mover(d: any, estado: string, extra: any = {}) {
    try { await actualizarDespacho(d.id, { estado, ...extra }); avisar(estado === 'entregado' ? 'Entrega confirmada.' : 'Despacho actualizado.'); refrescar(); abierto = false; }
    catch (e) { fallo(e); }
  }
  async function guardarAsignacion() {
    try {
      await actualizarDespacho(sel.id, { ruta_id: sel.ruta_id || null, transportista_id: sel.transportista_id || null, programado: sel.programado || null, direccion: sel.direccion || '' });
      avisar('Despacho actualizado.'); refrescar(); abierto = false;
    } catch (e) { fallo(e); }
  }
  const est = (v: string) => ESTADOS_DESPACHO.find((x) => x.v === v);
</script>

<Pagina titulo="Despachos" desc="Entregas de las notas de venta con despacho. Asigna ruta y chofer, y confirma cuando lleguen." ancho>
  {#snippet acciones()}
    <select class="select" style="width:180px" bind:value={filtroRuta}><option value="">Todas las rutas</option>{#each rutas as r}<option value={r.id}>{r.nombre}</option>{/each}</select>
    <button class="btn" onclick={() => ir('ventas/notas/nueva')}><Icono n="mas" />Nota con despacho</button>
  {/snippet}
  <div class="tablero">
    {#each COLS as col}
      {@const items = vista.filter((d) => d.estado === col.v || (col.v === 'entregado' && d.estado === 'devuelto'))}
      <section class="colu">
        <header class="row"><h2>{col.t}</h2><span class="n">{items.length}</span></header>
        <div class="cards">
          {#each items as d (d.id)}
            <article class="glass cardd">
              <button class="cab" onclick={() => abrir(d)}>
                <div class="row"><b>{d.cliente}</b><span class="spacer"></span><span class="tag tag--{est(d.estado)?.c}">{est(d.estado)?.t}</span></div>
                <p class="dim">{d.direccion || 'Sin dirección'}</p>
                <p class="mute meta">{d.numero} · {d.venta} · {usd(d.total_c)}{d.saldo_c > 0 ? ` · cobrar ${usd(d.saldo_c)}` : ''}</p>
                <p class="mute meta"><Icono n="ruta" size={13} /> {d.ruta || 'Sin ruta'} · <Icono n="camion" size={13} /> {d.transportista || 'Sin chofer'}{d.programado ? ' · ' + fecha(d.programado) : ''}</p>
                {#if d.estado === 'entregado'}<p class="ok meta">Entregado {fechaHora(d.entregado_en)}{d.recibe ? ' · recibió ' + d.recibe : ''}</p>{/if}
              </button>
              {#if d.estado === 'pendiente'}
                <div class="acc"><button class="btn btn--sm" onclick={() => abrir(d)}>Asignar</button><button class="btn btn--sm btn--primary" onclick={() => mover(d, 'en_ruta')}>Salió <Icono n="flecha" size={14} /></button></div>
              {:else if d.estado === 'en_ruta'}
                <div class="acc"><button class="btn btn--sm btn--danger" onclick={() => mover(d, 'devuelto')}>Devuelto</button><button class="btn btn--sm btn--primary" onclick={() => abrir(d)}><Icono n="check" size={14} />Entregado</button></div>
              {/if}
            </article>
          {:else}<p class="mute vacio-col">Nada aquí.</p>{/each}
        </div>
      </section>
    {/each}
  </div>
</Pagina>

<Panel bind:abierto titulo={sel ? `Despacho ${sel.numero}` : ''} sub={sel ? `${sel.cliente}${sel.telefono ? ' · ' + sel.telefono : ''}` : ''}>
  {#if sel}
    <div class="grid-form">
      <label class="field full"><span>Dirección</span><input class="input" bind:value={sel.direccion} /></label>
      <label class="field"><span>Ruta</span><select class="select" bind:value={sel.ruta_id}><option value={null}>Sin ruta</option>{#each rutas as r}<option value={r.id}>{r.nombre}</option>{/each}</select></label>
      <label class="field"><span>Transportista</span><select class="select" bind:value={sel.transportista_id}><option value={null}>Sin asignar</option>{#each transportistas as t}<option value={t.id}>{t.nombre}{t.placa ? ' · ' + t.placa : ''}</option>{/each}</select></label>
      <label class="field"><span>Fecha programada</span><input class="input" type="date" bind:value={sel.programado} /></label>
      {#if sel.estado === 'en_ruta'}<label class="field full"><span>¿Quién recibió?</span><input class="input" bind:value={recibe} placeholder="Nombre de quien recibe" /></label>{/if}
    </div>
  {/if}
  {#snippet pie()}
    <button class="btn" onclick={() => ir('ventas/notas/' + sel?.venta_id)}>Ver nota</button>
    <span class="spacer"></span>
    <button class="btn" onclick={guardarAsignacion}>Guardar</button>
    {#if sel?.estado === 'en_ruta'}<button class="btn btn--primary" onclick={() => mover(sel, 'entregado', { recibe })}><Icono n="check" />Confirmar entrega</button>{/if}
  {/snippet}
</Panel>

<style>
  .tablero { display: grid; grid-template-columns: repeat(3, minmax(260px, 1fr)); gap: 14px; align-items: start; }
  .colu { display: grid; gap: 10px; }
  .colu header { padding: 0 4px; }
  .n { display: grid; place-items: center; min-width: 24px; height: 22px; padding: 0 7px; border-radius: 999px; background: var(--field); border: 1px solid var(--line); font-size: 12px; font-weight: 700; }
  .cards { display: grid; gap: 10px; }
  .cardd { display: grid; gap: 10px; padding: 14px; border-radius: 16px; }
  .cab { display: grid; gap: 5px; text-align: left; border: 0; background: transparent; padding: 0; }
  .meta { font-size: 12px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
  .acc { display: flex; justify-content: flex-end; gap: 6px; }
  .vacio-col { padding: 16px 4px; font-size: 13px; }
</style>
