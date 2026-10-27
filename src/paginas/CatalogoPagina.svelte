<script lang="ts">
  import Catalogo from '../lib/ui/Catalogo.svelte';
  import { CATALOGOS } from './catalogos';
  let { clave }: { clave: string } = $props();
  const c = $derived(CATALOGOS[clave]);
</script>

{#key clave}
  <Catalogo conf={c.conf} titulo={c.titulo} desc={c.desc} />
{/key}
