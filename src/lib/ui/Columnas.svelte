<script lang="ts">
  /* columnas de una sola serie: barras ≤24 px con punta redondeada, rejilla
     de un pelo, tooltip al pasar. La última columna (hoy) va en el acento. */
  let { datos, f = (v: number) => String(v), alto = 200, titulo = '' }:
    { datos: { etiqueta: string; valor: number; detalle?: string }[]; f?: (v: number) => string; alto?: number; titulo?: string } = $props();
  let ancho = $state(600), sobre = $state(-1);
  const pad = { t: 12, r: 8, b: 26, l: 56 };
  const maxV = $derived(Math.max(1, ...datos.map((d) => d.valor)));
  const paso = $derived.by(() => { const e = Math.pow(10, Math.floor(Math.log10(maxV))); for (const m of [1, 2, 2.5, 5, 10]) if (m * e * 4 >= maxV) return m * e; return 10 * e; });
  const tope = $derived(Math.ceil(maxV / paso) * paso);
  const ticks = $derived(Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => i * paso));
  const iw = $derived(Math.max(10, ancho - pad.l - pad.r)), ih = $derived(alto - pad.t - pad.b);
  const banda = $derived(iw / Math.max(1, datos.length));
  const bw = $derived(Math.min(24, Math.max(4, banda - 6)));
  const y = (v: number) => pad.t + ih - (v / tope) * ih;
  function barra(i: number, v: number) {
    const x = pad.l + banda * i + (banda - bw) / 2, top = y(v), base = pad.t + ih, r = Math.min(4, bw / 2, base - top);
    if (base - top < 0.5) return '';
    return `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${base} Z`;
  }
  const cadaEtiqueta = $derived(Math.max(1, Math.ceil(datos.length / Math.max(1, Math.floor(iw / 56)))));
</script>

<div class="col" bind:clientWidth={ancho}>
  <svg width={ancho} height={alto} role="img" aria-label={titulo}>
    {#each ticks as t}
      <line x1={pad.l} x2={ancho - pad.r} y1={y(t)} y2={y(t)} class="grid" />
      <text x={pad.l - 8} y={y(t) + 4} class="eje" text-anchor="end">{f(t)}</text>
    {/each}
    {#each datos as d, i}
      <path d={barra(i, d.valor)} class="bar" class:ultima={i === datos.length - 1} class:tenue={sobre >= 0 && sobre !== i} />
      {#if i % cadaEtiqueta === 0 || i === datos.length - 1}
        <text x={pad.l + banda * i + banda / 2} y={alto - 8} class="eje" text-anchor="middle">{d.etiqueta}</text>
      {/if}
      <rect x={pad.l + banda * i} y={pad.t} width={banda} height={ih} fill="transparent" role="presentation"
        onmouseenter={() => (sobre = i)} onmouseleave={() => (sobre = -1)} />
    {/each}
  </svg>
  {#if sobre >= 0}
    {@const d = datos[sobre]}
    <div class="tip glass" style:left="{Math.min(ancho - 150, Math.max(0, pad.l + banda * sobre + banda / 2 - 75))}px" style:top="{Math.max(0, y(d.valor) - 64)}px">
      <small>{d.etiqueta}</small><b>{f(d.valor)}</b>{#if d.detalle}<small>{d.detalle}</small>{/if}
    </div>
  {/if}
  <table class="sr"><caption>{titulo}</caption><tbody>{#each datos as d}<tr><th>{d.etiqueta}</th><td>{f(d.valor)}</td></tr>{/each}</tbody></table>
</div>

<style>
  .col { position: relative; width: 100%; }
  svg { display: block; overflow: visible; }
  .grid { stroke: var(--line); stroke-width: 1; }
  .eje { fill: var(--ink-3); font-size: 11px; font-variant-numeric: tabular-nums; }
  .bar { fill: var(--info); opacity: 0.85; transition: opacity 0.15s; }
  .bar.ultima { fill: var(--rojo-2); opacity: 1; }
  .bar.tenue { opacity: 0.35; }
  rect { cursor: default; }
  .tip { position: absolute; pointer-events: none; width: 150px; display: grid; gap: 1px; padding: 8px 10px; border-radius: 10px; background: var(--glass-solid); font-size: 12px; }
  .tip b { font-size: 14px; font-variant-numeric: tabular-nums; }
  .tip small { color: var(--ink-3); }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
