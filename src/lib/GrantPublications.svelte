<script>
 let {presentation, label, flags, networkIcon} = $props();
</script>
{#each presentation.groups as group}
 <div class="publisher-item">
  <div class="field-item">{@render label(group.name)}{@render networkIcon(group.name)}{@render flags(group.name)}</div>
  {#if group.items.length}
   <div class="recipients">
    {#each group.items as item}
     <div class="recipient" style:margin-left={`${(item.depth - 1) * 16}px`}>
      {#if item.isGrantee}<span class="role-label">Grantee: </span>{/if}{@render label(item.name)}{@render flags(item.name)}
     </div>
    {/each}
   </div>
  {/if}
 </div>
{/each}
{#each presentation.unassigned as item}
 <div class="field-item">{#if item.isGrantee}<span class="role-label">Grantee: </span>{/if}{@render label(item.name)}{@render flags(item.name)}</div>
{/each}
<style>
 .publisher-item {margin-bottom:.5rem;}
 .field-item {margin-bottom:.5rem;}
 .recipients {margin:.5rem 0 .5rem .75rem;padding-left:1rem;border-left:1px solid #e0e0e0;}
 .recipient {margin:.4rem 0;color:#555;font-style:italic;}
 .role-label {font-weight:600;}
</style>
