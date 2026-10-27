<script lang="ts">
  import { q, uno, lote, uid, type Sentencia } from '../../lib/db';
  import { app, avisar, fallo, confirmar, refrescar } from '../../lib/estado.svelte';
  import { usd, bsDeC, num, pct, leerMonto, leerNumero, montoEditable, ahora } from '../../lib/formato';
  import { proximoCodigo, prepararImagen } from '../../lib/productos';
  import { ir } from '../../lib/rutas.svelte';
  import Pagina from '../../lib/ui/Pagina.svelte';
  import Tabla from '../../lib/ui/Tabla.svelte';
  import Panel from '../../lib/ui/Panel.svelte';
  import Foto from '../../lib/ui/Foto.svelte';
  import Icono from '../../lib/ui/Icono.svelte';

  const UNIDADES = [{ v: 'und', t: 'Unidad' }, { v: 'kg', t: 'Kilo' }, { v: 'g', t: 'Gramo' }, { v: 'lt', t: 'Litro' }, { v: 'ml', t: 'Mililitro' }, { v: 'm', t: 'Metro' }, { v: 'caja', t: 'Caja' }, { v: 'paq', t: 'Paquete' }];
  interface Pres { id: string; nombre: string; factor: string; barra: string; compra: boolean; venta: boolean; precio: string; nuevo?: boolean }

  let filas = $state<any[]>([]), cats = $state<any[]>([]), imps = $state<any[]>([]);
  let texto = $state(''), cat = $state(''), verInactivos = $state(false), vista = $state<'lista' | 'galeria'>('lista');
  let abierto = $state(false), esNuevo = $state(true), guardando = $state(false);
  let d = $state<Record<string, any>>({}), pres = $state<Pres[]>([]), foto = $state<string | null>(null), fotoCambio = $state(false), arrastrando = $state(false);
  let archivo: HTMLInputElement;

  $effect(() => { app.version; verInactivos; cargar(); });
  async function cargar() {
    cats = await q('SELECT id, nombre FROM categorias WHERE activo = 1 ORDER BY nombre');
    imps = await q('SELECT id, nombre, tasa FROM impuestos WHERE activo = 1 ORDER BY tasa DESC');
    filas = await q(`SELECT p.*, c.nombre AS categoria, COALESCE(i.tasa, 0) AS iva,
                       COALESCE((SELECT SUM(cantidad) FROM stock s WHERE s.producto_id = p.id), 0) AS existencia,
                       (SELECT imagen FROM producto_imagenes pi WHERE pi.producto_id = p.id) AS imagen,
                       (SELECT GROUP_CONCAT(nombre, ' · ') FROM presentaciones pr WHERE pr.producto_id = p.id AND pr.activo = 1) AS presentaciones
                     FROM productos p LEFT JOIN categorias c ON c.id = p.categoria_id LEFT JOIN impuestos i ON i.id = p.impuesto_id
                     ${verInactivos ? '' : 'WHERE p.activo = 1'} ORDER BY p.nombre`);
  }
  const lista = $derived(filas.filter((f) => {
    if (cat && f.categoria_id !== cat) return false;
    const t = texto.trim().toLowerCase();
    return !t || [f.nombre, f.codigo, f.barra, f.categoria, f.presentaciones].some((x) => String(x || '').toLowerCase().includes(t));
  }));
  const conIva = (f: any) => Math.round(f.precio_c * (1 + (f.iva || 0) / 100));

  async function abrir(f?: any) {
    esNuevo = !f; fotoCambio = false;
    if (f) {
      d = { ...f, costo: montoEditable(f.costo_c), precio: montoEditable(f.precio_c), stock_min: num(f.stock_min), inicial: '' };
      foto = f.imagen;
      pres = (await q('SELECT * FROM presentaciones WHERE producto_id = ? AND activo = 1 ORDER BY factor', [f.id]))
        .map((p) => ({ id: p.id, nombre: p.nombre, factor: num(p.factor), barra: p.barra || '', compra: !!p.compra, venta: !!p.venta, precio: p.precio_c ? montoEditable(p.precio_c) : '' }));
    } else {
      d = { nombre: '', codigo: await proximoCodigo(), barra: '', categoria_id: cats[0]?.id || '', unidad: 'und', impuesto_id: app.ajustes.impuesto_defecto || imps[0]?.id || '', costo: '0,00', precio: '0,00', stock_min: '0', se_vende: 1, se_compra: 1, activo: 1, inicial: '' };
      foto = null; pres = [];
    }
    abierto = true;
  }
  function agregarPres(nombre = '', factor = '') { pres.push({ id: uid(), nombre, factor, barra: '', compra: true, venta: false, precio: '', nuevo: true }); }

  async function cargarFoto(f?: File | Blob | null) {
    if (!f || !f.type.startsWith('image/')) { if (f) avisar('Ese archivo no es una imagen.', 'error'); return; }
    try { foto = await prepararImagen(f); fotoCambio = true; } catch (e) { fallo(e); }
  }
  function soltar(e: DragEvent) { e.preventDefault(); arrastrando = false; cargarFoto(e.dataTransfer?.files?.[0]); }
  function pegar(e: ClipboardEvent) {
    if (!abierto) return;
    const it = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
    if (it) { e.preventDefault(); cargarFoto(it.getAsFile()); }
  }

  const precioC = $derived(leerMonto(d.precio || 0)), costoC = $derived(leerMonto(d.costo || 0));
  const ivaSel = $derived(imps.find((i) => i.id === d.impuesto_id)?.tasa || 0);
  const margen = $derived(precioC ? ((precioC - costoC) / precioC) * 100 : 0);
  const und = $derived(d.unidad || 'und');

  async function guardar(e: Event) {
    e.preventDefault();
    if (!String(d.nombre || '').trim()) { avisar('Falta el nombre.', 'error'); return; }
    if (!String(d.codigo || '').trim()) d.codigo = await proximoCodigo();
    const codigo = String(d.codigo).trim();
    if (await uno(`SELECT 1 FROM productos WHERE codigo = ? AND id != COALESCE(?, '')`, [codigo, esNuevo ? null : d.id])) { avisar(`El código ${codigo} ya lo tiene otro producto.`, 'error'); return; }
    for (const p of pres) {
      if (!p.nombre.trim() || !(leerNumero(p.factor) > 0)) { avisar('Cada presentación necesita nombre y cuántas unidades trae.', 'error'); return; }
      if (!p.compra && !p.venta) { avisar(`"${p.nombre}": marca si se usa para comprar, vender o ambas.`, 'error'); return; }
    }
    guardando = true;
    try {
      const id = esNuevo ? uid() : d.id;
      const campos = {
        codigo, barra: String(d.barra || '').trim() || null, nombre: String(d.nombre).trim(), categoria_id: d.categoria_id || null, unidad: und,
        costo_c: costoC, precio_c: precioC, impuesto_id: d.impuesto_id || null, stock_min: leerNumero(d.stock_min),
        se_vende: d.se_vende ? 1 : 0, se_compra: d.se_compra ? 1 : 0
      };
      const ks = Object.keys(campos) as (keyof typeof campos)[];
      const S: Sentencia[] = [esNuevo
        ? { sql: `INSERT INTO productos (id, ${ks.join(', ')}) VALUES (?, ${ks.map(() => '?').join(', ')})`, params: [id, ...ks.map((k) => campos[k])] }
        : { sql: `UPDATE productos SET ${ks.map((k) => k + ' = ?').join(', ')} WHERE id = ?`, params: [...ks.map((k) => campos[k]), id] }];
      // presentaciones: las que ya no están se desactivan (las órdenes viejas las siguen nombrando)
      S.push({ sql: `UPDATE presentaciones SET activo = 0 WHERE producto_id = ? AND id NOT IN (${pres.map(() => '?').join(',') || "''"})`, params: [id, ...pres.map((p) => p.id)] });
      for (const p of pres) S.push({
        sql: `INSERT INTO presentaciones (id, producto_id, nombre, factor, barra, compra, venta, precio_c) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET nombre = excluded.nombre, factor = excluded.factor, barra = excluded.barra, compra = excluded.compra, venta = excluded.venta, precio_c = excluded.precio_c, activo = 1`,
        params: [p.id, id, p.nombre.trim(), leerNumero(p.factor), p.barra.trim() || null, p.compra ? 1 : 0, p.venta ? 1 : 0, p.venta ? leerMonto(p.precio || 0) : 0]
      });
      if (fotoCambio) S.push(foto
        ? { sql: `INSERT INTO producto_imagenes (producto_id, imagen, actualizado) VALUES (?, ?, datetime('now','localtime')) ON CONFLICT(producto_id) DO UPDATE SET imagen = excluded.imagen, actualizado = excluded.actualizado`, params: [id, foto] }
        : { sql: 'DELETE FROM producto_imagenes WHERE producto_id = ?', params: [id] });
      const inicial = leerNumero(d.inicial || 0);
      if (esNuevo && inicial > 0) {
        const alm = app.ajustes.almacen_principal || 'principal';
        S.push({ sql: 'INSERT INTO stock (producto_id, almacen_id, cantidad) VALUES (?, ?, ?)', params: [id, alm, inicial] });
        S.push({ sql: `INSERT INTO movimientos (id, fecha, tipo, producto_id, almacen_id, cantidad, costo_c, nota, usuario) VALUES (?, ?, 'inicial', ?, ?, ?, ?, 'Existencia inicial', ?)`, params: [uid(), ahora(), id, alm, inicial, costoC, app.usuario.nombre] });
      }
      await lote(S);
      avisar(esNuevo ? `Producto ${codigo} creado.` : 'Cambios guardados.');
      abierto = false; refrescar();
    } catch (err) { fallo(err); } finally { guardando = false; }
  }
  async function alternarActivo() {
    const activar = !d.activo;
    if (!activar && !(await confirmar('¿Desactivar el producto?', 'Deja de aparecer en caja y en las listas; su historia se conserva.', 'Desactivar', true))) return;
    try { await lote([{ sql: 'UPDATE productos SET activo = ? WHERE id = ?', params: [activar ? 1 : 0, d.id] }]); abierto = false; refrescar(); } catch (e) { fallo(e); }
  }
