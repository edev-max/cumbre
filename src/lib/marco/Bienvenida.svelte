<script lang="ts">
  import { sembrarBase } from '../servicios/datos';
  import { leerNumero } from '../formato';
  import { fallo, refrescar } from '../estado.svelte';
  import Marca from './Marca.svelte';
  import Icono from '../ui/Icono.svelte';
  import { enEscritorio } from '../db';
  let trayendo = $state(false);
  async function traerBcv() {
    trayendo = true; error = '';
    try { const { invoke } = await import('@tauri-apps/api/core'); const t = await invoke<{ valor: number }>('tasa_bcv'); tasa = t.valor.toFixed(2).replace('.', ','); }
    catch (e) { error = String(e); } finally { trayendo = false; }
  }
  let { listo }: { listo: () => void } = $props();
  let nombre = $state(''), rif = $state(''), telefono = $state(''), tasa = $state('');
  let trabajando = $state(false), error = $state('');
  async function empezar(e: Event) {
    e.preventDefault(); error = '';
    const t = leerNumero(tasa);
    if (!nombre.trim()) { error = 'Escribe el nombre de tu negocio.'; return; }
    if (!(t > 0)) { error = 'Escribe la tasa BCV de hoy (bolívares por dólar).'; return; }
    trabajando = true;
    try {
      await sembrarBase({ nombre: nombre.trim(), rif: rif.trim(), telefono: telefono.trim(), tasa: t });
      refrescar(); listo();
    } catch (err) { fallo(err); trabajando = false; }
  }
</script>

<div class="bien">
  <form class="caja glass" onsubmit={empezar}>
    <Marca />
    <div class="t">
      <h1>Bienvenido a Cumbre</h1>
      <p class="dim">Ventas, compras, inventario y despachos de tu negocio, en esta computadora. Tres datos y empezamos.</p>
    </div>
    <div class="grid-form">
      <label class="field full"><span>Nombre del negocio</span><input class="input" bind:value={nombre} placeholder="Ej.: Bodega La Esquina" /></label>
      <label class="field"><span>RIF</span><input class="input" bind:value={rif} placeholder="J-00000000-0" /></label>
      <label class="field"><span>Teléfono</span><input class="input" bind:value={telefono} placeholder="0412-0000000" /></label>
      <label class="field full"><span>Tasa BCV de hoy (Bs por dólar)</span><div class="row"><input class="input num" inputmode="decimal" bind:value={tasa} placeholder="Ej.: 150,25" />{#if enEscritorio()}<button type="button" class="btn" onclick={traerBcv} disabled={trayendo}>{trayendo ? 'Consultando…' : 'Traer del BCV'}</button>{/if}</div><small>{enEscritorio() ? 'Luego Cumbre la actualiza sola desde el BCV.' : 'La puedes actualizar cada día en la barra de arriba.'}</small></label>
    </div>
    {#if error}<p class="bad">{error}</p>{/if}
    <button class="btn btn--primary btn--lg" type="submit" disabled={trabajando}>{trabajando ? 'Preparando…' : 'Empezar'} <Icono n="flecha" /></button>
  </form>
</div>

<style>
  .bien { position: relative; z-index: 2; display: grid; place-items: center; height: 100vh; padding: 24px; overflow: auto; }
  .caja { width: min(520px, 100%); display: grid; gap: 20px; padding: 30px; border-radius: 28px; }
  .t { display: grid; gap: 8px; }
  h1 { font-size: 30px; font-weight: 850; }
</style>
