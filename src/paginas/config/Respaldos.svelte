<script lang="ts">
  import { exportarDb, importarDb, tipoDriver, enEscritorio } from '../../lib/db';
  import { sugerirCarpetas, respaldarAhora, type CarpetaSugerida } from '../../lib/automatico';
  import { app, avisar, fallo, confirmar, cargarAjustes, refrescar, ajuste } from '../../lib/estado.svelte';
  import { borrarDatos } from '../../lib/servicios/datos';
  import { hoy, fechaHora } from '../../lib/formato';
  import Pagina from '../../lib/ui/Pagina.svelte';
  import Icono from '../../lib/ui/Icono.svelte';

  let archivo: HTMLInputElement;
  const escritorio = enEscritorio();
  let sugeridas = $state<CarpetaSugerida[]>([]), respaldando = $state(false);
  $effect(() => { if (escritorio) sugerirCarpetas().then((s) => (sugeridas = s)).catch(() => {}); });
  const drive = $derived(sugeridas.find((c) => c.nombre === 'Google Drive'));
  const actual = $derived(app.ajustes.respaldo_carpeta || '');
  const auto = $derived(app.ajustes.respaldo_auto !== '0');
  async function usarCarpeta(ruta: string) {
    await ajuste('respaldo_carpeta', ruta);
    await ahoraMismo();
  }
  async function elegirOtra() {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const r = await open({ directory: true, title: 'Carpeta para los respaldos de Cumbre' });
    if (typeof r === 'string' && r) await usarCarpeta(r);
  }
  async function ahoraMismo() {
    respaldando = true;
    try { const h = await respaldarAhora(); avisar(`Respaldo guardado: ${h.archivo} (${Math.round(h.bytes / 1024)} KB). Hay ${h.guardados} copias.`); }
    catch (e) { fallo(e); }
    finally { respaldando = false; }
  }
  async function descargar() {
    try {
      const datos = await exportarDb();
      const url = URL.createObjectURL(new Blob([datos as BlobPart], { type: 'application/x-sqlite3' }));
      const a = document.createElement('a'); a.href = url; a.download = `cumbre-respaldo-${hoy()}.db`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      avisar('Respaldo descargado. Guárdalo fuera de esta computadora (pendrive o nube).');
    } catch (e) { fallo(e); }
  }
  async function restaurar(e: Event) {
    const f = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!f) return;
    if (!(await confirmar('¿Restaurar este respaldo?', 'Todo lo que hay ahora se reemplaza por el contenido del archivo.', 'Restaurar', true))) { archivo.value = ''; return; }
    try {
      const datos = new Uint8Array(await f.arrayBuffer());
      if (new TextDecoder().decode(datos.slice(0, 15)) !== 'SQLite format 3') throw new Error('Ese archivo no es un respaldo de Cumbre.');
      await importarDb(datos); await cargarAjustes(); refrescar(); avisar('Respaldo restaurado.');
    } catch (err) { fallo(err); } finally { archivo.value = ''; }
  }
  async function vaciar(todo: boolean) {
    const t = todo ? '¿Empezar en blanco?' : '¿Borrar los movimientos?';
    const d = todo ? 'Se borran ventas, compras, inventario, productos, clientes y proveedores. Quedan la empresa, los usuarios y la configuración.' : 'Se borran ventas, compras, cobros, pagos, despachos y existencias. Quedan los productos, clientes y proveedores.';
    if (!(await confirmar(t, d + ' Descarga un respaldo antes si lo necesitas.', 'Borrar', true))) return;
    try { await borrarDatos(todo); await cargarAjustes(); refrescar(); avisar('Listo.'); } catch (e) { fallo(e); }
  }
</script>