</script>

<svelte:window onpaste={pegar} />
<Pagina titulo="Productos" desc="Precios en dólares sin IVA. La unidad base es la de venta; las presentaciones dicen cuánto trae cada caja, bulto o paquete.">
  {#snippet acciones()}
    <input class="input" style="width:220px" placeholder="Buscar nombre, código o barra…" bind:value={texto} />
    <select class="select" style="width:170px" bind:value={cat}><option value="">Todas las categorías</option>{#each cats as c}<option value={c.id}>{c.nombre}</option>{/each}</select>
    <label class="check mute"><input type="checkbox" bind:checked={verInactivos} /> Inactivos</label>
    <div class="tabs">
      <button class:on={vista === 'lista'} onclick={() => (vista = 'lista')}>Lista</button>
      <button class:on={vista === 'galeria'} onclick={() => (vista = 'galeria')}>Galería</button>
    </div>
    <button class="btn btn--primary" onclick={() => abrir()}><Icono n="mas" />Nuevo</button>
  {/snippet}

  {#if vista === 'lista'}
    <div class="glass">
      <Tabla filas={lista} onFila={(f) => abrir(f)} vacio={texto ? 'Nada coincide con la búsqueda.' : 'Todavía no hay productos. Crea el primero con "Nuevo".'}
        cols={[
          { k: 'imagen', t: '', w: '56px' }, { k: 'codigo', t: 'Código', w: '90px' }, { k: 'nombre', t: 'Producto' },
          { k: 'categoria', t: 'Categoría' }, { k: 'costo_c', t: 'Costo', al: 'r', f: (r) => usd(r.costo_c), clase: () => 'mute' },
          { k: 'precio_c', t: 'Precio', al: 'r', f: (r) => usd(r.precio_c) }, { k: 'pvp', t: 'Con IVA', al: 'r', f: (r) => usd(conIva(r)), clase: () => 'fuerte' },
          { k: 'margen', t: 'Margen', al: 'r', f: (r) => (r.precio_c ? pct(((r.precio_c - r.costo_c) / r.precio_c) * 100) : '—') },
          { k: 'existencia', t: 'Existencia', al: 'r', f: (r) => num(r.existencia) + ' ' + r.unidad, clase: (r) => (r.existencia <= r.stock_min ? 'warn fuerte' : '') }
        ]}>
        {#snippet celda(r, c)}
          {#if c.k === 'imagen'}<Foto src={r.imagen} nombre={r.nombre} size={36} radio={9} />
          {:else if c.k === 'nombre'}<b class:mute={!r.activo}>{r.nombre}</b>{#if r.presentaciones}<br /><small class="mute">{r.presentaciones}</small>{/if}
          {:else}{c.f ? c.f(r) : r[c.k] ?? ''}{/if}
        {/snippet}
      </Tabla>
    </div>
  {:else}
    <div class="galeria">
      {#each lista as r (r.id)}
        <button class="g glass" onclick={() => abrir(r)} class:inactivo={!r.activo}>
          <Foto src={r.imagen} nombre={r.nombre} size="100%" radio={14} />
          <span class="g__c mute">{r.codigo}</span>
          <b class="g__n">{r.nombre}</b>
          <span class="row"><b class="num">{usd(conIva(r))}</b><span class="spacer"></span><small class="mute num">{num(r.existencia)} {r.unidad}</small></span>
        </button>
      {:else}<div class="glass vacio"><p>Nada coincide.</p></div>{/each}
    </div>
  {/if}
</Pagina>

<Panel bind:abierto titulo={esNuevo ? 'Nuevo producto' : d.nombre} sub={esNuevo ? '' : d.codigo} ancho={680}>
  <form id="f-prod" class="stack" onsubmit={guardar}>
    <div class="cab">
      <div class="drop" class:arr={arrastrando} role="button" tabindex="0" aria-label="Foto del producto"
        ondragover={(e) => { e.preventDefault(); arrastrando = true; }} ondragleave={() => (arrastrando = false)} ondrop={soltar}
        onclick={() => archivo.click()} onkeydown={(e) => e.key === 'Enter' && archivo.click()}>
        <Foto src={foto} nombre={d.nombre || '?'} size={132} radio={18} />
        <span class="drop__t">{foto ? 'Cambiar foto' : 'Subir foto'}</span>
      </div>
      <input bind:this={archivo} type="file" accept="image/*" hidden onchange={(e) => { cargarFoto(e.currentTarget.files?.[0]); e.currentTarget.value = ''; }} />
      <div class="grid-form cab__f">
        <label class="field full"><span>Nombre *</span><input class="input" bind:value={d.nombre} placeholder="Ej.: Harina de maíz precocida 1 kg" /></label>
        <label class="field"><span>Código *</span><input class="input" bind:value={d.codigo} /></label>
        <label class="field"><span>Código de barras</span><input class="input" bind:value={d.barra} placeholder="Escanéalo aquí" /></label>
        <small class="mute full">Arrastra una foto, pégala con Ctrl+V o toca el recuadro.{#if foto} <button type="button" class="lnk" onclick={() => { foto = null; fotoCambio = true; }}>Quitar foto</button>{/if}</small>
      </div>
    </div>

    <div class="grid-form tres">
      <label class="field"><span>Categoría</span><select class="select" bind:value={d.categoria_id}>{#each cats as c}<option value={c.id}>{c.nombre}</option>{/each}</select></label>
      <label class="field"><span>Unidad de venta</span><select class="select" bind:value={d.unidad}>{#each UNIDADES as u}<option value={u.v}>{u.t}</option>{/each}</select></label>
      <label class="field"><span>Impuesto</span><select class="select" bind:value={d.impuesto_id}>{#each imps as i}<option value={i.id}>{i.nombre} ({i.tasa} %)</option>{/each}</select></label>
      <label class="field"><span>Costo por {und} ($)</span><input class="input num" bind:value={d.costo} inputmode="decimal" /></label>
      <label class="field"><span>Precio por {und} ($, sin IVA)</span><input class="input num" bind:value={d.precio} inputmode="decimal" /></label>
      <label class="field"><span>Existencia mínima</span><input class="input num" bind:value={d.stock_min} inputmode="decimal" /></label>
    </div>
    <div class="resumen glass glass--flat">
      <span><small class="mute">Precio con IVA</small><b class="num">{usd(Math.round(precioC * (1 + ivaSel / 100)))}</b></span>
      <span><small class="mute">En bolívares</small><b class="num">{bsDeC(Math.round(precioC * (1 + ivaSel / 100)), app.tasa)}</b></span>
      <span><small class="mute">Margen</small><b class="num" class:bad={margen < 0}>{pct(margen)}</b></span>
    </div>
    <div class="row">
      <label class="check"><input type="checkbox" bind:checked={d.se_vende} /> Se vende</label>
      <label class="check"><input type="checkbox" bind:checked={d.se_compra} /> Se compra</label>
      {#if esNuevo}<span class="spacer"></span><label class="field ini"><span>Existencia inicial ({und})</span><input class="input num" bind:value={d.inicial} inputmode="decimal" placeholder="0" /></label>{/if}
    </div>

    <section class="pres">
      <div class="row"><h3>Presentaciones</h3><span class="spacer"></span>
        <button type="button" class="btn btn--sm" onclick={() => agregarPres('Caja x 12', '12')}>+ Caja</button>
        <button type="button" class="btn btn--sm" onclick={() => agregarPres('Bulto', '')}>+ Bulto</button>
        <button type="button" class="btn btn--sm" onclick={() => agregarPres('Paquete', '')}>+ Paquete</button>
        <button type="button" class="btn btn--sm" onclick={() => agregarPres()}><Icono n="mas" size={14} />Otra</button>
      </div>
      <p class="mute ayuda">Cómo te lo vende el proveedor, o cómo lo vendes al mayor. Ej.: <b>Caja x 24</b> trae <b>24 {und}</b>. Al recibir una compra, Cumbre convierte cantidades y costos a {und}.</p>
      {#each pres as p, i (p.id)}
        <div class="pfila">
          <label class="field"><span>Nombre</span><input class="input" bind:value={p.nombre} placeholder="Caja x 24" /></label>
          <label class="field"><span>Trae ({und})</span><input class="input num" bind:value={p.factor} inputmode="decimal" placeholder="24" /></label>
          <label class="field"><span>Código de barras</span><input class="input" bind:value={p.barra} /></label>
          <div class="usos"><label class="check"><input type="checkbox" bind:checked={p.compra} /> Compra</label><label class="check"><input type="checkbox" bind:checked={p.venta} /> Venta</label></div>
          {#if p.venta}
            <label class="field"><span>Precio ($, sin IVA)</span><input class="input num" bind:value={p.precio} inputmode="decimal" placeholder={montoEditable(Math.round(precioC * leerNumero(p.factor)))} /></label>
          {:else}<span></span>{/if}
          <button type="button" class="btn btn--ghost btn--icon btn--sm" onclick={() => pres.splice(i, 1)} aria-label="Quitar"><Icono n="x" size={14} /></button>
        </div>
      {:else}<p class="mute vacia">Sin presentaciones: se compra y se vende por {und}.</p>{/each}
    </section>
  </form>
  {#snippet pie()}
    {#if !esNuevo}
      <button class="btn btn--ghost" class:btn--danger={d.activo} onclick={alternarActivo}>{d.activo ? 'Desactivar' : 'Activar'}</button>
      <button class="btn btn--ghost" onclick={() => { abierto = false; ir('inventario/kardex?p=' + d.id); }}>Kardex</button>
      <span class="spacer"></span>
    {/if}
    <button class="btn" onclick={() => (abierto = false)}>Cancelar</button>
    <button class="btn btn--primary" form="f-prod" type="submit" disabled={guardando}><Icono n="check" />Guardar</button>
  {/snippet}
</Panel>

<style>
  .galeria { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; }
  .g { display: grid; gap: 6px; padding: 10px 10px 12px; border-radius: 18px; text-align: left; transition: transform 0.15s var(--ease); }
  .g:hover { transform: translateY(-2px); }
  .g.inactivo { opacity: 0.5; }
  .g__c { font-size: 11px; margin-top: 2px; }
  .g__n { font-weight: 650; line-height: 1.25; min-height: 34px; }
  .cab { display: grid; grid-template-columns: 132px 1fr; gap: 18px; align-items: start; }
  .cab__f { align-content: start; }
  .drop { position: relative; display: grid; border-radius: 18px; cursor: pointer; outline-offset: 3px; }
  .drop__t { position: absolute; left: 8px; right: 8px; bottom: 8px; padding: 5px 0; border-radius: 9px; text-align: center; font-size: 11.5px; font-weight: 650;
    background: rgba(7, 11, 23, 0.55); color: #fff; backdrop-filter: blur(8px); opacity: 0; transition: opacity 0.2s; }
  .drop:hover .drop__t, .drop.arr .drop__t, .drop:focus-visible .drop__t { opacity: 1; }
  .drop.arr { outline: 2px dashed var(--acento-2); }
  .tres { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .resumen { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 12px 14px; border-radius: 14px; }
  .resumen span { display: grid; gap: 2px; }
  .resumen b { font-size: 16px; font-weight: 800; }
  .ini { width: 170px; }
  .pres { display: grid; gap: 10px; padding-top: 14px; border-top: 1px solid var(--line); }
  .ayuda { font-size: 12.5px; }
  .pfila { display: grid; grid-template-columns: 1.3fr 0.8fr 1.1fr auto 1fr 30px; gap: 8px; align-items: end; padding: 10px; border-radius: 14px; background: var(--field); border: 1px solid var(--line); }
  .usos { display: grid; gap: 4px; padding-bottom: 4px; font-size: 12.5px; }
  .vacia { font-size: 12.5px; }
  .lnk { border: 0; background: none; padding: 0; color: var(--acento-2); font-weight: 600; font-size: inherit; cursor: pointer; }
</style>
