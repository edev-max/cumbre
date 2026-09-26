<script lang="ts">
  import { MODULOS } from '../modulos';
  import { ruta, ir } from '../rutas.svelte';
  import { app, cambiarTema } from '../estado.svelte';
  import Icono from '../ui/Icono.svelte';
  import Marca from './Marca.svelte';

  const modActual = $derived(ruta.partes[0] || 'inicio');
  const subActual = $derived(ruta.partes[1] || '');
  let abiertos = $state<Record<string, boolean>>({});
  // acordeón: al cambiar de módulo sólo queda abierto el actual
  $effect(() => { abiertos = { [modActual]: true }; });
  function clicMod(m: (typeof MODULOS)[number]) {
    if (!m.subs.length) { ir(m.id); return; }
    if (modActual !== m.id) { abiertos[m.id] = true; ir(`${m.id}/${m.subs[0].id}`); }
    else abiertos[m.id] = !abiertos[m.id];
  }
</script>

<nav class="lat glass" aria-label="Módulos">
  <div class="lat__marca" data-tauri-drag-region><Marca /></div>
  <div class="lat__lista">
    {#each MODULOS as m}
      <div class="mod" class:activo={modActual === m.id}>
        <button class="mod__b" onclick={() => clicMod(m)} aria-expanded={m.subs.length ? !!abiertos[m.id] : undefined}>
          <span class="mod__i"><Icono n={m.icono} /></span>
          <span class="mod__t">{m.nombre}</span>
          {#if m.subs.length}<span class="mod__f" class:gira={abiertos[m.id]}><Icono n="abajo" size={14} /></span>{/if}
        </button>
        {#if m.subs.length && abiertos[m.id]}
          <div class="subs">
            {#each m.subs as s}
              <a class="sub" class:activo={modActual === m.id && subActual === s.id} href="#/{m.id}/{s.id}">{s.nombre}</a>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>
  <div class="lat__pie">
    <a class="lic" href="#/config/licencia" class:demo={app.licencia.estado !== 'activa'}>
      <Icono n="licencia" size={15} />
      <span>{app.licencia.estado === 'activa' ? 'Licencia activa' : 'Modo demostración'}</span>
    </a>
    <button class="btn btn--ghost btn--icon btn--sm" onclick={cambiarTema} title="Cambiar a tema {app.tema === 'noche' ? 'papel' : 'noche'}" aria-label="Cambiar tema">
      <Icono n={app.tema === 'noche' ? 'sol' : 'tema'} size={16} />
    </button>
  </div>
</nav>

<style>
  .lat { position: relative; z-index: 2; display: grid; grid-template-rows: auto 1fr auto; width: var(--sidebar); margin: 10px 0 10px 10px; border-radius: var(--r-xl); overflow: hidden; }
  .lat__marca { padding: 18px 18px 14px; }
  .lat__lista { overflow: auto; padding: 4px 10px 10px; display: grid; align-content: start; gap: 2px; }
  .mod__b {
    width: 100%; display: flex; align-items: center; gap: 10px; height: 38px; padding: 0 10px; border: 0; border-radius: 11px;
    background: transparent; color: var(--ink-2); font-weight: 600; text-align: left; transition: background var(--t), color var(--t);
  }
  .mod__b:hover { background: var(--hover); color: var(--ink); }
  .mod.activo > .mod__b { color: var(--ink); background: var(--hover); }
  .mod__i { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 8px; }
  .mod.activo .mod__i { background: linear-gradient(180deg, #FF5A2E, #E8380D); color: #fff; box-shadow: 0 6px 14px -6px rgba(232, 56, 13, 0.9), inset 0 1px 0 rgba(255,255,255,.35); }
  .mod__t { flex: 1; }
  .mod__f { color: var(--ink-3); transition: transform var(--t); display: grid; }
  .mod__f.gira { transform: rotate(180deg); }
  .subs { display: grid; gap: 1px; padding: 4px 0 8px 46px; position: relative; }
  .subs::before { content: ''; position: absolute; left: 22px; top: 4px; bottom: 10px; width: 1px; background: var(--line-2); }
  .sub { display: block; padding: 7px 10px; border-radius: 9px; color: var(--ink-3); text-decoration: none; font-size: 13px; font-weight: 550; position: relative; }
  .sub:hover { color: var(--ink); background: var(--hover); }
  .sub.activo { color: var(--ink); background: var(--hover); }
  .sub.activo::before { content: ''; position: absolute; left: -27px; top: 50%; width: 9px; height: 9px; margin-top: -4.5px; background: var(--rojo); clip-path: polygon(50% 0, 100% 100%, 0 100%); }
  .lat__pie { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-top: 1px solid var(--line); }
  .lic { flex: 1; display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: var(--ok); text-decoration: none; }
  .lic.demo { color: var(--warn); }
</style>
