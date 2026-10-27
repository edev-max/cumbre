<script lang="ts">
  import { ruta, ir } from '../rutas.svelte';
  import { buscarSub, MODULOS } from '../modulos';
  import { app, sesion } from '../estado.svelte';
  import { tasaFmt, fechaHora } from '../formato';
  import Icono from '../ui/Icono.svelte';
  const m = $derived(MODULOS.find((x) => x.id === (ruta.partes[0] || 'inicio')));
  const s = $derived(buscarSub(ruta.partes[0], ruta.partes[1]).s);
  let reloj = $state(new Date());
  $effect(() => { const t = setInterval(() => (reloj = new Date()), 30000); return () => clearInterval(t); });
  const hoy = $derived.by(() => { const t = reloj.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' }); return t.charAt(0).toUpperCase() + t.slice(1); });
</script>

<header class="sup" data-tauri-drag-region>
  <div class="migas" data-tauri-drag-region>
    <span class="dim">{m?.nombre || 'Cumbre'}</span>
    {#if s}<Icono n="derecha" size={14} /><b>{s.nombre}</b>{/if}
  </div>
  <span class="spacer" data-tauri-drag-region></span>
  <span class="fecha mute">{hoy}</span>
  <button class="tasa glass glass--flat" onclick={() => ir('config/tasas')} title={app.tasaFecha ? 'Actualizada ' + fechaHora(app.tasaFecha) : 'Sin tasa registrada'}>
    <span class="punto" class:vieja={!app.tasa}></span>
    <span class="mute">Tasa BCV</span>
    <b class="num">{app.tasa ? tasaFmt(app.tasa) : 'Registrar'}</b>
  </button>
  <div class="yo glass glass--flat" title={app.usuario.nombre}>
    <span class="av">{app.usuario.nombre.slice(0, 1)}</span>
    <span class="yo__n">{app.usuario.nombre}</span>
    {#if sesion.conClave}<button class="btn btn--ghost btn--icon btn--sm" title="Cerrar sesión" aria-label="Cerrar sesión" onclick={() => sesion.salir?.()}><Icono n="salir" size={15} /></button>{/if}
  </div>
</header>

<style>
  .sup { height: var(--top); display: flex; align-items: center; gap: 12px; padding: 0 22px 0 26px; }
  .migas { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ink-3); }
  .migas b { color: var(--ink); font-weight: 650; }
  .fecha { font-size: 12.5px; }
  .tasa { display: flex; align-items: center; gap: 8px; height: 34px; padding: 0 12px; border-radius: 11px; font-size: 12.5px; color: var(--ink); }
  .tasa b { font-weight: 700; }
  .punto { width: 7px; height: 7px; border-radius: 50%; background: var(--ok); box-shadow: 0 0 10px var(--ok); }
  .punto.vieja { background: var(--warn); box-shadow: 0 0 10px var(--warn); }
  .yo { display: flex; align-items: center; gap: 8px; height: 34px; padding: 0 12px 0 5px; border-radius: 11px; font-size: 12.5px; font-weight: 600; }
  .av { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 8px; background: var(--hover); font-weight: 800; }
  @media (max-width: 1100px) { .fecha, .yo__n { display: none; } }
</style>
