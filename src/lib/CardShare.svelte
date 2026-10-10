<script>
 import { onMount, onDestroy } from 'svelte';
 import { buildSocialPost, cardShareUrl } from './socialPost.js';
 let { row } = $props();
 let pageUrl = $state('https://towcenter.github.io/deals-and-lawsuits-tracker/');
 onMount(() => {
  pageUrl = window.location.href;
 });
 const text = $derived(buildSocialPost(row, cardShareUrl(pageUrl, row.id)));
 let open = $state(false);
 let message = $state('');
 let postCopied = $state(false);
 let copyReset;
 onDestroy(() => clearTimeout(copyReset));
 let control;
 async function copyLink() {
  try { await navigator.clipboard.writeText(cardShareUrl(pageUrl, row.id)); message = 'Link copied'; }
  catch { message = 'Could not copy the link.'; }
 }
 async function copyText() {
  try {
   await navigator.clipboard.writeText(text);
   message = '';
   postCopied = true;
   clearTimeout(copyReset);
   copyReset = setTimeout(() => postCopied = false, 2000);
  }
  catch { message = 'Select and copy the draft below.'; }
 }

</script>

<svelte:window onpointerdown={event => { if (open && control && !control.contains(event.target)) open = false; }} onkeydown={event => { if (event.key === 'Escape') open = false; }} />
<div class="share-control" bind:this={control}>
 <button class="share-icon" aria-label="Share reported details" title="Share reported details" aria-expanded={open} onclick={() => { open = !open; message = ''; }}>
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
   <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/>
  </svg>
 </button>
 {#if open}
  <div class="share-message">
   <div class="share-heading"><strong>Share this update</strong><button class="close-share" aria-label="Close sharing" onclick={() => open = false}>×</button></div>
   <div class="social-options" aria-label="Share options">
    <a href={`https://bsky.app/intent/compose?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"><span class="brand bluesky" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 11C9 6 3 2 2 5c-1 4 0 8 5 8-6 2-3 8 1 5l4-4 4 4c4 3 7-3 1-5 5 0 6-4 5-8-1-3-7 1-10 6Z"/></svg></span><span class="social-label">Bluesky</span></a>
    <a href={`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"><span class="brand x" aria-hidden="true">𝕏</span><span class="social-label">X</span></a>
   </div>
   <div class="link-copy"><input readonly aria-label="Card link" value={cardShareUrl(pageUrl, row.id)} onclick={event => event.currentTarget.select()} /><button onclick={copyLink}>Copy</button></div>
   <div class="draft">
    <div class="preview-heading"><span>Post preview</span><button class="copy-draft" onclick={copyText} aria-label={postCopied ? 'Post copied' : 'Copy post text'} title={postCopied ? 'Post copied' : 'Copy post text'}>{#if postCopied}<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>{:else}<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V3H3v13h5"/></svg>{/if}</button></div>
    <textarea readonly aria-label="Post draft" value={text} onclick={event => event.currentTarget.select()}></textarea>
   </div>
   {#if message}<span role="status">{message}</span>{/if}
  </div>
 {/if}
</div>

<style>
 .share-control {position: absolute; top: .75rem; right: 0; z-index: 5;}
 .share-icon {display: grid; place-items: center; width: 32px; height: 32px; padding: 0; border: 0; background: white; color: #999; cursor: pointer; border-radius: 50%; box-shadow: 0 1px 7px #0000000d;}
 .share-icon:hover, .share-icon[aria-expanded="true"] {color: #315a7a; background: #f5f7fa;}
 .share-message {position: absolute; right: 0; top: 46px; width: min(275px, 78vw); padding: .8rem; box-sizing: border-box; font-family: inherit; background: white; border: 1px solid #e0e0e0; border-radius: 0; box-shadow: 0 3px 12px #00000012; font-size: .8rem; color: #333;}
 .share-message::before {content: ''; position: absolute; right: 10px; top: -7px; width: 13px; height: 13px; background: white; transform: rotate(45deg); border-left: 1px solid #e0e0e0; border-top: 1px solid #e0e0e0;}
 .social-options {display: grid; grid-template-columns: repeat(2, 1fr); gap: .35rem; margin: .75rem 0;}
 .social-options a {display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 5px; width: 100%; box-sizing: border-box; font: inherit; font-weight: 600; color: #777; background: none; border: 0; padding: .45rem .2rem; text-decoration: none; cursor: pointer; text-align: left; border-radius: 0; background: #fafafa; border: 1px solid #e0e0e0;}
 .social-options a:hover {background: #f0f0f0; color: #333;}
 .brand {display: grid; place-items: center; width: 24px; height: 24px; flex: 0 0 24px; font-size: 27px; line-height: 1; font-weight: 700;}
 .brand svg {width: 23px; height: 23px;}
 .bluesky {color: #168bfa;} .x {color: #222;}
 .share-heading {display: flex; align-items: center; justify-content: space-between; font-size: .8rem; letter-spacing: .5px; color: #333;}
 .close-share {border: 0; background: none; color: #777; font-size: 25px; cursor: pointer; padding: 0 3px;}
 .social-label {font-size: .7rem;}
 .link-copy {display: flex; border-radius: 0; overflow: hidden; background: #fafafa; border: 1px solid #e0e0e0;}
 .link-copy input {width: 0; flex: 1; border: 0; background: transparent; padding: .5rem; font: inherit; color: #777;}
 .link-copy button {border: 0; border-left: 1px solid #e0e0e0; background: #f0f0f0; color: #333; font: inherit; font-weight: 600; padding: .45rem .6rem; cursor: pointer;}
 .draft {margin-top: .75rem; font-size: .75rem;}
 .preview-heading {display: flex; align-items: center; gap: .4rem; color: #666; font-weight: 600; letter-spacing: .3px;}
 .copy-draft {display: grid; place-items: center; padding: .25rem; border: 0; background: transparent; color: #777; cursor: pointer;}
 .copy-draft:hover {color: #333; background: #f0f0f0;}

 textarea {box-sizing: border-box; width: 100%; min-height: 130px; margin-top: .5rem; padding: .5rem; border: 1px solid #ddd; border-radius: 4px; font: inherit;}
 [role="status"] {display: block; padding: .5rem .75rem; font-size: .75rem;}
</style>
