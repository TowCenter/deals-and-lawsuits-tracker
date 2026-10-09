<script>
 let { types = [] } = $props();
 const colors = { lawsuit: '#b4232d', deal: '#21823b', grant: '#1565c0' };
</script>

{#if types.length}
 <svg class="relationship-outline" viewBox="0 0 100 100" aria-hidden="true">
  {#each types as type, index (type)}
   <circle cx="50" cy="50" r="48" pathLength="100" fill="none" stroke={colors[type]} stroke-width="5" vector-effect="non-scaling-stroke" stroke-dasharray={`${100 / types.length} ${100 - 100 / types.length}`} stroke-dashoffset={-index * 100 / types.length} transform="rotate(-90 50 50)" />
  {/each}
 </svg>
{/if}

<style>
 .relationship-outline { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; }
</style>
