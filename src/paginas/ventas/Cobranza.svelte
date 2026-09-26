<script lang="ts">
  import { q } from '../../lib/db';
  import { app, avisar, refrescar } from '../../lib/estado.svelte';
  import { ir } from '../../lib/rutas.svelte';
  import { registrarCobro } from '../../lib/servicios/ventas';
  import { usd, bsDeC, num, fecha, fechaHora, hoy } from '../../lib/formato';
  import { diasVencida } from '../../lib/calculos';
  import Pagina from '../../lib/ui/Pagina.svelte';
  import Tabla from '../../lib/ui/Tabla.svelte';
  import Panel from '../../lib/ui/Panel.svelte';
  import Cobro from '../../lib/ui/Cobro.svelte';
  import Icono from '../../lib/ui/Icono.svelte';

  let pestana = $state<'cobrar' | 'cobros'>('cobrar');
  let abiertas = $state<any[]>([]), cobros = $state<any[]>([]);
  let cli = $state<any>(null), verCli = $state(false), cobrar = $state(false);
  $effect(() => { app.version; cargar(); });
  async function cargar() {
    abiertas = await q(`SELECT v.id, v.numero, v.fecha, v.vence, v.total_c, v.pagado_c, v.cliente_id, c.nombre AS cliente, c.telefono
                        FROM ventas v JOIN clientes c ON c.id = v.cliente_id WHERE v.estado = 'confirmada' AND v.total_c > v.pagado_c ORDER BY v.fecha`);
    cobros = await q(`SELECT co.*, c.nombre AS cliente, m.nombre AS metodo, v.numero FROM cobros co LEFT JOIN clientes c ON c.id = co.cliente_id
                      LEFT JOIN metodos_pago m ON m.id = co.metodo_id LEFT JOIN ventas v ON v.id = co.venta_id WHERE co.anulado = 0 ORDER BY co.fecha DESC LIMIT 300`);
    if (cli) cli = porCliente.find((x) => x.id === cli.id) || null;
  }
  // antigüedad de la deuda por cliente
  const porCliente = $derived.by(() => {
    const m = new Map<string, any>();
    for (const v of abiertas) {
      const s = v.total_c - v.pagado_c, d = diasVencida(v.vence);
      const c = m.get(v.cliente_id) || { id: v.cliente_id, nombre: v.cliente, telefono: v.telefono, docs: [] as any[], saldo: 0, al_dia: 0, d30: 0, d60: 0, mas: 0, max: 0 };
      c.docs.push({ ...v, saldo: s, atraso: d }); c.saldo += s; c.max = Math.max(c.max, d);
      if (d <= 0) c.al_dia += s; else if (d <= 30) c.d30 += s; else if (d <= 60) c.d60 += s; else c.mas += s;
      m.set(v.cliente_id, c);
    }
    return [...m.values()].sort((a, b) => b.saldo - a.saldo);
  });
  const tot = $derived(porCliente.reduce((a, c) => ({ saldo: a.saldo + c.saldo, vencido: a.vencido + c.d30 + c.d60 + c.mas }), { saldo: 0, vencido: 0 }));
  const hoyCobrado = $derived(cobros.filter((c) => c.fecha.slice(0, 10) === hoy()).reduce((a, c) => a + c.monto_c, 0));
  async function cobrarCliente(pagos: any[]) {
    for (const p of pagos) await registrarCobro({ cliente_id: cli.id, ...p });
    avisar('Cobro aplicado a las notas más antiguas.'); refrescar();
  }
</script>

