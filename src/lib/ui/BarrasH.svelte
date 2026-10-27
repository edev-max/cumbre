<script lang="ts">
  /* ranking en barras horizontales: nombre, barra de una sola serie y valor */
  let { datos, f = (v: number) => String(v), vacio = 'Sin datos en este período.' }:
    { datos: { etiqueta: string; valor: number; detalle?: string }[]; f?: (v: number) => string; vacio?: string } = $props();
  const maxV = $derived(Math.max(1, ...datos.map((d) => d.valor)));
</script>

<div class="bh">
  {#each datos as d}
    <div class="fila" title={d.detalle || ''}>
      <span class="n">{d.etiqueta}</span>
      <span class="pista"><i style:width="{(d.valor / maxV) * 100}%"></i></span>
      <b class="num">{f(d.valor)}</b>
    </div>
  {:else}<p class="mute">{vacio}</p>{/each}
</div>

<style>
  .bh { display: grid; gap: 10px; }
  .fila { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) auto; align-items: center; gap: 12px; }
  .n { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 550; }
  .pista { height: 10px; border-radius: 0 4px 4px 0; }
  .pista i { display: block; height: 100%; min-width: 2px; background: var(--info); opacity: 0.85; border-radius: 0 4px 4px 0; }
  b { font-weight: 700; min-width: 76px; text-align: right; }
</style>
