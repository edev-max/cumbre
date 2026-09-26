<script lang="ts">
  import { q } from '../../lib/db';
  import { app, ajuste, avisar, fallo } from '../../lib/estado.svelte';
  import Pagina from '../../lib/ui/Pagina.svelte';
  import Icono from '../../lib/ui/Icono.svelte';

  const CAMPOS = ['empresa_nombre', 'empresa_rif', 'empresa_telefono', 'empresa_email', 'empresa_direccion', 'pie_documentos', 'almacen_principal', 'impuesto_defecto', 'permitir_negativo'];
  let d = $state<Record<string, string>>({}), almacenes = $state<any[]>([]), impuestos = $state<any[]>([]);
  $effect(() => { cargar(); });
  async function cargar() {
    for (const k of CAMPOS) d[k] = app.ajustes[k] ?? '';
    almacenes = await q('SELECT id, nombre FROM almacenes WHERE activo = 1 ORDER BY nombre');
    impuestos = await q('SELECT id, nombre, tasa FROM impuestos WHERE activo = 1 ORDER BY tasa DESC');
  }
  async function guardar(e: Event) {
    e.preventDefault();
    if (!d.empresa_nombre.trim()) { avisar('El nombre no puede quedar vacío.', 'error'); return; }
    try { for (const k of CAMPOS) await ajuste(k, (d[k] ?? '').trim()); avisar('Datos de la empresa guardados.'); } catch (err) { fallo(err); }
  }
</script>

<Pagina titulo="Empresa" desc="Así aparece tu negocio en tickets, notas y reportes.">
  <form class="glass card stack" onsubmit={guardar}>
    <div class="grid-form">
      <label class="field full"><span>Razón social</span><input class="input" bind:value={d.empresa_nombre} /></label>
      <label class="field"><span>RIF</span><input class="input" bind:value={d.empresa_rif} placeholder="J-00000000-0" /></label>
      <label class="field"><span>Teléfono</span><input class="input" bind:value={d.empresa_telefono} /></label>
      <label class="field"><span>Correo</span><input class="input" type="email" bind:value={d.empresa_email} /></label>
      <label class="field"><span>Almacén de la caja</span><select class="select" bind:value={d.almacen_principal}>{#each almacenes as a}<option value={a.id}>{a.nombre}</option>{/each}</select></label>
      <label class="field full"><span>Dirección fiscal</span><input class="input" bind:value={d.empresa_direccion} /></label>
      <label class="field full"><span>Mensaje al pie de los documentos</span><input class="input" bind:value={d.pie_documentos} /></label>
      <label class="field"><span>Impuesto de productos nuevos</span><select class="select" bind:value={d.impuesto_defecto}>{#each impuestos as i}<option value={i.id}>{i.nombre} ({i.tasa} %)</option>{/each}</select></label>
      <label class="check full"><input type="checkbox" checked={d.permitir_negativo === '1'} onchange={(e) => (d.permitir_negativo = e.currentTarget.checked ? '1' : '0')} /> Permitir vender sin existencia (el inventario puede quedar en negativo)</label>
    </div>
    <p class="mute nota">Cumbre emite documentos no fiscales (tickets y notas de entrega). Para facturas fiscales se integra con tu máquina fiscal o un proveedor autorizado por el SENIAT.</p>
    <div class="row"><span class="spacer"></span><button class="btn btn--primary" type="submit"><Icono n="check" />Guardar</button></div>
  </form>
</Pagina>

<style>.nota { font-size: 12.5px; }</style>
