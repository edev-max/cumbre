<script lang="ts" module>
  export interface PagoFila { metodo_id: string; nombre: string; moneda: string; monto: string; referencia: string; pide: boolean }
</script>
<script lang="ts">
  import { q } from '../db';
  import { app } from '../estado.svelte';
  import { usd, bs, bsDeC, montoEditable, leerNumero } from '../formato';
  import { aCentavosUsd } from '../calculos';
  import Modal from './Modal.svelte';
  import Icono from './Icono.svelte';
  /* cobro con varios métodos: dólares y bolívares mezclados, con vuelto */
  let { abierto = $bindable(false), total_c, titulo = 'Cobrar', permiteCredito = false, textoParcial = '', alConfirmar }:
    { abierto?: boolean; total_c: number; titulo?: string; permiteCredito?: boolean; textoParcial?: string;
      alConfirmar: (pagos: { metodo_id: string; moneda: string; monto: number; referencia?: string }[], credito: boolean) => Promise<void> | void } = $props();
  let metodos = $state<any[]>([]);
  let filas = $state<PagoFila[]>([]);
  let trabajando = $state(false), error = $state('');
  $effect(() => { if (abierto) iniciar(); });
  async function iniciar() {
    metodos = await q('SELECT id, nombre, moneda, pide_referencia FROM metodos_pago WHERE activo = 1 ORDER BY orden, nombre');
    filas = []; error = '';
  }
  const pagado_c = $derived(filas.reduce((a, f) => a + aCentavosUsd(leerNumero(f.monto), f.moneda, app.tasa), 0));
  const falta_c = $derived(Math.max(0, total_c - pagado_c));
  const vuelto_c = $derived(Math.max(0, pagado_c - total_c));
  function agregar(m: any) {
    const resto = falta_c;
    const monto = m.moneda === 'VES' ? ((resto / 100) * app.tasa).toFixed(2).replace('.', ',') : montoEditable(resto);
    filas.push({ metodo_id: m.id, nombre: m.nombre, moneda: m.moneda, monto: resto > 0 ? monto : '', referencia: '', pide: !!m.pide_referencia });
  }
  async function confirmar(credito = false) {
    error = '';
    if (!credito && falta_c > 1) { error = 'Falta por cobrar ' + usd(falta_c) + '.'; return; }
    const pagos = filas.map((f) => ({ metodo_id: f.metodo_id, moneda: f.moneda, monto: leerNumero(f.monto), referencia: f.referencia.trim() || undefined })).filter((p) => p.monto > 0);
    if (filas.some((f) => f.pide && leerNumero(f.monto) > 0 && !f.referencia.trim())) { error = 'Falta el número de referencia.'; return; }
    // el vuelto sale del efectivo: se descuenta del último pago en efectivo
    let v = vuelto_c;
    if (v > 1) {
      const i = [...pagos].reverse().findIndex((p) => p.metodo_id.startsWith('efectivo'));
      if (i < 0) { error = 'El vuelto sólo se da en efectivo: ajusta los montos.'; return; }
      const p = pagos[pagos.length - 1 - i];
      const enMoneda = p.moneda === 'VES' ? (v / 100) * app.tasa : v / 100;
      p.monto = Math.round((p.monto - enMoneda) * 100) / 100;
    }
    trabajando = true;
    try { await alConfirmar(pagos.filter((p) => p.monto > 0), credito); abierto = false; }
    catch (e) { error = e instanceof Error ? e.message : String(e); }
    finally { trabajando = false; }
  }
  function tecla(e: KeyboardEvent) { if (abierto && e.key === 'F9') { e.preventDefault(); confirmar(); } }
</script>

<svelte:window onkeydown={tecla} />
<Modal bind:abierto {titulo} ancho={620}>
  <div class="cobro">
    <div class="tot">
      <span class="mute">Total</span>
      <b class="num">{usd(total_c)}</b>
      <span class="num dim">{bsDeC(total_c, app.tasa)}</span>
    </div>
    <div class="metodos">
      {#each metodos as m}
        <button class="btn" onclick={() => agregar(m)}><Icono n={m.moneda === 'VES' ? 'tarjeta' : 'efectivo'} size={15} />{m.nombre}</button>
      {/each}
    </div>
    {#if filas.length}
      <div class="filas">
        {#each filas as f, i}
          <div class="fila">
            <span class="fn">{f.nombre}<small class="mute">{f.moneda === 'VES' ? 'Bs' : '$'}</small></span>
            <input class="input num" inputmode="decimal" bind:value={f.monto} placeholder="0,00" />
            {#if f.pide}<input class="input ref" bind:value={f.referencia} placeholder="Referencia" />{:else}<span class="ref"></span>{/if}
            <button class="btn btn--ghost btn--icon btn--sm" onclick={() => filas.splice(i, 1)} aria-label="Quitar"><Icono n="x" size={14} /></button>
          </div>
        {/each}
      </div>
    {:else}
      <p class="mute pista">Toca un método de pago. Se llena solo con lo que falta.</p>
    {/if}
    <div class="res">
      <div><span class="mute">Recibido</span><b class="num">{usd(pagado_c)}</b></div>
      {#if vuelto_c > 1}
        <div class="vuelto"><span>Vuelto</span><b class="num">{usd(vuelto_c)}</b><small class="num">{bs((vuelto_c / 100) * app.tasa)}</small></div>
      {:else}
        <div class:warn={falta_c > 1}><span class="mute">Falta</span><b class="num">{usd(falta_c)}</b><small class="num mute">{bsDeC(falta_c, app.tasa)}</small></div>
      {/if}
    </div>
    {#if error}<p class="bad">{error}</p>{/if}
  </div>
  {#snippet pie()}
    {#if permiteCredito && falta_c > 1}<button class="btn" onclick={() => confirmar(true)} disabled={trabajando || (!!textoParcial && pagado_c <= 0)}>{textoParcial || `Dejar ${usd(falta_c)} a crédito`}</button>{/if}
    <span class="spacer"></span>
    <button class="btn" onclick={() => (abierto = false)}>Volver</button>
    <button class="btn btn--primary btn--lg" onclick={() => confirmar()} disabled={trabajando || falta_c > 1}><Icono n="check" />Confirmar <kbd>F9</kbd></button>
  {/snippet}
</Modal>

<style>
  .cobro { display: grid; gap: 16px; }
  .tot { display: grid; justify-items: center; gap: 2px; padding: 10px 0 4px; }
  .tot b { font-size: 38px; font-weight: 850; font-stretch: 115%; letter-spacing: -0.02em; }
  .metodos { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
  .filas { display: grid; gap: 8px; }
  .fila { display: grid; grid-template-columns: 1fr 140px 150px 30px; gap: 8px; align-items: center; }
  .fn { display: flex; gap: 6px; align-items: baseline; font-weight: 600; }
  .pista { text-align: center; font-size: 13px; }
  .res { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .res > div { display: grid; gap: 2px; padding: 12px 14px; border-radius: 14px; background: var(--field); border: 1px solid var(--line); }
  .res b { font-size: 20px; font-weight: 800; }
  .vuelto { border-color: color-mix(in oklab, var(--ok) 50%, transparent) !important; color: var(--ok); }
  .warn b { color: var(--warn); }
  kbd { margin-left: 4px; background: rgba(255,255,255,.18); border-color: rgba(255,255,255,.3); color: #fff; }
</style>
