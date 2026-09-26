<script lang="ts">
  import { onMount } from 'svelte';
  import { abrir, valor } from './lib/db';
  import { app, cargarAjustes, sesion } from './lib/estado.svelte';
  import { q } from './lib/db';
  import Entrar from './lib/marco/Entrar.svelte';
  import Cielo from './lib/marco/Cielo.svelte';
  import Lateral from './lib/marco/Lateral.svelte';
  import Superior from './lib/marco/Superior.svelte';
  import Avisos from './lib/marco/Avisos.svelte';
  import Bienvenida from './lib/marco/Bienvenida.svelte';
  import Vista from './Vista.svelte';
  import { iniciarLicencia } from './lib/licencia';
  import { iniciarAutomatico } from './lib/automatico';

  let fase = $state<'cargando' | 'bienvenida' | 'entrar' | 'lista' | 'error'>('cargando');
  // si algún usuario tiene clave, se entra eligiendo usuario; si no, abre como administrador
  async function sesionInicial() {
    const conClave = (await q(`SELECT COUNT(*) AS n FROM usuarios WHERE activo = 1 AND clave IS NOT NULL AND clave != ''`))[0]?.n > 0;
    sesion.conClave = conClave;
    sesion.salir = () => { fase = 'entrar'; };
    fase = conClave ? 'entrar' : 'lista';
  }
  onMount(async () => {
    // Windows 11 trae su propio vidrio (Mica) detrás de la ventana
    const uad = (navigator as any).userAgentData;
    uad?.getHighEntropyValues?.(['platformVersion']).then((v: any) => {
      if (uad.platform === 'Windows' && parseInt(v.platformVersion) >= 13 && '__TAURI_INTERNALS__' in window) document.documentElement.classList.add('mica');
    }).catch(() => {});
    try {
      await abrir();
      const iniciado = await valor<string>(`SELECT valor FROM ajustes WHERE clave = 'iniciado'`);
      if (!iniciado) { fase = 'bienvenida'; return; }
      await cargarAjustes();
      await iniciarLicencia();
      iniciarAutomatico();
      await sesionInicial();
    } catch (e) {
      app.error = e instanceof Error ? e.message : String(e);
      fase = 'error';
    }
  });
</script>

<Cielo />
{#if fase === 'cargando'}
  <div class="centro"><p class="mute">Abriendo Cumbre…</p></div>
{:else if fase === 'error'}
  <div class="centro"><div class="glass card"><h2>No se pudo abrir la base de datos</h2><p class="dim">{app.error}</p></div></div>
{:else if fase === 'entrar'}
  <Entrar listo={() => (fase = 'lista')} />
{:else if fase === 'bienvenida'}
  <Bienvenida listo={async () => { await iniciarLicencia(); iniciarAutomatico(); fase = 'lista'; }} />
{:else}
  <div class="marco">
    <Lateral />
    <div class="zona">
      <Superior />
      {#if !app.licencia.escribir}
        <a class="bloqueo" href="#/config/licencia">La licencia no está activa: puedes consultar, pero no registrar movimientos. Actívala aquí →</a>
      {/if}
      <main class="contenido"><Vista /></main>
    </div>
  </div>
{/if}
<Avisos />

<style>
  .marco { position: relative; z-index: 1; display: flex; height: 100vh; }
  .zona { flex: 1; min-width: 0; display: grid; grid-template-rows: var(--top) auto 1fr; }
  .bloqueo { margin: 0 22px 0 26px; padding: 10px 14px; border-radius: 12px; background: color-mix(in oklab, var(--warn) 16%, transparent); border: 1px solid color-mix(in oklab, var(--warn) 40%, transparent); color: var(--warn); font-weight: 600; text-decoration: none; }
  .contenido { overflow: auto; min-height: 0; }
  .centro { position: relative; z-index: 2; display: grid; place-items: center; height: 100vh; }
</style>
