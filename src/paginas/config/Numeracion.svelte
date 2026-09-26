<script lang="ts">
  import { q, exec } from '../../lib/db';
  import { avisar, fallo } from '../../lib/estado.svelte';
  import Pagina from '../../lib/ui/Pagina.svelte';
  import Icono from '../../lib/ui/Icono.svelte';

  const NOMBRES: Record<string, string> = { pos: 'Tickets de caja', venta: 'Notas de venta', compra: 'Órdenes de compra', recepcion: 'Recepciones', despacho: 'Despachos', ajuste: 'Ajustes de inventario', traslado: 'Traslados' };
  let filas = $state<any[]>([]);
  $effect(() => { cargar(); });
  async function cargar() { filas = await q('SELECT * FROM secuencias ORDER BY clave'); }
  async function guardar() {
    try {
      for (const f of filas) {
        const n = Math.max(1, Math.round(Number(f.siguiente) || 1)), dg = Math.min(10, Math.max(1, Math.round(Number(f.digitos) || 6)));
        await exec('UPDATE secuencias SET prefijo = ?, siguiente = ?, digitos = ? WHERE clave = ?', [String(f.prefijo || ''), n, dg, f.clave]);
      }
      avisar('Numeración guardada.'); cargar();
    } catch (e) { fallo(e); }
  }
</script>

<Pagina titulo="Numeración" desc="Prefijo y próximo número de cada tipo de documento.">
  {#snippet acciones()}<button class="btn btn--primary" onclick={guardar}><Icono n="check" />Guardar</button>{/snippet}
  <div class="glass">
    <table class="tabla">
      <thead><tr><th>Documento</th><th style="width:140px">Prefijo</th><th style="width:140px" class="r">Próximo número</th><th style="width:110px" class="r">Dígitos</th><th>Se verá así</th></tr></thead>
      <tbody>
        {#each filas as f}
          <tr><td class="fuerte">{NOMBRES[f.clave] || f.clave}</td>
            <td><input class="input" bind:value={f.prefijo} /></td>
            <td><input class="input num" bind:value={f.siguiente} inputmode="numeric" /></td>
            <td><input class="input num" bind:value={f.digitos} inputmode="numeric" /></td>
            <td class="mute num">{f.prefijo}{String(f.siguiente).padStart(Number(f.digitos) || 1, '0')}</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
</Pagina>
