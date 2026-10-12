<script>
 import previews from './coveragePreviews.json';
 let { url, href = url, number, source, id } = $props();
 let position = $state({left:16,top:16,maxHeight:300,transform:'none'});
 function positionPreview(event) {
  const bounds = event.currentTarget.getBoundingClientRect();
  const width = Math.min(260, window.innerWidth - 32);
  const above = bounds.top - 20;
  const below = window.innerHeight - bounds.bottom - 20;
  const placeAbove = above > below;
  position = {left:Math.max(16,Math.min(bounds.right-width,window.innerWidth-width-16)),top:placeAbove ? bounds.top-4 : bounds.bottom+4,maxHeight:Math.max(60,placeAbove ? above : below),transform:placeAbove ? 'translateY(-100%)' : 'none'};
 }
 const preview = $derived(previews[url]);
</script>
<span class="coverage-preview" role="group" aria-label={`Coverage source ${number}`} onpointerenter={positionPreview} onfocusin={positionPreview}>
 <a class="coverage-number" href={href} target="_blank" rel="noopener noreferrer" aria-label={`Coverage source ${number}: ${preview?.title || source}`} aria-describedby={`coverage-preview-${id}`}>{number}</a>
 <span class="article-preview" style:left={`${position.left}px`} style:top={`${position.top}px`} style:max-height={`${position.maxHeight}px`} style:transform={position.transform} role="tooltip" id={`coverage-preview-${id}`}>
  <span class="preview-source">{source}</span>
  {#if preview?.title}<strong>{preview.title}</strong>{/if}
 </span>
</span>
<style>
 .coverage-preview {position:relative; display:inline-flex;}
 .coverage-number {display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:50%; background:#eaf0f5; color:#254c6f; text-decoration:none; font-size:.7rem; line-height:1;}
 .coverage-number:hover {background:#dbe5ee;}
 .coverage-number:focus-visible {outline:2px solid #254c6f; outline-offset:3px;}
 .article-preview {position:fixed; overflow-y:auto; overscroll-behavior:contain; z-index:90; display:flex; flex-direction:column; gap:.4rem; width:260px; min-width:0; max-width:calc(100vw - 32px); box-sizing:border-box; white-space:normal; overflow-wrap:break-word; word-break:normal; padding:.85rem; border:1px solid #dde3e8; border-radius:6px; background:white; box-shadow:0 4px 18px #0002; font-size:.75rem; line-height:1.5; color:#394651; visibility:hidden; opacity:0;}
 .coverage-preview:hover .article-preview,.coverage-preview:focus-within .article-preview {visibility:visible; opacity:1;}
 .article-preview::after {content:''; position:absolute; bottom:-5px; left:0; right:0; height:5px;}
 .preview-source {font-size:.65rem; color:#74818c;}
 .article-preview > * {min-width:0; width:100%; box-sizing:border-box;}
 strong {font-size:.8rem; font-weight:600;}
</style>
