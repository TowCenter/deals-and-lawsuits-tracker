<script>
	import favicon from '$lib/assets/Tow Center Logo.png';
	import '../../../src/lib/cjr.css';
	import '../../../src/lib/tow.css';

	let { children } = $props();

	// Social sharing metadata
	const siteUrl = 'https://tow.cjr.org/ai-deals-lawsuits/';
	const title = 'AI Deals and Lawsuits | Platforms and Publishers';
	const description = 'A tracker monitoring developments between news publishers and AI companies—including lawsuits, deals, and grants—based on publicly available information.';
	// Social sharing image - using hosted CJR image (accessible and stable URL)
	const imageUrl = 'https://www.cjr.org/wp-content/uploads/2017/08/tow-design-hero-3.jpg';
</script>

<svelte:head>
	<title>{title}</title>
	<link rel="icon" href={favicon} />
	
	<!-- Primary Meta Tags -->
	<meta name="description" content={description} />
	
	<!-- Open Graph / Facebook -->
	<meta property="og:url" content={siteUrl} />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:image" content={imageUrl} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:site_name" content="Tow Center for Digital Journalism" />
	
	<!-- Twitter -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta property="twitter:domain" content="tow.cjr.org" />
	<meta property="twitter:url" content={siteUrl} />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={imageUrl} />
</svelte:head>

{@render children?.()}
