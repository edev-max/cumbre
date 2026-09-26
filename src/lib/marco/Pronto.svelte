<script lang="ts">
  import Pagina from '../ui/Pagina.svelte';
  let { titulo }: { titulo: string } = $props();
</script>
<Pagina {titulo}><div class="glass vacio"><p>Esta sección está en construcción.</p></div></Pagina>
