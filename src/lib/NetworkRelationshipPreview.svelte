<script>
 let { preview } = $props();
</script>

  <strong>{preview.name}: relationships</strong>
  {#if preview.platforms.length}
   <svg class="relationship-preview" viewBox={`0 0 400 ${preview.height}`} role="img" aria-label={`Relationships between ${preview.name} and ${preview.platforms.join(', ')}`}>
    {#each preview.edges as edge}
     {@const y = (preview.platforms.indexOf(edge.platform) + 0.5) * preview.height / preview.platforms.length}
     {@const offset = /lawsuit/i.test(edge.kind) ? -5 : /grant/i.test(edge.kind) ? 5 : 0}
     <path d={`M 125 ${preview.height / 2 + offset} C 210 ${preview.height / 2 + offset}, 210 ${y + offset}, 285 ${y + offset}`} fill="none" stroke={edge.color} stroke-width="2" />
    {/each}
    <circle cx="80" cy={preview.height / 2} r="48" fill="#fff5c1" stroke="#bca13b" />
    <foreignObject x="18" y={preview.height / 2 - 40} width="124" height="80"><div class="preview-label">{preview.name}</div></foreignObject>
    {#each preview.platforms as platform, index}
     {@const y = (index + 0.5) * preview.height / preview.platforms.length}
     <circle cx="320" cy={y} r="28" fill="#ebf4fc" stroke="#9bb8d3" />
     <foreignObject x="257" y={y - 26} width="126" height="52"><div class="preview-label">{platform}</div></foreignObject>
    {/each}
   </svg>
   <div class="preview-legend"><span style:color="#b62230">Lawsuit</span><span style:color="#278442">Deal</span><span style:color="#2878bb">Grant</span></div>
   <small>Click the icon to explore the full network</small>
  {:else}
   <p>No other relationships recorded.</p>
  {/if}
<style>
 strong {display:block;margin-bottom:10px;}
 .relationship-preview {display:block;width:100%;max-height:32vh;}
 .preview-label {display:flex;align-items:center;justify-content:center;height:100%;text-align:center;color:#222;font-size:13px;font-weight:600;line-height:1.2;overflow-wrap:anywhere;}
 .preview-legend {display:flex;gap:16px;font-size:12px;margin:8px 0;}
 small {color:#606870;font-size:12px;}
 p {margin:0;}
</style>
