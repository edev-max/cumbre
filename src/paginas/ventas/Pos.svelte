<script lang="ts">
  import { q } from '../../lib/db';
  import { app, avisar, refrescar } from '../../lib/estado.svelte';
  import { crearVenta, CONTADO } from '../../lib/servicios/ventas';
  import { totales, linea as calc } from '../../lib/calculos';
  import { usd, bsDeC, num, leerNumero, ahora } from '../../lib/formato';
  import { documentoVenta } from '../../lib/imprimir';
  import BuscaProducto, { type ProductoSel } from '../../lib/ui/BuscaProducto.svelte';
  import Cobro from '../../lib/ui/Cobro.svelte';
  import Modal from '../../lib/ui/Modal.svelte';
  import Icono from '../../lib/ui/Icono.svelte';

  interface Item { p: ProductoSel; cantidad: number }
  let items = $state<Item[]>([]);
  let cliente = $state(CONTADO), clientes = $state<any[]>([]);
  let almacen = $state(''), almacenes = $state<any[]>([]);
  let cats = $state<any[]>([]), cat = $state(''), productos = $state<ProductoSel[]>([]);
  let cobrar = $state(false), hecho = $state<{ id: string; numero: string; total_c: number } | null>(null), verHecho = $state(false);
  let enfocar = $state(1);

  async function cargar() {
    almacenes = await q('SELECT id, nombre FROM almacenes WHERE activo = 1 ORDER BY principal DESC, nombre');
    if (!almacen) almacen = app.ajustes.almacen_principal || almacenes[0]?.id || '';
    clientes = await q(`SELECT id, nombre, rif FROM clientes WHERE activo = 1 ORDER BY CASE WHEN id = 'contado' THEN 0 ELSE 1 END, nombre`);
    cats = await q(`SELECT c.id, c.nombre FROM categorias c WHERE c.activo = 1 AND EXISTS (SELECT 1 FROM productos p WHERE p.categoria_id = c.id AND p.activo = 1 AND p.se_vende = 1) ORDER BY c.nombre`);
    await cargarProductos();
  }
  async function cargarProductos() {
    productos = await q(
      `SELECT p.id, p.codigo, p.barra, p.nombre, p.unidad, p.precio_c, p.costo_c, COALESCE(i.tasa, 0) AS iva,
              COALESCE((SELECT cantidad FROM stock s WHERE s.producto_id = p.id AND s.almacen_id = ?), 0) AS existencia
       FROM productos p LEFT JOIN impuestos i ON i.id = p.impuesto_id
       WHERE p.activo = 1 AND p.se_vende = 1 ${cat ? 'AND p.categoria_id = ?' : ''}
       ORDER BY p.nombre LIMIT 60`, cat ? [almacen, cat] : [almacen]) as ProductoSel[];
  }
  $effect(() => { app.version; cargar(); });

  function agregar(p: ProductoSel, n = 1) {
    const it = items.find((i) => i.p.id === p.id);
    if (it) it.cantidad = Math.round((it.cantidad + n) * 1000) / 1000;
    else items.push({ p, cantidad: n });
  }
  function cambiar(i: number, d: number) {
    items[i].cantidad = Math.round((items[i].cantidad + d) * 1000) / 1000;
    if (items[i].cantidad <= 0) items.splice(i, 1);
  }
  const lineas = $derived(items.map((i) => ({ producto_id: i.p.id, descripcion: i.p.nombre, cantidad: i.cantidad, precio_c: i.p.precio_c, impuesto_tasa: i.p.iva })));
  const t = $derived(totales(lineas));
  const nItems = $derived(items.reduce((a, i) => a + i.cantidad, 0));
  const conIva = (p: ProductoSel) => Math.round(p.precio_c * (1 + p.iva / 100));

  async function confirmarCobro(pagos: any[], credito: boolean) {
    const dias = credito ? (await q('SELECT dias_credito FROM clientes WHERE id = ?', [cliente]))[0]?.dias_credito || 0 : 0;
    const r = await crearVenta({ cliente_id: cliente, almacen_id: almacen, origen: 'pos', lineas, pagos, vence: credito ? ahora(dias).slice(0, 10) : null });
    hecho = { ...r, total_c: t.total_c }; verHecho = true;
    items = []; cliente = CONTADO; refrescar();
  }
  function tecla(e: KeyboardEvent) {
    if (e.key === 'F9' && !cobrar && items.length) { e.preventDefault(); cobrar = true; }
    else if (e.key === 'F2') { e.preventDefault(); enfocar++; }
  }
