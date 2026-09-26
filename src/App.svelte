<script lang="ts">
  import { onMount } from 'svelte';
  import { abrir, valor } from './lib/db';
  import { app, cargarAjustes } from './lib/estado.svelte';
  import Cielo from './lib/marco/Cielo.svelte';
  import Lateral from './lib/marco/Lateral.svelte';
  import Superior from './lib/marco/Superior.svelte';
  import Avisos from './lib/marco/Avisos.svelte';
  import Bienvenida from './lib/marco/Bienvenida.svelte';
  import Vista from './Vista.svelte';
  import { iniciarLicencia } from './lib/licencia';

  let fase = $state<'cargando' | 'bienvenida' | 'lista' | 'error'>('cargando');
  onMount(async () => {
    try {
      await abrir();
      const iniciado = await valor<string>(`SELECT valor FROM ajustes WHERE clave = 'iniciado'`);
      if (!iniciado) { fase = 'bienvenida'; return; }
      await cargarAjustes();
      await iniciarLicencia();
      fase = 'lista';
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
{:else if fase === 'bienvenida'}
  <Bienvenida listo={async () => { await iniciarLicencia(); fase = 'lista'; }} />
{:else}
  <div class="marco">
    <Lateral />
    <div class="zona">
      <Superior />
      <main class="contenido"><Vista /></main>
    </div>
  </div>
{/if}
<Avisos />

<style>
  .marco { position: relative; z-index: 1; display: flex; height: 100vh; }
  .zona { flex: 1; min-width: 0; display: grid; grid-template-rows: var(--top) 1fr; }
  .contenido { overflow: auto; min-height: 0; }
  .centro { position: relative; z-index: 2; display: grid; place-items: center; height: 100vh; }
</style>
