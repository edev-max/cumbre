<script lang="ts">
  import { q } from '../../lib/db';
  import { app } from '../../lib/estado.svelte';
  import { ruta, ir } from '../../lib/rutas.svelte';
  import { usd, fecha } from '../../lib/formato';
  import Pagina from '../../lib/ui/Pagina.svelte';
  import Tabla from '../../lib/ui/Tabla.svelte';
  import Icono from '../../lib/ui/Icono.svelte';
  import OrdenEditar from './OrdenEditar.svelte';
  import OrdenDetalle from './OrdenDetalle.svelte';

  import { ESTADOS_COMPRA as ESTADOS } from '../../lib/servicios/compras';
  let filas = $state<any[]>([]), texto = $state(''), filtro = $state('abiertas');
  $effect(() => { app.version; cargar(); });
  async function cargar() {
    filas = await q(`SELECT c.*, p.nombre AS proveedor FROM compras c LEFT JOIN proveedores p ON p.id = c.proveedor_id ORDER BY c.fecha DESC LIMIT 500`);
  }
  const vista = $derived(filas.filter((c) => {
    if (filtro === 'abiertas' && !['borrador', 'ordenada', 'parcial'].includes(c.estado)) return false;
    if (filtro === 'recibidas' && c.estado !== 'recibida') return false;
    const t = texto.trim().toLowerCase();
    return !t || c.numero.toLowerCase().includes(t) || String(c.proveedor || '').toLowerCase().includes(t) || String(c.factura_proveedor || '').toLowerCase().includes(t);
  }));
  const sub = $derived(ruta.partes[2] || ''), accion = $derived(ruta.partes[3] || '');
</script>

{#if sub === 'nueva' || accion === 'editar'}
  <OrdenEditar id={sub === 'nueva' ? '' : sub} />
{:else if sub}
  <OrdenDetalle id={sub} />
{:else}
  <Pagina titulo="Órdenes de compra" desc="Pide a tus proveedores y recibe la mercancía cuando llegue.">
    {#snippet acciones()}
      <input class="input" style="width:230px" placeholder="Buscar número, proveedor o factura…" bind:value={texto} />
      <select class="select" style="width:150px" bind:value={filtro}><option value="abiertas">Abiertas</option><option value="recibidas">Recibidas</option><option value="todas">Todas</option></select>
      <button class="btn btn--primary" onclick={() => ir('compras/ordenes/nueva')}><Icono n="mas" />Nueva orden</button>
    {/snippet}
    <div class="glass">
      <Tabla filas={vista} onFila={(c) => ir('compras/ordenes/' + c.id)} vacio="No hay órdenes con ese filtro."
        cols={[
          { k: 'numero', t: 'Número', clase: () => 'fuerte' }, { k: 'fecha', t: 'Fecha', f: (c) => fecha(c.fecha) }, { k: 'proveedor', t: 'Proveedor' },
          { k: 'factura_proveedor', t: 'Factura', f: (c) => c.factura_proveedor || '—' }, { k: 'total_c', t: 'Total', al: 'r', f: (c) => usd(c.total_c) },
          { k: 'saldo', t: 'Por pagar', al: 'r', f: (c) => (c.estado === 'anulada' || c.estado === 'borrador' ? '—' : usd(c.total_c - c.pagado_c)) }, { k: 'estado', t: 'Estado' }
        ]}>
        {#snippet celda(c, col)}
          {#if col.k === 'estado'}<span class="tag tag--{ESTADOS[c.estado]?.[1]}">{ESTADOS[c.estado]?.[0]}</span>{:else}{col.f ? col.f(c) : c[col.k]}{/if}
        {/snippet}
      </Tabla>
    </div>
  </Pagina>
{/if}
