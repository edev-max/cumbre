<script lang="ts">
  import { q } from '../../lib/db';
  import { app, registrarTasa, avisar, fallo } from '../../lib/estado.svelte';
  import { fechaHora, tasaFmt, leerNumero, num, usd, bs } from '../../lib/formato';
  import Pagina from '../../lib/ui/Pagina.svelte';
  import Tabla from '../../lib/ui/Tabla.svelte';
  import Icono from '../../lib/ui/Icono.svelte';

  let filas = $state<any[]>([]), nueva = $state(''), prueba = $state('10');
  $effect(() => { app.version; cargar(); });
  async function cargar() { filas = await q('SELECT * FROM tasas ORDER BY fecha DESC LIMIT 200'); }
  async function guardar(e: Event) {
    e.preventDefault();
    const v = leerNumero(nueva);
    if (!(v > 0)) { avisar('Escribe la tasa en bolívares por dólar.', 'error'); return; }
    try { await registrarTasa(v); nueva = ''; avisar('Tasa actualizada. Los precios en bolívares ya usan la nueva.'); } catch (err) { fallo(err); }
  }
</script>

<Pagina titulo="Tasa BCV" desc="Todos los precios viven en dólares; los bolívares salen de esta tasa. Cada documento guarda la tasa de su día.">
  <div class="dos">
    <form class="glass card stack" onsubmit={guardar}>
      <span class="mute">Tasa en uso</span>
      <b class="grande num">{app.tasa ? tasaFmt(app.tasa) : 'Sin registrar'}</b>
      {#if app.tasaFecha}<small class="mute">Desde {fechaHora(app.tasaFecha)}</small>{/if}
      <label class="field"><span>Nueva tasa (Bs por dólar)</span><input class="input num" bind:value={nueva} inputmode="decimal" placeholder="Ej.: 150,25" /></label>
      <button class="btn btn--primary" type="submit"><Icono n="tasa" />Actualizar tasa</button>
      <small class="mute">Próximamente: tasa automática desde el servicio de Apex.</small>
    </form>
    <div class="glass card stack">
      <h2>Calculadora</h2>
      <label class="field"><span>Dólares</span><input class="input num" bind:value={prueba} inputmode="decimal" /></label>
      <b class="num calc">{usd(Math.round(leerNumero(prueba) * 100))} = {bs(leerNumero(prueba) * app.tasa)}</b>
    </div>
  </div>
  <div class="glass">
    <Tabla filas={filas} vacio="Sin historial."
      cols={[{ k: 'fecha', t: 'Fecha', f: (t) => fechaHora(t.fecha) }, { k: 'valor', t: 'Tasa', al: 'r', f: (t) => num(t.valor) + ' Bs/$', clase: () => 'fuerte' }, { k: 'fuente', t: 'Fuente' }]} />
  </div>
</Pagina>

<style>
  .dos { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: start; }
  .grande { font-size: 34px; font-weight: 850; font-stretch: 115%; }
  .calc { font-size: 18px; }
</style>
