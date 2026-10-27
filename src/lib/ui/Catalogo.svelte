<script lang="ts" module>
  export interface Opcion { v: string; t: string }
  export interface Campo {
    k: string; t: string;
    tipo?: 'texto' | 'numero' | 'monto' | 'entero' | 'select' | 'check' | 'area' | 'email' | 'tel' | 'clave';
    op?: Opcion[] | (() => Promise<Opcion[]>);
    req?: boolean; full?: boolean; ayuda?: string; def?: any; ph?: string;
  }
  export interface ConfCatalogo {
    tabla: string; singular: string; campos: Campo[];
    cols: import('./tipos').Columna<any>[];
    /** consulta de la lista (con joins); por defecto SELECT * FROM tabla */
    select?: string; buscar: string[]; orden?: string;
    /** la tabla tiene columna activo: se desactiva en lugar de borrar */
    activos?: boolean;
    /** valida y ajusta antes de guardar; devuelve un error o nada */
    validar?: (d: Record<string, any>, id?: string) => string | void | Promise<string | void>;
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { q, exec, uid } from '../db';
  import { app, avisar, fallo, confirmar, refrescar } from '../estado.svelte';
  import { leerMonto, leerNumero, montoEditable } from '../formato';
  import Pagina from './Pagina.svelte';
  import Tabla from './Tabla.svelte';
  import Panel from './Panel.svelte';
  import Icono from './Icono.svelte';

  let { conf, titulo, desc = '', acciones, detalle, celda }:
    { conf: ConfCatalogo; titulo: string; desc?: string; acciones?: Snippet; detalle?: Snippet<[Record<string, any>]>; celda?: Snippet<[any, any]> } = $props();

  let filas = $state<any[]>([]);
  let texto = $state('');
  let verInactivos = $state(false);
  let abierto = $state(false);
  let actual = $state<Record<string, any>>({});
  let esNuevo = $state(true);
  let opciones = $state<Record<string, Opcion[]>>({});
  let guardando = $state(false);

  async function cargar() {
    const base = conf.select || `SELECT * FROM ${conf.tabla}`;
    const orden = conf.orden ? ` ORDER BY ${conf.orden}` : '';
    filas = await q(`SELECT * FROM (${base}) x${conf.activos && !verInactivos ? ' WHERE activo = 1' : ''}${orden}`);
  }
  $effect(() => { app.version; verInactivos; cargar(); });

  const vista = $derived.by(() => {
    const t = texto.trim().toLowerCase();
    if (!t) return filas;
    return filas.filter((f) => conf.buscar.some((k) => String(f[k] ?? '').toLowerCase().includes(t)));
  });

  async function cargarOpciones() {
    for (const c of conf.campos) if (c.tipo === 'select' && c.op) opciones[c.k] = typeof c.op === 'function' ? await c.op() : c.op;
  }
  async function abrir(f?: Record<string, any>) {
    await cargarOpciones();
    esNuevo = !f;
    const d: Record<string, any> = {};
    for (const c of conf.campos) {
      const v = f ? f[c.k] : c.def;
      d[c.k] = c.tipo === 'monto' ? montoEditable(v || 0) : c.tipo === 'check' ? !!(f ? v : c.def ?? true) : c.tipo === 'clave' ? '' : (v ?? '');
    }
    d.id = f?.id; d.activo = f ? f.activo : 1;
    actual = d; abierto = true;
  }
  async function guardar(e: Event) {
    e.preventDefault();
    for (const c of conf.campos) if (c.req && !String(actual[c.k] ?? '').trim()) { avisar(`Falta ${c.t.toLowerCase()}.`, 'error'); return; }
    const d: Record<string, any> = {};
    for (const c of conf.campos) {
      let v = actual[c.k];
      if (c.tipo === 'monto') v = leerMonto(v);
      else if (c.tipo === 'numero') v = leerNumero(v);
      else if (c.tipo === 'entero') v = Math.round(leerNumero(v));
      else if (c.tipo === 'check') v = v ? 1 : 0;
      else if (c.tipo === 'clave') { if (!v) continue; v = await hash(v); }
      else v = typeof v === 'string' ? v.trim() || null : v;
      d[c.k] = v;
    }
    const err = await conf.validar?.(d, esNuevo ? undefined : actual.id);
    if (err) { avisar(err, 'error'); return; }
    guardando = true;
    try {
      const ks = Object.keys(d);
      if (esNuevo) {
        await exec(`INSERT INTO ${conf.tabla} (id, ${ks.join(', ')}) VALUES (?, ${ks.map(() => '?').join(', ')})`, [uid(), ...ks.map((k) => d[k])]);
        avisar(`${conf.singular} creado.`);
      } else {
        await exec(`UPDATE ${conf.tabla} SET ${ks.map((k) => k + ' = ?').join(', ')} WHERE id = ?`, [...ks.map((k) => d[k]), actual.id]);
        avisar('Cambios guardados.');
      }
      abierto = false; refrescar();
    } catch (e) { fallo(e); } finally { guardando = false; }
  }
  async function alternarActivo() {
    const activar = !actual.activo;
    if (!activar && !(await confirmar(`¿Desactivar ${conf.singular.toLowerCase()}?`, 'Deja de aparecer en las listas, pero su historia se conserva.', 'Desactivar', true))) return;
    try {
      await exec(`UPDATE ${conf.tabla} SET activo = ? WHERE id = ?`, [activar ? 1 : 0, actual.id]);
      abierto = false; refrescar(); avisar(activar ? 'Activado.' : 'Desactivado.');
    } catch (e) { fallo(e); }
  }
  async function hash(t: string) {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('cumbre:' + t));
    return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('');
  }
