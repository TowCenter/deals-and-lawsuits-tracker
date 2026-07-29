import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';

// SvelteKit emits a runtime-computed base path and relative asset URLs for the
// prerendered methodology page. Served from a subdirectory on GitHub Pages both
// resolve against /<base>/methodology/ instead of the site root, so the page
// loads with no JS or CSS. Rewrite them to absolute paths after every build.

// This only ever post-processes a production build, but it runs as its own node
// process and so doesn't inherit the NODE_ENV vite set for itself. Default to
// production so we read the same base path the build was made with.
process.env.NODE_ENV ??= 'production';

const configPath = join(process.cwd(), 'svelte.config.js');
const { default: svelteConfig } = await import(pathToFileURL(configPath).href);
const base = svelteConfig.kit?.paths?.base;

if (!base) {
	console.error(`Error: no kit.paths.base in ${configPath} — nothing to rewrite.`);
	process.exit(1);
}

const methodologyFile = join(process.cwd(), 'build', 'methodology.html');

const rewrites = [
	{
		what: 'runtime base path',
		from: /base:\s*new URL\("\.",\s*location\)\.pathname\.slice\(0,\s*-1\)/g,
		to: `base: "${base}"`
	},
	{
		what: 'modulepreload hrefs',
		from: /href="\.\/_app\//g,
		to: `href="${base}/_app/`
	},
	{
		what: 'dynamic imports',
		from: /import\("\.\/_app\//g,
		to: `import("${base}/_app/`
	}
];

let content;
try {
	content = readFileSync(methodologyFile, 'utf-8');
} catch (error) {
	console.error(`Error: could not read ${methodologyFile} — did vite build run?`);
	console.error(error.message);
	process.exit(1);
}

// A rewrite that silently matches nothing means SvelteKit changed what it emits
// and the deployed page would break with a green build — so fail loudly instead.
const unmatched = [];
let replacements = 0;

for (const { what, from, to } of rewrites) {
	const matches = content.match(from);
	if (matches) {
		content = content.replace(from, to);
		replacements += matches.length;
	} else if (!content.includes(to)) {
		unmatched.push(what);
	}
}

if (unmatched.length > 0) {
	console.error(`Error: nothing to rewrite in methodology.html for: ${unmatched.join(', ')}.`);
	console.error('SvelteKit likely changed its output — update the patterns in fix-methodology.js.');
	process.exit(1);
}

if (replacements === 0) {
	console.log(`✓ methodology.html already points at ${base} — no changes needed`);
} else {
	writeFileSync(methodologyFile, content, 'utf-8');
	console.log(`✓ Rewrote ${replacements} path${replacements === 1 ? '' : 's'} in methodology.html to ${base}`);
}
