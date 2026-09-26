<script lang="ts">
  let { compacto = false }: { compacto?: boolean } = $props();
</script>
<div class="marca" class:compacto>
  <svg viewBox="0 0 520 200" aria-hidden="true">
    <path d="M8 176 L120 140 L190 112 L228 84 L242 94 L252 78 L268 96 L290 64 L318 86 L390 132 L470 164 L512 176" />
    <path class="a" d="M290 50 L284 60 L296 60 Z" />
  </svg>
  {#if !compacto}<div class="t"><b>Cumbre</b><small>by Apex Consulting</small></div>{/if}
</div>
<style>
  .marca { display: flex; align-items: center; gap: 10px; }
  svg { width: 46px; height: 18px; flex: none; }
  path { fill: none; stroke: var(--ink); stroke-width: 16; stroke-linecap: round; stroke-linejoin: round; }
  .a { fill: var(--rojo); stroke: none; }
  .t { display: grid; line-height: 1.05; }
  b { font-size: 17px; font-weight: 850; font-stretch: 125%; letter-spacing: -0.02em; }
  small { font-size: 10.5px; color: var(--ink-3); font-weight: 550; letter-spacing: 0.01em; }
</style>
