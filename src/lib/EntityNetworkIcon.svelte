<script>
 import { buildRelationshipPreview } from './publisherRelationships.js';
 import NetworkRelationshipPreview from './NetworkRelationshipPreview.svelte';
 let { rowId, name, type, relationships, onopen } = $props();
 const componentId = $props.id();
 const tooltipId = `${componentId}-relationships`;
 let relationshipTooltip = $state(null);
 function showRelationshipTooltip(event) {
  const bounds = event.currentTarget.getBoundingClientRect();
  const width = Math.min(type === 'platform' ? 280 : 440, window.innerWidth - 24);
  const preview = type === 'publisher' ? buildRelationshipPreview(relationships, rowId, name) : {};
  relationshipTooltip = {
   ...preview, rowId, name, type, width,
   left: Math.max(12, Math.min(bounds.left, window.innerWidth - width - 12)),
   top: bounds.bottom + 8,
   above: bounds.bottom > window.innerHeight / 2,
   bottom: window.innerHeight - bounds.top + 8
  };
 }
 function hideTooltip() {
  relationshipTooltip = null;
 }
 function openNetwork(event) {
  hideTooltip();
  onopen(event, name, type);
 }
 $effect(() => {
  if (!relationshipTooltip) return;
  const clear = () => { relationshipTooltip = null; };
  window.addEventListener('scroll', clear, true);
  window.addEventListener('resize', clear);
  return () => {
   window.removeEventListener('scroll', clear, true);
   window.removeEventListener('resize', clear);
  };
 });

</script>

 <button
  type="button"
  class="entity-network-icon"
  aria-label={`View ${name} network`}
  aria-describedby={relationshipTooltip ? tooltipId : undefined}
  onmouseenter={showRelationshipTooltip}
  onmouseleave={hideTooltip}
  onfocus={showRelationshipTooltip}
  onblur={hideTooltip}
  onkeydown={event => { if (event.key === 'Escape') hideTooltip(); }}
  onclick={openNetwork}
 >
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
   <path d="M12 8V5M12 16v3M8.5 10l-3-1.7M15.5 10l3-1.7M8.5 14l-3 1.7M15.5 14l3 1.7" />
   <circle cx="12" cy="12" r="4" />
   <circle cx="12" cy="3" r="2" /><circle cx="12" cy="21" r="2" />
   <circle cx="4" cy="7.5" r="2" /><circle cx="20" cy="7.5" r="2" />
   <circle cx="4" cy="16.5" r="2" /><circle cx="20" cy="16.5" r="2" />
  </svg>
 </button>

{#if relationshipTooltip}
 <div id={tooltipId} role="tooltip" class="relationship-tooltip" style:left={`${relationshipTooltip.left}px`} style:width={`${relationshipTooltip.width}px`} style:top={relationshipTooltip.above ? undefined : `${relationshipTooltip.top}px`} style:bottom={relationshipTooltip.above ? `${relationshipTooltip.bottom}px` : undefined}>
  {#if relationshipTooltip.type === 'platform'}
   <span>Click to explore {relationshipTooltip.name}’s network</span>
  {:else}
  <NetworkRelationshipPreview preview={relationshipTooltip} />
  {/if}
 </div>
{/if}

<style>
 .relationship-tooltip {position:fixed;z-index:10000;box-sizing:border-box;padding:14px 16px;background:#fff;border:1px solid #d6dce1;border-radius:6px;box-shadow:0 4px 18px #0002;color:#222;font-size:14px;line-height:1.4;pointer-events:none;max-height:48vh;overflow:auto;}

 .entity-network-icon { display:inline-flex; vertical-align:middle; align-items:center; justify-content:center; width:26px; height:26px; padding:4px; margin-left:6px; border:0; background:transparent; cursor:pointer; color:#8a949d; transition:color .15s ease; }

 .entity-network-icon svg { width:16px; height:16px; flex-shrink:0; }

 .entity-network-icon:hover { color:#254c6f; }

 .entity-network-icon:focus-visible { outline:2px solid #254c6f; outline-offset:2px; }
</style>
