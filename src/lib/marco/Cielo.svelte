<script lang="ts">
  import { app } from '../estado.svelte';
  /* el fondo: cielo nocturno del Ávila con la cresta del logo; el vidrio lo refracta */
  const R = 'M-40 176 L8 176 L120 140 L190 112 L228 84 L242 94 L252 78 L268 96 L290 64 L318 86 L390 132 L470 164 L512 176 L560 176';
  let estrellas = Array.from({ length: 70 }, (_, i) => {
    const s = Math.sin(i * 12.9898) * 43758.5453, r = s - Math.floor(s);
    const s2 = Math.sin(i * 78.233) * 12345.678, r2 = s2 - Math.floor(s2);
    return { x: r * 100, y: r2 * 62, o: 0.25 + ((i * 37) % 60) / 100, s: i % 9 === 0 ? 2 : 1 };
  });
</script>

<div class="cielo" aria-hidden="true">
  {#if app.ajustes.marca_fondo}
    <!-- fondo del cliente: atenuado para que el vidrio se siga leyendo -->
    <img class="propio" src={app.ajustes.marca_fondo} alt="" />
    <div class="velo"></div>
  {:else}
  <div class="brillo brillo--a"></div>
  <div class="brillo brillo--b"></div>
  {#each estrellas as e}<i style="left:{e.x}%;top:{e.y}%;opacity:{e.o};width:{e.s}px;height:{e.s}px"></i>{/each}
  <svg viewBox="0 0 520 200" preserveAspectRatio="xMidYMax slice">
    <path class="mtn" d="{R} L560 260 L-40 260 Z" />
    <path class="cresta" d={R} />
    <path class="apex" d="M290 50 L284 60 L296 60 Z" />
  </svg>
  {/if}
</div>

<style>
  .cielo { position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; background: linear-gradient(180deg, var(--sky-a), var(--sky-b)); }
  .brillo { position: absolute; border-radius: 50%; filter: blur(60px); }
  .brillo--a { width: 60vw; height: 60vw; left: -18vw; top: -26vw; background: var(--glow-blue); }
  .brillo--b { width: 46vw; height: 46vw; right: -10vw; bottom: -18vw; background: var(--glow-red); }
  i { position: absolute; border-radius: 50%; background: #fff; }
  :global([data-theme='papel']) i { background: #0B1020; opacity: 0.12 !important; }
  svg { position: absolute; left: 0; right: 0; bottom: 0; width: 100%; height: 42vh; }
  .mtn { fill: rgba(4, 7, 16, 0.55); }
  :global([data-theme='papel']) .mtn { fill: rgba(7, 11, 23, 0.04); }
  .cresta { fill: none; stroke: var(--ridge); stroke-width: 1.2; vector-effect: non-scaling-stroke; }
  .apex { fill: var(--rojo); opacity: 0.8; }
  .propio { position: absolute; inset: -20px; width: calc(100% + 40px); height: calc(100% + 40px); object-fit: cover; filter: blur(6px) saturate(1.1); }
  .velo { position: absolute; inset: 0; background: linear-gradient(180deg, color-mix(in oklab, var(--bg) 62%, transparent), color-mix(in oklab, var(--bg) 78%, transparent)); }
</style>
