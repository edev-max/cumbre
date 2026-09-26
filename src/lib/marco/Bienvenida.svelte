<script lang="ts">
  import { sembrarBase, sembrarEjemplo } from '../servicios/datos';
  import { leerNumero } from '../formato';
  import { fallo, refrescar } from '../estado.svelte';
  import Marca from './Marca.svelte';
  import Icono from '../ui/Icono.svelte';
  let { listo }: { listo: () => void } = $props();
  let nombre = $state(''), rif = $state(''), telefono = $state(''), tasa = $state(''), ejemplo = $state(true);
  let trabajando = $state(false), error = $state('');
  async function empezar(e: Event) {
    e.preventDefault(); error = '';
    const t = leerNumero(tasa);
    if (!ejemplo && !nombre.trim()) { error = 'Escribe el nombre de tu negocio.'; return; }
    if (!(t > 0)) { error = 'Escribe la tasa BCV de hoy (bolívares por dólar).'; return; }
    trabajando = true;
    try {
      await sembrarBase({ nombre: nombre.trim() || 'Mi negocio', rif: rif.trim(), telefono: telefono.trim(), tasa: t });
      if (ejemplo) await sembrarEjemplo();
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
      <label class="field full"><span>Nombre del negocio</span><input class="input" bind:value={nombre} placeholder="Ej.: Bodega La Esquina" disabled={ejemplo} /></label>
      <label class="field"><span>RIF</span><input class="input" bind:value={rif} placeholder="J-00000000-0" disabled={ejemplo} /></label>
      <label class="field"><span>Teléfono</span><input class="input" bind:value={telefono} placeholder="0412-0000000" disabled={ejemplo} /></label>
      <label class="field full"><span>Tasa BCV de hoy (Bs por dólar)</span><input class="input num" inputmode="decimal" bind:value={tasa} placeholder="Ej.: 150,25" /><small>La puedes actualizar cada día en la barra de arriba.</small></label>
    </div>
    <label class="opcion glass glass--flat" class:on={ejemplo}>
      <input type="checkbox" bind:checked={ejemplo} />
      <span><b>Empezar con un negocio de ejemplo</b><small>Productos, clientes y ventas de muestra para conocer el sistema. Luego lo vacías desde Configuración → Respaldos.</small></span>
    </label>
    {#if error}<p class="bad">{error}</p>{/if}
    <button class="btn btn--primary btn--lg" type="submit" disabled={trabajando}>{trabajando ? 'Preparando…' : 'Empezar'} <Icono n="flecha" /></button>
  </form>
</div>

<style>
  .bien { position: relative; z-index: 2; display: grid; place-items: center; height: 100vh; padding: 24px; overflow: auto; }
  .caja { width: min(520px, 100%); display: grid; gap: 20px; padding: 30px; border-radius: 28px; }
  .t { display: grid; gap: 8px; }
  h1 { font-size: 30px; font-weight: 850; }
  .opcion { display: flex; gap: 12px; padding: 14px; border-radius: 16px; cursor: pointer; }
  .opcion.on { border-color: rgba(255, 106, 64, 0.5); }
  .opcion input { margin-top: 3px; accent-color: var(--rojo); width: 16px; height: 16px; flex: none; }
  .opcion span { display: grid; gap: 3px; }
  .opcion small { color: var(--ink-3); font-size: 12px; }
</style>
