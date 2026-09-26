<script lang="ts">
  import { q } from '../../lib/db';
  import { app } from '../../lib/estado.svelte';
  import { ir } from '../../lib/rutas.svelte';
  import { usd, num, entero } from '../../lib/formato';
  import Pagina from '../../lib/ui/Pagina.svelte';
  import Tabla from '../../lib/ui/Tabla.svelte';

  let almacenes = $state<any[]>([]), filas = $state<any[]>([]), almacen = $state(''), filtro = $state('todo'), texto = $state('');
  $effect(() => { app.version; almacen; cargar(); });
  async function cargar() {
    almacenes = await q('SELECT id, nombre FROM almacenes WHERE activo = 1 ORDER BY principal DESC, nombre');
    filas = await q(`SELECT p.id, p.codigo, p.nombre, p.unidad, p.costo_c, p.precio_c, p.stock_min, c.nombre AS categoria,
                     COALESCE((SELECT SUM(cantidad) FROM stock s WHERE s.producto_id = p.id ${almacen ? 'AND s.almacen_id = ?' : ''}), 0) AS hay
                     FROM productos p LEFT JOIN categorias c ON c.id = p.categoria_id WHERE p.activo = 1 ORDER BY p.nombre`, almacen ? [almacen] : []);
  }
  const vista = $derived(filas.filter((f) => {
    if (filtro === 'bajo' && !(f.stock_min > 0 && f.hay <= f.stock_min)) return false;
    if (filtro === 'agotado' && f.hay > 0) return false;
    const t = texto.trim().toLowerCase();
    return !t || f.nombre.toLowerCase().includes(t) || String(f.codigo || '').toLowerCase().includes(t) || String(f.categoria || '').toLowerCase().includes(t);
  }));
  const tot = $derived(filas.reduce((a, f) => ({ costo: a.costo + Math.max(0, f.hay) * f.costo_c, venta: a.venta + Math.max(0, f.hay) * f.precio_c, bajos: a.bajos + (f.stock_min > 0 && f.hay <= f.stock_min ? 1 : 0), agotados: a.agotados + (f.hay <= 0 ? 1 : 0) }), { costo: 0, venta: 0, bajos: 0, agotados: 0 }));
</script>

<Pagina titulo="Existencias" desc="Cuánto hay de cada producto y qué toca reponer.">
  {#snippet acciones()}
    <input class="input" style="width:220px" placeholder="Buscar…" bind:value={texto} />
    <select class="select" style="width:160px" bind:value={almacen}><option value="">Todos los almacenes</option>{#each almacenes as a}<option value={a.id}>{a.nombre}</option>{/each}</select>
    <select class="select" style="width:160px" bind:value={filtro}><option value="todo">Todo</option><option value="bajo">Bajo el mínimo</option><option value="agotado">Agotados</option></select>
    <button class="btn btn--primary" onclick={() => ir('compras/ordenes/nueva')}>Pedir mercancía</button>
  {/snippet}
  <div class="kpis">
    <div class="glass kpi"><span>Valor al costo</span><b>{usd(tot.costo)}</b></div>
    <div class="glass kpi"><span>Valor a precio de venta</span><b>{usd(tot.venta)}</b><small>Sin IVA</small></div>
    <div class="glass kpi"><span>Bajo el mínimo</span><b class:warn={tot.bajos}>{entero(tot.bajos)}</b></div>
    <div class="glass kpi"><span>Agotados</span><b class:bad={tot.agotados}>{entero(tot.agotados)}</b></div>
  </div>
  <div class="glass">
    <Tabla filas={vista} onFila={(f) => ir('inventario/kardex?p=' + f.id)} vacio="Nada con ese filtro."
      cols={[
        { k: 'codigo', t: 'Código', w: '90px' }, { k: 'nombre', t: 'Producto', clase: () => 'fuerte' }, { k: 'categoria', t: 'Categoría' },
        { k: 'hay', t: 'Existencia', al: 'r', f: (f) => num(f.hay) + ' ' + f.unidad, clase: (f) => (f.hay <= 0 ? 'bad fuerte' : f.stock_min > 0 && f.hay <= f.stock_min ? 'warn fuerte' : 'fuerte') },
        { k: 'stock_min', t: 'Mínimo', al: 'r', f: (f) => (f.stock_min ? num(f.stock_min) : '—'), clase: () => 'mute' },
        { k: 'costo_c', t: 'Costo', al: 'r', f: (f) => usd(f.costo_c), clase: () => 'mute' },
        { k: 'valor', t: 'Valor', al: 'r', f: (f) => usd(Math.max(0, f.hay) * f.costo_c) }
      ]} />
  </div>
</Pagina>

<style>
  .kpi b.warn { color: var(--warn); } .kpi b.bad { color: var(--bad); }
</style>
