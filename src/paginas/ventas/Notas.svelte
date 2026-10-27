<script lang="ts">
  import { q } from '../../lib/db';
  import { app } from '../../lib/estado.svelte';
  import { ruta, ir } from '../../lib/rutas.svelte';
  import { usd, fecha } from '../../lib/formato';
  import { estadoPago } from '../../lib/calculos';
  import Pagina from '../../lib/ui/Pagina.svelte';
  import Tabla from '../../lib/ui/Tabla.svelte';
  import Icono from '../../lib/ui/Icono.svelte';
  import NotaNueva from './NotaNueva.svelte';
  import VentaDetalle from './VentaDetalle.svelte';

  let filas = $state<any[]>([]), texto = $state(''), filtro = $state('todas'), origen = $state('todas');
  $effect(() => { app.version; cargar(); });
  async function cargar() {
    filas = await q(`SELECT v.*, c.nombre AS cliente FROM ventas v LEFT JOIN clientes c ON c.id = v.cliente_id ORDER BY v.fecha DESC LIMIT 500`);
  }
  const vista = $derived(filas.filter((v) => {
    if (origen !== 'todas' && v.origen !== origen) return false;
    if (filtro === 'pendientes' && !(v.estado === 'confirmada' && v.total_c > v.pagado_c)) return false;
    if (filtro === 'anuladas' && v.estado !== 'anulada') return false;
    const t = texto.trim().toLowerCase();
    return !t || v.numero.toLowerCase().includes(t) || String(v.cliente || '').toLowerCase().includes(t);
  }));
  const sub = $derived(ruta.partes[2] || '');
</script>

{#if sub === 'nueva'}
  <NotaNueva />
{:else if sub}
  <VentaDetalle id={sub} />
{:else}
  <Pagina titulo="Notas de venta" desc="Todas las ventas: las de caja y las notas con crédito o despacho.">
    {#snippet acciones()}
      <input class="input" style="width:220px" placeholder="Buscar número o cliente…" bind:value={texto} />
      <select class="select" style="width:150px" bind:value={origen}><option value="todas">Caja y notas</option><option value="pos">Sólo caja</option><option value="nota">Sólo notas</option></select>
      <select class="select" style="width:150px" bind:value={filtro}><option value="todas">Todas</option><option value="pendientes">Por cobrar</option><option value="anuladas">Anuladas</option></select>
      <button class="btn btn--primary" onclick={() => ir('ventas/notas/nueva')}><Icono n="mas" />Nueva nota</button>
    {/snippet}
    <div class="glass">
      <Tabla filas={vista} onFila={(v) => ir('ventas/notas/' + v.id)} vacio="No hay ventas con ese filtro."
        cols={[
          { k: 'numero', t: 'Número', clase: () => 'fuerte' }, { k: 'fecha', t: 'Fecha', f: (v) => fecha(v.fecha) },
          { k: 'cliente', t: 'Cliente' }, { k: 'origen', t: 'Tipo', f: (v) => (v.origen === 'pos' ? 'Caja' : 'Nota') },
          { k: 'total_c', t: 'Total', al: 'r', f: (v) => usd(v.total_c) }, { k: 'saldo', t: 'Saldo', al: 'r', f: (v) => (v.estado === 'anulada' ? '—' : usd(v.total_c - v.pagado_c)) },
          { k: 'estado', t: 'Estado', f: (v) => v.estado }
        ]}>
        {#snippet celda(v, c)}
          {#if c.k === 'estado'}
            {#if v.estado === 'anulada'}<span class="tag">Anulada</span>
            {:else}{@const e = estadoPago(v.total_c, v.pagado_c)}<span class="tag tag--{e === 'pagada' ? 'ok' : e === 'parcial' ? 'info' : 'warn'}">{e === 'pagada' ? 'Pagada' : e === 'parcial' ? 'Abonada' : 'Por cobrar'}</span>{/if}
          {:else}{c.f ? c.f(v) : v[c.k]}{/if}
        {/snippet}
      </Tabla>
    </div>
  </Pagina>
{/if}