<Pagina titulo="Cobranza" desc="Quién te debe, desde cuándo, y lo que ya cobraste.">
  <div class="kpis">
    <div class="glass card k"><span class="mute">Por cobrar</span><b class="num">{usd(tot.saldo)}</b><small class="num mute">{bsDeC(tot.saldo, app.tasa)}</small></div>
    <div class="glass card k"><span class="mute">Vencido</span><b class="num" class:warn={tot.vencido > 0}>{usd(tot.vencido)}</b></div>
    <div class="glass card k"><span class="mute">Clientes con deuda</span><b class="num">{porCliente.length}</b></div>
    <div class="glass card k"><span class="mute">Cobrado hoy</span><b class="num">{usd(hoyCobrado)}</b></div>
  </div>
  <div class="tabs">
    <button class:on={pestana === 'cobrar'} onclick={() => (pestana = 'cobrar')}>Por cobrar</button>
    <button class:on={pestana === 'cobros'} onclick={() => (pestana = 'cobros')}>Cobros registrados</button>
  </div>
  {#if pestana === 'cobrar'}
    <div class="glass">
      <Tabla filas={porCliente} onFila={(c) => { cli = c; verCli = true; }} vacio="Nadie te debe. 🎉"
        cols={[
          { k: 'nombre', t: 'Cliente', clase: () => 'fuerte' }, { k: 'n', t: 'Notas', al: 'r', f: (c) => String(c.docs.length) },
          { k: 'al_dia', t: 'Al día', al: 'r', f: (c) => (c.al_dia ? usd(c.al_dia) : '—') },
          { k: 'd30', t: '1–30 días', al: 'r', f: (c) => (c.d30 ? usd(c.d30) : '—'), clase: (c) => (c.d30 ? 'warn' : 'mute') },
          { k: 'd60', t: '31–60 días', al: 'r', f: (c) => (c.d60 ? usd(c.d60) : '—'), clase: (c) => (c.d60 ? 'warn' : 'mute') },
          { k: 'mas', t: 'Más de 60', al: 'r', f: (c) => (c.mas ? usd(c.mas) : '—'), clase: (c) => (c.mas ? 'bad' : 'mute') },
          { k: 'saldo', t: 'Saldo', al: 'r', f: (c) => usd(c.saldo), clase: () => 'fuerte' }
        ]} />
    </div>
  {:else}
    <div class="glass">
      <Tabla filas={cobros} onFila={(c) => ir('ventas/notas/' + c.venta_id)} vacio="Todavía no hay cobros."
        cols={[
          { k: 'fecha', t: 'Fecha', f: (c) => fechaHora(c.fecha) }, { k: 'cliente', t: 'Cliente', clase: () => 'fuerte' }, { k: 'numero', t: 'Documento' },
          { k: 'metodo', t: 'Método' }, { k: 'referencia', t: 'Referencia', f: (c) => c.referencia || '—' },
          { k: 'monto', t: 'Monto', al: 'r', f: (c) => (c.moneda === 'VES' ? 'Bs ' + num(c.monto) : usd(c.monto_c)) },
          { k: 'monto_c', t: 'En $', al: 'r', f: (c) => usd(c.monto_c), clase: () => 'fuerte' }
        ]} />
    </div>
  {/if}
</Pagina>

<Panel bind:abierto={verCli} titulo={cli?.nombre || ''} sub={cli ? `Debe ${usd(cli.saldo)}${cli.telefono ? ' · ' + cli.telefono : ''}` : ''} ancho={560}>
  {#if cli}
    <div class="stack">
      {#each cli.docs as d}
        <button class="doc" onclick={() => { verCli = false; ir('ventas/notas/' + d.id); }}>
          <span><b>{d.numero}</b><br /><small class="mute">{fecha(d.fecha)}{d.vence ? ' · vence ' + fecha(d.vence) : ''}</small></span>
          <span class="spacer"></span>
          {#if d.atraso > 0}<span class="tag tag--{d.atraso > 30 ? 'bad' : 'warn'}">{d.atraso} días</span>{:else}<span class="tag tag--ok">Al día</span>{/if}
          <b class="num">{usd(d.saldo)}</b>
        </button>
      {/each}
    </div>
  {/if}
  {#snippet pie()}
    <button class="btn" onclick={() => (verCli = false)}>Cerrar</button>
    <button class="btn btn--primary" onclick={() => (cobrar = true)}><Icono n="cobro" />Cobrar</button>
  {/snippet}
</Panel>
{#if cli}<Cobro bind:abierto={cobrar} total_c={cli.saldo} titulo="Cobrar a {cli.nombre}" permiteCredito textoParcial="Registrar abono" alConfirmar={cobrarCliente} />{/if}

<style>
  .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .k { display: grid; gap: 4px; }
  .k b { font-size: 22px; font-weight: 800; }
  .k b.warn { color: var(--warn); }
  .doc { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--field); text-align: left; }
  .doc:hover { background: var(--field-hover); }
</style>
