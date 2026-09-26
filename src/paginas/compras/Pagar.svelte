<script lang="ts">
  import { q } from '../../lib/db';
  import { app, avisar, refrescar } from '../../lib/estado.svelte';
  import { ir } from '../../lib/rutas.svelte';
  import { registrarPago } from '../../lib/servicios/compras';
  import { usd, bsDeC, num, fecha, fechaHora } from '../../lib/formato';
  import { diasVencida } from '../../lib/calculos';
  import Pagina from '../../lib/ui/Pagina.svelte';
  import Tabla from '../../lib/ui/Tabla.svelte';
  import Panel from '../../lib/ui/Panel.svelte';
  import Cobro from '../../lib/ui/Cobro.svelte';
  import Icono from '../../lib/ui/Icono.svelte';

  let pestana = $state<'deudas' | 'pagos'>('deudas');
  let abiertas = $state<any[]>([]), pagos = $state<any[]>([]), prov = $state<any>(null), verProv = $state(false), pagar = $state(false);
  $effect(() => { app.version; cargar(); });
  async function cargar() {
    abiertas = await q(`SELECT c.id, c.numero, c.fecha, c.vence, c.total_c, c.pagado_c, c.proveedor_id, p.nombre AS proveedor, p.telefono FROM compras c
                        JOIN proveedores p ON p.id = c.proveedor_id WHERE c.estado IN ('parcial','recibida') AND c.total_c > c.pagado_c ORDER BY c.fecha`);
    pagos = await q(`SELECT pa.*, p.nombre AS proveedor, m.nombre AS metodo, c.numero FROM pagos pa LEFT JOIN proveedores p ON p.id = pa.proveedor_id
                     LEFT JOIN metodos_pago m ON m.id = pa.metodo_id LEFT JOIN compras c ON c.id = pa.compra_id WHERE pa.anulado = 0 ORDER BY pa.fecha DESC LIMIT 300`);
    if (prov) prov = porProv.find((x) => x.id === prov.id) || null;
  }
  const porProv = $derived.by(() => {
    const m = new Map<string, any>();
    for (const c of abiertas) {
      const s = c.total_c - c.pagado_c, d = diasVencida(c.vence);
      const p = m.get(c.proveedor_id) || { id: c.proveedor_id, nombre: c.proveedor, telefono: c.telefono, docs: [] as any[], saldo: 0, vencido: 0, proximo: '' };
      p.docs.push({ ...c, saldo: s, atraso: d }); p.saldo += s; if (d > 0) p.vencido += s;
      if (c.vence && (!p.proximo || c.vence < p.proximo)) p.proximo = c.vence;
      m.set(c.proveedor_id, p);
    }
    return [...m.values()].sort((a, b) => b.saldo - a.saldo);
  });
  const tot = $derived(porProv.reduce((a, p) => ({ saldo: a.saldo + p.saldo, vencido: a.vencido + p.vencido }), { saldo: 0, vencido: 0 }));
  async function pagarProv(ps: any[]) {
    for (const p of ps) await registrarPago({ proveedor_id: prov.id, ...p });
    avisar('Pago aplicado a las órdenes más antiguas.'); refrescar();
  }
</script>

<Pagina titulo="Cuentas por pagar" desc="Lo que le debes a tus proveedores y lo que ya les pagaste.">
  <div class="kpis">
    <div class="glass kpi"><span>Por pagar</span><b>{usd(tot.saldo)}</b><small>{bsDeC(tot.saldo, app.tasa)}</small></div>
    <div class="glass kpi"><span>Vencido</span><b class:warn={tot.vencido > 0}>{usd(tot.vencido)}</b></div>
    <div class="glass kpi"><span>Proveedores</span><b>{porProv.length}</b></div>
  </div>
  <div class="tabs">
    <button class:on={pestana === 'deudas'} onclick={() => (pestana = 'deudas')}>Deudas</button>
    <button class:on={pestana === 'pagos'} onclick={() => (pestana = 'pagos')}>Pagos hechos</button>
  </div>
  {#if pestana === 'deudas'}
    <div class="glass">
      <Tabla filas={porProv} onFila={(p) => { prov = p; verProv = true; }} vacio="No le debes a nadie."
        cols={[
          { k: 'nombre', t: 'Proveedor', clase: () => 'fuerte' }, { k: 'n', t: 'Órdenes', al: 'r', f: (p) => String(p.docs.length) },
          { k: 'proximo', t: 'Próximo vencimiento', f: (p) => (p.proximo ? fecha(p.proximo) : '—') },
          { k: 'vencido', t: 'Vencido', al: 'r', f: (p) => (p.vencido ? usd(p.vencido) : '—'), clase: (p) => (p.vencido ? 'bad' : 'mute') },
          { k: 'saldo', t: 'Saldo', al: 'r', f: (p) => usd(p.saldo), clase: () => 'fuerte' }
        ]} />
    </div>
  {:else}
    <div class="glass">
      <Tabla filas={pagos} onFila={(p) => ir('compras/ordenes/' + p.compra_id)} vacio="Todavía no hay pagos."
        cols={[
          { k: 'fecha', t: 'Fecha', f: (p) => fechaHora(p.fecha) }, { k: 'proveedor', t: 'Proveedor', clase: () => 'fuerte' }, { k: 'numero', t: 'Orden' },
          { k: 'metodo', t: 'Método' }, { k: 'referencia', t: 'Referencia', f: (p) => p.referencia || '—' },
          { k: 'monto', t: 'Monto', al: 'r', f: (p) => (p.moneda === 'VES' ? 'Bs ' + num(p.monto) : usd(p.monto_c)) }, { k: 'monto_c', t: 'En $', al: 'r', f: (p) => usd(p.monto_c) }
        ]} />
    </div>
  {/if}
</Pagina>

<Panel bind:abierto={verProv} titulo={prov?.nombre || ''} sub={prov ? `Le debes ${usd(prov.saldo)}` : ''} ancho={560}>
  {#if prov}
    <div class="stack">
      {#each prov.docs as d}
        <button class="doc" onclick={() => { verProv = false; ir('compras/ordenes/' + d.id); }}>
          <span><b>{d.numero}</b><br /><small class="mute">{fecha(d.fecha)}{d.vence ? ' · vence ' + fecha(d.vence) : ''}</small></span>
          <span class="spacer"></span>
          {#if d.atraso > 0}<span class="tag tag--bad">{d.atraso} días</span>{/if}
          <b class="num">{usd(d.saldo)}</b>
        </button>
      {/each}
    </div>
  {/if}
  {#snippet pie()}
    <button class="btn" onclick={() => (verProv = false)}>Cerrar</button>
    <button class="btn btn--primary" onclick={() => (pagar = true)}><Icono n="pagar" />Pagar</button>
  {/snippet}
</Panel>
{#if prov}<Cobro bind:abierto={pagar} total_c={prov.saldo} titulo="Pagar a {prov.nombre}" permiteCredito textoParcial="Registrar abono" alConfirmar={pagarProv} />{/if}

<style>
  .kpi b.warn { color: var(--warn); }
  .doc { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--field); text-align: left; }
  .doc:hover { background: var(--field-hover); }
</style>
