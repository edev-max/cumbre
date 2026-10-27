<script lang="ts">
  import { q } from '../../lib/db';
  import { app, registrarTasa, avisar, fallo, ajuste } from '../../lib/estado.svelte';
  import { enEscritorio } from '../../lib/db';
  import { actualizarTasaBcv } from '../../lib/automatico';
  import { fechaHora, fecha, tasaFmt, leerNumero, num, usd, bs } from '../../lib/formato';
  import Pagina from '../../lib/ui/Pagina.svelte';
  import Tabla from '../../lib/ui/Tabla.svelte';
  import Icono from '../../lib/ui/Icono.svelte';

  let filas = $state<any[]>([]), nueva = $state(''), prueba = $state('10'), consultando = $state(false);
  const escritorio = enEscritorio();
  const auto = $derived(app.ajustes.tasa_auto !== '0');
  async function traer() {
    consultando = true;
    try { const t = await actualizarTasaBcv(); avisar(`${t.fuente === 'dolarapi' ? 'Tasa oficial (vía DolarAPI)' : 'BCV'}: ${num(t.valor)} Bs/$${t.fecha ? ' (rige desde ' + fecha(t.fecha) + ')' : ''}.`); }
    catch (e) { await ajuste('tasa_auto_error', String(e)).catch(() => {}); fallo(e); }
    finally { consultando = false; }
  }
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
    </form>
    <div class="glass card stack">
      <div class="row"><h2>Tasa automática del BCV</h2><span class="spacer"></span>
        {#if escritorio}<label class="interruptor"><input type="checkbox" checked={auto} onchange={(e) => ajuste('tasa_auto', e.currentTarget.checked ? '1' : '0')} /><span></span></label>{/if}
      </div>
      {#if escritorio}
        <p class="dim">{auto ? 'Cumbre consulta la página del BCV al abrir y cada 3 horas. Si el BCV ya publicó la del día siguiente, la guarda y la empieza a usar en su fecha valor.' : 'Apagada: la tasa se escribe a mano.'}</p>
        {#if app.ajustes.tasa_auto_ultima}<small class="mute">Última consulta: {fechaHora(app.ajustes.tasa_auto_ultima)}</small>{/if}
        {#if app.ajustes.tasa_auto_error}<small class="bad">{app.ajustes.tasa_auto_error}</small>{/if}
        <button class="btn" onclick={traer} disabled={consultando}><Icono n="tasa" />{consultando ? 'Consultando…' : 'Traer del BCV ahora'}</button>
      {:else}
        <p class="dim">Disponible en la aplicación de escritorio. En el navegador la tasa se escribe a mano.</p>
      {/if}
    </div>
    <div class="glass card stack calc-card">
      <h2>Calculadora</h2>
      <label class="field"><span>Dólares</span><input class="input num" bind:value={prueba} inputmode="decimal" /></label>
      <b class="num calc">{usd(Math.round(leerNumero(prueba) * 100))} = {bs(leerNumero(prueba) * app.tasa)}</b>
    </div>
  </div>
  <div class="glass">
    <Tabla filas={filas} vacio="Sin historial."
      cols={[{ k: 'fecha', t: 'Rige desde', f: (t) => fechaHora(t.fecha) }, { k: 'valor', t: 'Tasa', al: 'r', f: (t) => num(t.valor) + ' Bs/$', clase: () => 'fuerte' }, { k: 'fuente', t: 'Fuente', f: (t) => (t.fuente === 'bcv' ? 'BCV (automática)' : t.fuente === 'dolarapi' ? 'BCV vía DolarAPI (automática)' : 'Manual') }]} />
  </div>
</Pagina>

<style>
  .dos { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: start; }
  .calc-card { grid-column: 1 / -1; }
  .grande { font-size: 34px; font-weight: 850; font-stretch: 115%; }
  .calc { font-size: 18px; }
</style>
