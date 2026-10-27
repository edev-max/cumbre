<script lang="ts">
  /* la foto del producto; sin foto, sus iniciales sobre un vidrio tenue */
  let { src = null, nombre = '', size = 40, radio = 10 }: { src?: string | null; nombre?: string; size?: number | string; radio?: number } = $props();
  const iniciales = $derived(nombre.replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter((w) => w.length > 2 || /\d/.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || nombre.slice(0, 1).toUpperCase());
  const tono = $derived([...nombre].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7));
</script>

<span class="foto" style:width={typeof size === 'number' ? size + 'px' : size} style:border-radius="{radio}px" style:--h={tono}>
  {#if src}<img {src} alt="" loading="lazy" decoding="async" />{:else}<b style:font-size="calc({typeof size === 'number' ? size + 'px' : '120px'} * 0.34)">{iniciales}</b>{/if}
</span>

<style>
  .foto { position: relative; display: grid; place-items: center; flex: none; aspect-ratio: 1; overflow: hidden;
    background: linear-gradient(145deg, hsl(var(--h) 45% 55% / 0.22), hsl(calc(var(--h) + 40) 50% 40% / 0.12)), var(--field);
    border: 1px solid var(--line); box-shadow: inset 0 1px 0 var(--glass-hi); }
  img { width: 100%; height: 100%; object-fit: cover; display: block; }
  b { font-weight: 850; font-stretch: 120%; color: var(--ink-2); letter-spacing: 0.02em; line-height: 1; }
</style>
