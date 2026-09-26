<script lang="ts">
  import { q } from '../db';
  import { app } from '../estado.svelte';
  import { ir } from '../rutas.svelte';
  import { primeraRuta } from '../modulos';
  import Marca from './Marca.svelte';
  import Icono from '../ui/Icono.svelte';
  let { listo }: { listo: () => void } = $props();
  let usuarios = $state<any[]>([]), usuario = $state(''), clave = $state(''), error = $state('');
  $effect(() => { q('SELECT id, nombre, usuario, rol, clave FROM usuarios WHERE activo = 1 ORDER BY nombre').then((u) => { usuarios = u; usuario = u[0]?.id || ''; }); });
  async function hash(t: string) {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('cumbre:' + t));
    return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  async function entrar(e: Event) {
    e.preventDefault(); error = '';
    const u = usuarios.find((x) => x.id === usuario);
    if (!u) return;
    if (u.clave && u.clave !== (await hash(clave))) { error = 'Clave incorrecta.'; clave = ''; return; }
    app.usuario = { id: u.id, nombre: u.nombre, rol: u.rol };
    ir(primeraRuta(u.rol)); listo();
  }
</script>

<div class="entrar">
  <form class="caja glass" onsubmit={entrar}>
    <Marca />
    <h1>{app.ajustes.empresa_nombre || 'Cumbre'}</h1>
    <div class="usuarios">
      {#each usuarios as u}
        <button type="button" class="u glass glass--flat" class:on={usuario === u.id} onclick={() => { usuario = u.id; clave = ''; error = ''; }}>
          <span class="av">{u.nombre.slice(0, 1)}</span><b>{u.nombre}</b>
        </button>
      {/each}
    </div>
    {#if usuarios.find((x) => x.id === usuario)?.clave}
      <label class="field"><span>Clave</span><input class="input" type="password" inputmode="numeric" bind:value={clave} autocomplete="off" /></label>
    {/if}
    {#if error}<p class="bad">{error}</p>{/if}
    <button class="btn btn--primary btn--lg" type="submit">Entrar <Icono n="flecha" /></button>
  </form>
</div>

<style>
  .entrar { position: relative; z-index: 2; display: grid; place-items: center; height: 100vh; padding: 24px; }
  .caja { width: min(440px, 100%); display: grid; gap: 18px; padding: 28px; border-radius: 28px; }
  h1 { font-size: 24px; }
  .usuarios { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
  .u { display: grid; justify-items: center; gap: 6px; padding: 14px 8px; border-radius: 16px; }
  .u.on { border-color: rgba(var(--acento-2-rgb), 0.6); }
  .av { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 12px; background: var(--hover); font-weight: 800; font-size: 16px; }
</style>
