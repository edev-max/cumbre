<script lang="ts">
  import { ruta } from './lib/rutas.svelte';
  import { buscarSub, puede } from './lib/modulos';
  import { app } from './lib/estado.svelte';
  import CatalogoPagina from './paginas/CatalogoPagina.svelte';
  import { CATALOGOS } from './paginas/catalogos';
  import Pronto from './lib/marco/Pronto.svelte';
  import Inicio from './paginas/Inicio.svelte';
  import Pos from './paginas/ventas/Pos.svelte';
  import Notas from './paginas/ventas/Notas.svelte';
  import Cobranza from './paginas/ventas/Cobranza.svelte';
  import Reportes from './paginas/ventas/Reportes.svelte';
  import Ordenes from './paginas/compras/Ordenes.svelte';
  import Recepciones from './paginas/compras/Recepciones.svelte';
  import Pagar from './paginas/compras/Pagar.svelte';
  import Existencias from './paginas/inventario/Existencias.svelte';
  import Movimientos from './paginas/inventario/Movimientos.svelte';
  import Kardex from './paginas/inventario/Kardex.svelte';
  import Productos from './paginas/inventario/Productos.svelte';
  import Despachos from './paginas/logistica/Despachos.svelte';
  import Empresa from './paginas/config/Empresa.svelte';
  import Tasas from './paginas/config/Tasas.svelte';
  import Numeracion from './paginas/config/Numeracion.svelte';
  import Respaldos from './paginas/config/Respaldos.svelte';
  import Licencia from './paginas/config/Licencia.svelte';

  // pantallas propias; el resto de submódulos son catálogos (paginas/catalogos.ts)
  const VISTAS: Record<string, any> = {
    inicio: Inicio,
    'ventas/pos': Pos, 'ventas/notas': Notas, 'ventas/cobranza': Cobranza, 'ventas/reportes': Reportes,
    'compras/ordenes': Ordenes, 'compras/recepciones': Recepciones, 'compras/pagar': Pagar,
    'inventario/productos': Productos, 'inventario/existencias': Existencias, 'inventario/movimientos': Movimientos, 'inventario/kardex': Kardex,
    'logistica/despachos': Despachos,
    'config/empresa': Empresa, 'config/tasas': Tasas, 'config/numeracion': Numeracion, 'config/respaldos': Respaldos, 'config/licencia': Licencia
  };
  const clave = $derived(ruta.partes.slice(0, 2).join('/') || 'inicio');
  const sub = $derived(ruta.partes[1] || '');
  const Comp = $derived(VISTAS[clave]);
</script>

{#key clave}
  {#if !puede(app.usuario.rol, ruta.partes[0] || 'inicio', sub)}
    <div class="glass vacio" style="margin:26px"><p>Tu usuario no tiene acceso a esta sección.</p></div>
  {:else if Comp}
    <Comp />
  {:else if CATALOGOS[sub]}
    <CatalogoPagina clave={sub} />
  {:else}
    <Pronto titulo={buscarSub(ruta.partes[0], sub).s?.nombre || 'Cumbre'} />
  {/if}
{/key}
