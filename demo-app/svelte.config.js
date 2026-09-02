import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: 'index.html',
			precompress: false,
			strict: true
		}),
		// The same build is served from two different subdirectories: /ai-deals-lawsuits
		// on the production site and /deals-and-lawsuits-tracker on the GitHub Pages
		// preview. Asset URLs are absolute, so the base path has to be set per target
		// at build time — see the build scripts in package.json.
		paths: {
			base: process.env.BASE_PATH ?? '',
			// Prerendered pages default to relative asset URLs, which resolve against
			// the page's own directory instead of the site root and leave a subpage
			// with no JS or CSS. Pin them to the base path instead.
			relative: false
		}
	}
};

export default config;
