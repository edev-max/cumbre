<script lang="ts">
  import { q } from '../../lib/db';
  import { app } from '../../lib/estado.svelte';
  import { ir } from '../../lib/rutas.svelte';
  import { usd, fecha, fechaHora } from '../../lib/formato';
  import Pagina from '../../lib/ui/Pagina.svelte';
  import Tabla from '../../lib/ui/Tabla.svelte';

  let recs = $state<any[]>([]), porRecibir = $state<any[]>([]);
  $effect(() => { app.version; cargar(); });
  async function cargar() {
    recs = await q(`SELECT r.*, c.numero AS orden, c.id AS compra_id, p.nombre AS proveedor, a.nombre AS almacen,
                    (SELECT COUNT(*) FROM recepcion_lineas x WHERE x.recepcion_id = r.id) AS n,
                    (SELECT COALESCE(SUM(x.cantidad * x.costo_c), 0) FROM recepcion_lineas x WHERE x.recepcion_id = r.id) AS valor_c
                    FROM recepciones r LEFT JOIN compras c ON c.id = r.compra_id LEFT JOIN proveedores p ON p.id = c.proveedor_id
                    LEFT JOIN almacenes a ON a.id = r.almacen_id ORDER BY r.fecha DESC LIMIT 300`);
    porRecibir = await q(`SELECT c.*, p.nombre AS proveedor FROM compras c LEFT JOIN proveedores p ON p.id = c.proveedor_id WHERE c.estado IN ('ordenada','parcial') ORDER BY c.fecha`);
  }
</script>

<Pagina titulo="Recepciones" desc="La mercancía que llegó. Cada recepción suma al inventario y ajusta el costo promedio.">
  {#if porRecibir.length}
    <div class="glass card stack">
      <h2>Esperando mercancía</h2>
      <div class="pend">
        {#each porRecibir as c}
          <button class="glass glass--flat item" onclick={() => ir('compras/ordenes/' + c.id)}>
            <b>{c.proveedor}</b><span class="mute">{c.numero} · {fecha(c.fecha)}</span><span class="num">{usd(c.total_c)}</span>
            <span class="tag tag--{c.estado === 'parcial' ? 'info' : 'warn'}">{c.estado === 'parcial' ? 'En parte' : 'Por recibir'}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}
  <div class="glass">
    <Tabla filas={recs} onFila={(r) => ir('compras/ordenes/' + r.compra_id)} vacio="Todavía no se ha recibido mercancía."
      cols={[
        { k: 'numero', t: 'Recepción', clase: () => 'fuerte' }, { k: 'fecha', t: 'Fecha', f: (r) => fechaHora(r.fecha) }, { k: 'orden', t: 'Orden' },
        { k: 'proveedor', t: 'Proveedor' }, { k: 'almacen', t: 'Almacén' }, { k: 'n', t: 'Productos', al: 'r' }, { k: 'valor_c', t: 'Valor', al: 'r', f: (r) => usd(r.valor_c) }
      ]} />
  </div>
</Pagina>

<style>
  .pend { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; }
  .item { display: grid; gap: 4px; padding: 14px; border-radius: 14px; text-align: left; justify-items: start; }
</style>