<Pagina titulo="Respaldos" desc="Tu información vive en esta computadora. Respáldala seguido.">
  <div class="glass card stack auto">
    <div class="row"><Icono n="respaldo" size={24} /><h2>Respaldo automático</h2><span class="spacer"></span>
      {#if escritorio && actual}<label class="interruptor" title="Respaldo automático"><input type="checkbox" checked={auto} onchange={(e) => ajuste('respaldo_auto', e.currentTarget.checked ? '1' : '0')} /><span></span></label>{/if}
    </div>
    {#if !escritorio}
      <p class="dim">Disponible en la aplicación de escritorio.</p>
    {:else}
      <p class="dim">Cumbre guarda una copia al abrir y cada 12 horas mientras está abierto, y conserva las últimas 30. Si la carpeta es de <b>Google Drive</b>, la copia sube sola a tu Drive: no hay que iniciar sesión en Cumbre.</p>
      {#if actual}
        <div class="destino glass glass--flat">
          <span><small class="mute">Se guarda en</small><b>{actual}{actual.endsWith('\\') || actual.endsWith('/') ? '' : '\\'}Cumbre respaldos</b>
            <small class="mute">{app.ajustes.respaldo_ultimo ? 'Último respaldo: ' + fechaHora(app.ajustes.respaldo_ultimo) : 'Todavía sin respaldos'}</small>
            {#if app.ajustes.respaldo_error}<small class="bad">{app.ajustes.respaldo_error}</small>{/if}</span>
          <button class="btn btn--primary" onclick={ahoraMismo} disabled={respaldando}>{respaldando ? 'Guardando…' : 'Respaldar ahora'}</button>
        </div>
      {/if}
      <div class="opciones">
        {#each sugeridas as c}
          <button class="op glass glass--flat" class:on={actual === c.ruta} onclick={() => usarCarpeta(c.ruta)}>
            <b>{c.nombre}</b><small class="mute">{c.ruta}</small>{#if c.nube}<span class="tag tag--ok">Sube a la nube</span>{/if}
          </button>
        {/each}
        <button class="op glass glass--flat" onclick={elegirOtra}><b>Otra carpeta…</b><small class="mute">Un pendrive, un disco externo o una carpeta de red</small></button>
      </div>
      {#if !drive}
        <div class="guia glass glass--flat">
          <b>¿Quieres que suba a Google Drive?</b>
          <ol>
            <li>Instala <a href="https://www.google.com/drive/download/" target="_blank" rel="noopener">Google Drive para computadoras</a> (gratis) y entra con tu cuenta de Google.</li>
            <li>Vuelve a esta pantalla: aparecerá la opción <b>Google Drive</b>. Tócala y listo.</li>
          </ol>
          <small class="mute">Los respaldos quedarán en tu Drive, en la carpeta "Cumbre respaldos", y los puedes bajar desde cualquier computadora o el teléfono.</small>
        </div>
      {/if}
    {/if}
  </div>
  <div class="tres">
    <div class="glass card stack">
      <Icono n="bajar" size={26} />
      <h2>Descargar respaldo</h2>
      <p class="dim">Un solo archivo con toda la información de Cumbre.</p>
      <button class="btn btn--primary" onclick={descargar}>Descargar</button>
    </div>
    <div class="glass card stack">
      <Icono n="subir" size={26} />
      <h2>Restaurar</h2>
      <p class="dim">Vuelve a un respaldo anterior o pasa tu información a otra computadora.</p>
      <input bind:this={archivo} type="file" accept=".db,.sqlite" onchange={restaurar} hidden />
      <button class="btn" onclick={() => archivo.click()}>Elegir archivo…</button>
    </div>
    <div class="glass card stack">
      <Icono n="borrar" size={26} />
      <h2>Empezar de nuevo</h2>
      <p class="dim">{app.ajustes.datos_ejemplo === '1' ? 'Estás usando el negocio de ejemplo. Vacíalo cuando quieras cargar el tuyo.' : 'Borra movimientos o todo el catálogo.'}</p>
      <div class="row row--wrap"><button class="btn btn--danger" onclick={() => vaciar(false)}>Borrar movimientos</button><button class="btn btn--danger" onclick={() => vaciar(true)}>Empezar en blanco</button></div>
    </div>
  </div>
  <p class="mute">Base de datos: {tipoDriver() === 'escritorio' ? 'archivo cumbre.db en la carpeta de datos de Cumbre' : 'guardada en este navegador (modo demostración)'}.</p>
</Pagina>

<style>
  .tres { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .tres > div { align-content: start; }
  .destino { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-radius: 14px; }
  .destino span { flex: 1; display: grid; gap: 2px; min-width: 0; }
  .destino b { overflow-wrap: anywhere; }
  .opciones { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 8px; }
  .op { display: grid; gap: 4px; justify-items: start; padding: 12px 14px; border-radius: 14px; text-align: left; }
  .op small { overflow-wrap: anywhere; }
  .op.on { border-color: var(--acento-2); }
  .guia { display: grid; gap: 6px; padding: 14px 16px; border-radius: 14px; }
  .guia ol { margin: 0; padding-left: 20px; display: grid; gap: 4px; }
  .guia a { color: var(--acento-2); font-weight: 600; }
</style>