</script>

<Pagina {titulo} {desc}>
  {#snippet acciones()}
    <label class="buscar">
      <Icono n="buscar" size={16} />
      <input class="input" placeholder="Buscar…" bind:value={texto} />
    </label>
    {#if conf.activos}<label class="check mute"><input type="checkbox" bind:checked={verInactivos} /> Inactivos</label>{/if}
    {@render acciones?.()}
    <button class="btn btn--primary" onclick={() => abrir()}><Icono n="mas" />Nuevo</button>
  {/snippet}

  <div class="glass lista">
    <Tabla cols={conf.cols} filas={vista} onFila={(f) => abrir(f)} {celda}
      vacio={texto ? 'Nada coincide con la búsqueda.' : `Todavía no hay registros. Crea el primero con "Nuevo".`} />
  </div>
</Pagina>

<Panel bind:abierto titulo={esNuevo ? `Nuevo: ${conf.singular.toLowerCase()}` : conf.singular} sub={esNuevo ? '' : actual.nombre || ''}>
  <form id="f-cat" class="grid-form" onsubmit={guardar}>
    {#each conf.campos as c}
      {#if c.tipo === 'check'}
        <label class="check {c.full ? 'full' : ''}"><input type="checkbox" bind:checked={actual[c.k]} /> {c.t}</label>
      {:else}
        <label class="field" class:full={c.full || c.tipo === 'area'}>
          <span>{c.t}{c.req ? ' *' : ''}</span>
          {#if c.tipo === 'select'}
            <select class="select" bind:value={actual[c.k]}>
              <option value="">—</option>
              {#each opciones[c.k] || [] as o}<option value={o.v}>{o.t}</option>{/each}
            </select>
          {:else if c.tipo === 'area'}
            <textarea class="textarea" bind:value={actual[c.k]} placeholder={c.ph || ''}></textarea>
          {:else}
            <input class="input" class:num={c.tipo === 'monto' || c.tipo === 'numero' || c.tipo === 'entero'}
              type={c.tipo === 'email' ? 'email' : c.tipo === 'tel' ? 'tel' : c.tipo === 'clave' ? 'password' : 'text'}
              inputmode={c.tipo === 'monto' || c.tipo === 'numero' ? 'decimal' : c.tipo === 'entero' ? 'numeric' : undefined}
              bind:value={actual[c.k]} placeholder={c.tipo === 'clave' && !esNuevo ? 'Déjalo vacío para no cambiarla' : c.ph || ''} />
          {/if}
          {#if c.ayuda}<small>{c.ayuda}</small>{/if}
        </label>
      {/if}
    {/each}
  </form>
  {#if !esNuevo && detalle}<div class="detalle">{@render detalle(actual)}</div>{/if}
  {#snippet pie()}
    {#if !esNuevo && conf.activos}
      <button class="btn btn--ghost" class:btn--danger={actual.activo} onclick={alternarActivo}>{actual.activo ? 'Desactivar' : 'Activar'}</button>
      <span class="spacer"></span>
    {/if}
    <button class="btn" onclick={() => (abierto = false)}>Cancelar</button>
    <button class="btn btn--primary" form="f-cat" type="submit" disabled={guardando}><Icono n="check" />Guardar</button>
  {/snippet}
</Panel>

<style>
  .lista { overflow: hidden; }
  .buscar { position: relative; display: block; width: 240px; }
  .buscar :global(svg) { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--ink-3); pointer-events: none; }
  .buscar .input { padding-left: 34px; }
  .detalle { margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--line); }
</style>
