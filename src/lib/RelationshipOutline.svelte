<script>
 let { types = [], width = 8 } = $props();
 const colors = { lawsuit: '#b4232d', deal: '#21823b', grant: '#1565c0' };
</script>

{#each types as type, index (type)}
 <span class="relationship-outline" aria-hidden="true" style:inset="{index * width}px" style:border-width="{width}px" style:border-color={colors[type]}></span>
{/each}

<style>
 .relationship-outline {
  position: absolute;
  border: 8px solid;
  border-radius: 50%;
  box-sizing: border-box;
  pointer-events: none;
 }
</style>
