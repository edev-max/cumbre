<script lang="ts">
  import { exportarDb, importarDb, tipoDriver } from '../../lib/db';
  import { app, avisar, fallo, confirmar, cargarAjustes, refrescar } from '../../lib/estado.svelte';
  import { borrarDatos } from '../../lib/servicios/datos';
  import { hoy } from '../../lib/formato';
  import Pagina from '../../lib/ui/Pagina.svelte';
  import Icono from '../../lib/ui/Icono.svelte';

  let archivo: HTMLInputElement;
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
</style>
