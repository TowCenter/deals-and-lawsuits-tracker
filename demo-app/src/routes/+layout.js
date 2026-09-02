export const prerender = true;
export const ssr = false;

// Prerender each page as a directory index (methodology/index.html) rather than a
// flat methodology.html. The static hosts serve the directory without an extension,
// so the URL in the address bar stays /methodology/ — which is what the client-side
// router matches against. A URL ending in .html matches no route and renders a 404.
export const trailingSlash = 'always';