</script>

<svelte:window onkeydown={tecla} />
<div class="pos">
  <section class="izq">
    <div class="row">
      <BuscaProducto grande {almacen} alElegir={(p) => agregar(p)} bind:enfocar />
      <select class="select alm" bind:value={almacen} onchange={cargarProductos} title="Almacén">
        {#each almacenes as a}<option value={a.id}>{a.nombre}</option>{/each}
      </select>
    </div>
    <div class="cats">
      <button class="chip" class:on={!cat} onclick={() => { cat = ''; cargarProductos(); }}>Todo</button>
      {#each cats as c}<button class="chip" class:on={cat === c.id} onclick={() => { cat = c.id; cargarProductos(); }}>{c.nombre}</button>{/each}
    </div>
    <div class="grid">
      {#each productos as p (p.id)}
        <button class="prod glass" class:agotado={p.existencia <= 0} onclick={() => agregar(p)}>
          <span class="pn">{p.nombre}</span>
          <span class="pp num">{usd(conIva(p))}</span>
          <span class="pb num mute">{bsDeC(conIva(p), app.tasa)}</span>
          <span class="ps">{num(p.existencia)} {p.unidad}</span>
        </button>
      {/each}
    </div>
  </section>

  <aside class="ticket glass">
    <header class="row">
      <h2>Venta</h2><span class="spacer"></span>
      {#if items.length}<button class="btn btn--ghost btn--sm" onclick={() => (items = [])}>Vaciar</button>{/if}
    </header>
    <select class="select" bind:value={cliente} aria-label="Cliente">
      {#each clientes as c}<option value={c.id}>{c.nombre}{c.rif ? ' · ' + c.rif : ''}</option>{/each}
    </select>
    <div class="lineas">
      {#each items as it, i (it.p.id)}
        <div class="ln">
          <div class="ln__t"><b>{it.p.nombre}</b><small class="mute num">{usd(it.p.precio_c)}{it.p.iva ? ` + IVA ${it.p.iva} %` : ' · exento'}</small></div>
          <div class="ln__q">
            <button class="btn btn--sm btn--icon" onclick={() => cambiar(i, -1)} aria-label="Menos"><Icono n="menos" size={14} /></button>
            <input class="input num" value={num(it.cantidad)} onchange={(e) => { const v = leerNumero(e.currentTarget.value); if (v > 0) it.cantidad = v; else items.splice(i, 1); }} />
            <button class="btn btn--sm btn--icon" onclick={() => cambiar(i, 1)} aria-label="Más"><Icono n="mas" size={14} /></button>
          </div>
          <b class="ln__tot num">{usd(calc(lineas[i]).total_c)}</b>
        </div>
      {:else}
        <div class="vacio"><Icono n="bolsa" /><p>Busca o toca un producto.<br /><kbd>F2</kbd> buscar · <kbd>F9</kbd> cobrar</p></div>
      {/each}
    </div>
    <footer class="tot">
      <div class="row"><span class="mute">Artículos</span><span class="spacer"></span><span class="num">{num(nItems)}</span></div>
      <div class="row"><span class="mute">Subtotal</span><span class="spacer"></span><span class="num">{usd(t.subtotal_c)}</span></div>
      <div class="row"><span class="mute">IVA</span><span class="spacer"></span><span class="num">{usd(t.impuesto_c)}</span></div>
      <div class="gran"><b class="num">{usd(t.total_c)}</b><span class="num dim">{bsDeC(t.total_c, app.tasa)}</span></div>
      <button class="btn btn--primary btn--lg cobrar" disabled={!items.length || !app.tasa} onclick={() => (cobrar = true)}>
        {app.tasa ? 'Cobrar' : 'Registra la tasa BCV'} <kbd>F9</kbd>
      </button>
    </footer>
  </aside>
</div>

<Cobro bind:abierto={cobrar} total_c={t.total_c} permiteCredito={cliente !== CONTADO} alConfirmar={confirmarCobro} />

<Modal bind:abierto={verHecho} titulo="Venta registrada" ancho={400}>
  {#if hecho}
    <div class="ok-venta"><Icono n="check" size={34} /><b class="num">{usd(hecho.total_c)}</b><span class="mute">{hecho.numero}</span></div>
  {/if}
  {#snippet pie()}
    <button class="btn" onclick={() => hecho && documentoVenta(hecho.id, 'ticket')}><Icono n="imprimir" />Imprimir ticket</button>
    <button class="btn btn--primary" onclick={() => { verHecho = false; enfocar++; avisar('Lista para la próxima venta.', 'info'); }}>Nueva venta</button>
  {/snippet}
</Modal>

<style>
  .pos { display: grid; grid-template-columns: minmax(0, 1fr) 400px; gap: 16px; height: 100%; padding: 16px 22px 18px 26px; }
  .izq { display: grid; grid-template-rows: auto auto 1fr; gap: 12px; min-height: 0; }
  .alm { width: 160px; height: 50px; border-radius: 14px; }
  .cats { display: flex; gap: 6px; flex-wrap: wrap; }
  .chip { height: 32px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--line-2); background: var(--field); font-weight: 600; font-size: 12.5px; color: var(--ink-2); }
  .chip.on { background: var(--ink); color: var(--bg); border-color: transparent; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); grid-auto-rows: auto; gap: 10px; align-content: start; overflow: auto; padding: 2px 4px 8px 2px; }
  .prod { display: grid; grid-template-rows: auto auto auto auto; gap: 3px; text-align: left; padding: 14px; border-radius: 16px; min-height: 136px; height: auto; align-content: start; transition: transform 0.15s var(--ease), border-color 0.2s; }
  .prod:hover { transform: translateY(-2px); border-color: rgba(255, 106, 64, 0.45); }
  .prod:active { transform: scale(0.98); }
  .pn { font-weight: 650; line-height: 1.25; min-height: 34px; }
  .pp { font-size: 18px; font-weight: 800; font-stretch: 112%; margin-top: 4px; }
  .pb { font-size: 11.5px; }
  .ps { font-size: 11.5px; color: var(--ink-3); }
  .agotado { opacity: 0.55; }
  .agotado .ps { color: var(--bad); }
  .ticket { display: grid; grid-template-rows: auto auto 1fr auto; gap: 12px; padding: 16px; border-radius: var(--r-xl); min-height: 0; }
  .lineas { overflow: auto; display: grid; align-content: start; gap: 2px; margin: 0 -6px; }
  .ln { display: grid; grid-template-columns: 1fr auto; grid-template-rows: auto auto; gap: 6px 10px; padding: 10px 6px; border-bottom: 1px solid var(--line); }
  .ln__t { display: grid; min-width: 0; }
  .ln__t b { font-weight: 650; }
  .ln__t small { font-size: 11.5px; }
  .ln__q { display: flex; gap: 4px; align-items: center; }
  .ln__q .input { width: 64px; height: 30px; text-align: center; }
  .ln__tot { grid-column: 2; grid-row: 1 / 3; align-self: center; font-weight: 750; }
  .tot { display: grid; gap: 6px; padding-top: 10px; border-top: 1px solid var(--line); }
  .gran { display: grid; justify-items: end; margin: 6px 0 8px; }
  .gran b { font-size: 34px; font-weight: 850; font-stretch: 115%; letter-spacing: -0.02em; line-height: 1; }
  .cobrar { width: 100%; }
  .cobrar kbd { background: rgba(255,255,255,.18); border-color: rgba(255,255,255,.3); color: #fff; }
  .ok-venta { display: grid; justify-items: center; gap: 6px; padding: 8px 0; color: var(--ok); }
  .ok-venta b { font-size: 28px; color: var(--ink); font-weight: 850; }
  @media (max-width: 1100px) { .pos { grid-template-columns: minmax(0, 1fr) 340px; } }
</style>
