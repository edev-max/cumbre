<script lang="ts">
  import { estadoLicencia, activarLicencia, type InfoLicencia } from '../../lib/licencia';
  import { avisar, fallo } from '../../lib/estado.svelte';
  import { fecha } from '../../lib/formato';
  import Pagina from '../../lib/ui/Pagina.svelte';
  import Icono from '../../lib/ui/Icono.svelte';

  let info = $state<InfoLicencia | null>(null), texto = $state(''), trabajando = $state(false);
  $effect(() => { estadoLicencia().then((i) => (info = i)); });
  const ESTADO: Record<string, [string, string]> = { activa: ['Activa', 'ok'], demo: ['Demostración', 'warn'], vencida: ['Vencida', 'bad'], invalida: ['Inválida', 'bad'] };
  async function activar() {
    trabajando = true;
    try { info = await activarLicencia(texto); texto = ''; avisar('¡Cumbre activado!'); } catch (e) { fallo(e); } finally { trabajando = false; }
  }
  function copiar() { if (info?.equipo) navigator.clipboard?.writeText(info.equipo).then(() => avisar('Código copiado.', 'info')); }
</script>

<Pagina titulo="Licencia" desc="Cumbre se activa por equipo. Envía tu código de equipo a Apex Consulting y te devolvemos tu licencia.">
  {#if info}
    <div class="dos">
      <div class="glass card stack">
        <span class="mute">Estado</span>
        <span class="tag tag--{ESTADO[info.estado]?.[1]}">{ESTADO[info.estado]?.[0]}</span>
        {#if info.cliente}<p><b>{info.cliente}</b>{info.rif ? ' · ' + info.rif : ''}</p>{/if}
        {#if info.plan}<p class="dim">Plan {info.plan}</p>{/if}
        {#if info.vence}<p class="dim">Vence el {fecha(info.vence)}</p>{/if}
        {#if info.estado === 'demo'}<p class="dim">En modo demostración puedes usar todo, pero la información es de prueba.</p>{/if}
      </div>
      <div class="glass card stack">
        <span class="mute">Código de este equipo</span>
        <div class="row"><code class="codigo">{info.equipo}</code><button class="btn btn--sm" onclick={copiar}>Copiar</button></div>
        <a class="btn" href="https://wa.me/edwin.dev21?text={encodeURIComponent('Hola, quiero activar Cumbre. Mi código de equipo es: ' + info.equipo)}" target="_blank" rel="noopener"><Icono n="flecha" />Pedir licencia por WhatsApp</a>
      </div>
    </div>
    <div class="glass card stack">
      <h2>Activar</h2>
      <label class="field"><span>Pega aquí la licencia que te enviamos</span><textarea class="textarea" rows="4" bind:value={texto} placeholder="CUMBRE-…"></textarea></label>
      <div class="row"><span class="spacer"></span><button class="btn btn--primary" disabled={!texto.trim() || trabajando} onclick={activar}><Icono n="licencia" />Activar</button></div>
    </div>
  {/if}
</Pagina>

<style>
  .dos { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .codigo { font: 700 15px ui-monospace, 'Cascadia Mono', monospace; letter-spacing: 0.06em; padding: 8px 12px; border-radius: 10px; background: var(--field); border: 1px solid var(--line); }
</style>
