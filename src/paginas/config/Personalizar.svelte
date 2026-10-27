<script lang="ts">
  import { app, ajuste, avisar, fallo } from '../../lib/estado.svelte';
  import { ACENTOS, aplicarMarca } from '../../lib/marca';
  import { prepararImagen } from '../../lib/productos';
  import Pagina from '../../lib/ui/Pagina.svelte';
  import Marca from '../../lib/marco/Marca.svelte';
  import Icono from '../../lib/ui/Icono.svelte';

  let inLogo: HTMLInputElement, inFondo: HTMLInputElement;
  async function subir(clave: 'marca_logo' | 'marca_fondo', f?: File | null) {
    if (!f) return;
    if (!f.type.startsWith('image/')) { avisar('Ese archivo no es una imagen.', 'error'); return; }
    try {
      // el logo se guarda chico y con transparencia; el fondo, a 1920 px
      const img = await prepararImagen(f, clave === 'marca_logo' ? 360 : 1920);
      await ajuste(clave, img);
      avisar(clave === 'marca_logo' ? 'Logo actualizado.' : 'Fondo actualizado.');
    } catch (e) { fallo(e); }
  }
  async function quitar(clave: 'marca_logo' | 'marca_fondo') { await ajuste(clave, ''); }
  async function acento(id: string) { await ajuste('marca_acento', id); aplicarMarca(); }
  const actual = $derived(app.ajustes.marca_acento || 'apex');
</script>

<Pagina titulo="Personalización" desc="Haz que Cumbre se sienta tuyo: tu logo, tu fondo y tu color.">
  <div class="dos">
    <div class="glass card stack">
      <h2>Logo del negocio</h2>
      <p class="dim">Aparece en la barra lateral, en la pantalla de entrada y en los tickets y notas impresas. Mejor si es PNG con fondo transparente.</p>
      <div class="muestra glass glass--flat"><Marca /></div>
      <input bind:this={inLogo} type="file" accept="image/*" hidden onchange={(e) => { subir('marca_logo', e.currentTarget.files?.[0]); e.currentTarget.value = ''; }} />
      <div class="row">
        <button class="btn btn--primary" onclick={() => inLogo.click()}><Icono n="subir" />{app.ajustes.marca_logo ? 'Cambiar logo' : 'Subir logo'}</button>
        {#if app.ajustes.marca_logo}<button class="btn btn--ghost" onclick={() => quitar('marca_logo')}>Usar el logo de Cumbre</button>{/if}
      </div>
    </div>
    <div class="glass card stack">
      <h2>Imagen de fondo</h2>
      <p class="dim">Una foto de tu local, tus productos o un paisaje. Cumbre la oscurece y la difumina para que todo se siga leyendo.</p>
      <div class="fondo glass glass--flat">
        {#if app.ajustes.marca_fondo}<img src={app.ajustes.marca_fondo} alt="" />{:else}<span class="mute">El cielo del Ávila (predeterminado)</span>{/if}
      </div>
      <input bind:this={inFondo} type="file" accept="image/*" hidden onchange={(e) => { subir('marca_fondo', e.currentTarget.files?.[0]); e.currentTarget.value = ''; }} />
      <div class="row">
        <button class="btn btn--primary" onclick={() => inFondo.click()}><Icono n="subir" />{app.ajustes.marca_fondo ? 'Cambiar fondo' : 'Subir fondo'}</button>
        {#if app.ajustes.marca_fondo}<button class="btn btn--ghost" onclick={() => quitar('marca_fondo')}>Volver al Ávila</button>{/if}
      </div>
    </div>
  </div>
  <div class="glass card stack">
    <h2>Color de acento</h2>
    <p class="dim">El color de los botones principales, la selección y los indicadores.</p>
    <div class="acentos">
      {#each ACENTOS as a}
        <button class="ac glass glass--flat" class:on={actual === a.id} onclick={() => acento(a.id)} aria-pressed={actual === a.id}>
          <span class="bola" style:background="linear-gradient(180deg, {a.b}, {a.a})"></span>{a.nombre}
          {#if actual === a.id}<Icono n="check" size={15} />{/if}
        </button>
      {/each}
    </div>
    <div class="row"><span class="mute">Así se ve:</span><button class="btn btn--primary">Botón principal</button><span class="tag tag--info">Etiqueta</span><span class="rojo">Texto destacado</span></div>
  </div>
  <div class="glass card row">
    <span class="dim spacer">Tema de la interfaz: {app.tema === 'noche' ? 'Noche (oscuro)' : 'Papel (claro)'}</span>
    <span class="mute">Se cambia con el botón de sol/luna, abajo en la barra lateral.</span>
  </div>
</Pagina>

<style>
  .dos { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: start; }
  .dos > .card { align-content: start; }
  .muestra { display: flex; align-items: center; min-height: 76px; padding: 16px; border-radius: 16px; }
  .fondo { display: grid; place-items: center; aspect-ratio: 16 / 7; border-radius: 16px; overflow: hidden; }
  .fondo img { width: 100%; height: 100%; object-fit: cover; }
  .acentos { display: flex; flex-wrap: wrap; gap: 8px; }
  .ac { display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 14px 0 8px; border-radius: 12px; font-weight: 600; }
  .ac.on { border-color: var(--acento-2); }
  .bola { width: 24px; height: 24px; border-radius: 50%; box-shadow: inset 0 1px 0 rgba(255,255,255,.4); }
</style>
