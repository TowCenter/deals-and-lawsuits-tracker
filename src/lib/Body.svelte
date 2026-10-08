<script>
	import { page } from '$app/stores';
	
	/**
	 * @typedef {Object} NavItem
	 * @property {string} href - Link anchor
	 * @property {string} label - Link text
	 */

	/**
	 * @typedef {Object} Props
	 * @property {import('svelte').Snippet} children - Content to render
	 * @property {NavItem[]} [navItems=[]] - Navigation items for left sidebar
	 */

	/** @type {Props} */
    let { 
		children,
		navItems = [
			{ href: 'https://towcenter.columbia.edu/news/platforms-and-publishers', label: 'Platforms and Publishers Project' },
			{ href: 'https://tow.cjr.org/platform-timeline/', label: 'P&P Timeline' },
			{ href: 'https://www.cjr.org/tow-center', label: 'Other Tow Center Reports' }
		]
	} = $props();

	// Function to check if a nav item is active
	function isActive(href) {
		if (!href) return false;
		const currentPath = $page.url.pathname;
		
		// For internal links, check if the path matches
		if (href.startsWith('/')) {
			// Normalize paths (remove trailing slashes for comparison, but preserve root)
			let normalizedHref = href.replace(/\/+$/, '') || '/';
			let normalizedPath = currentPath.replace(/\/+$/, '') || '/';
			
			// Handle root path specially
			if (normalizedHref === '/' && normalizedPath === '/') {
				return true;
			}
			
			// For other paths, check exact match
			return normalizedPath === normalizedHref;
		}
		
		// For external links, never mark as active
		return false;
	}
</script>

<div class="container-lg">
    <div class="row">
        {#if navItems && navItems.length > 0}
            <div class="col-sm-2">
                <nav class="left-nav" aria-label="Page navigation">
                    <ul>
                        {#each navItems as item}
                            {@const isExternal = item.href.startsWith('http://') || item.href.startsWith('https://')}
                            <li>
                                <a 
                                    href={item.href} 
                                    class:active={isActive(item.href)}
                                    target={isExternal ? '_blank' : undefined}
                                    rel={isExternal ? 'noopener noreferrer' : undefined}
                                >{item.label}</a>
                            </li>
                        {/each}
                    </ul>
                </nav>
            </div>
        {/if}
        <div class="col-sm-10 entry-content">
            {@render children()}
        </div>
    </div>
</div>

<svelte:head>
    <style>
        /* Prevent FOUC by ensuring Bootstrap grid classes have fallback styles */
        .row {
            display: flex;
            flex-wrap: wrap;
            margin-right: -15px;
            margin-left: -15px;
        }
        .col-sm-2 {
            flex: 0 0 auto;
            width: 21.5%;
            padding-right: 25px;
            padding-left: 15px;
        }
        .col-sm-10 {
            flex: 0 0 auto;
            width: 78.5%;
            padding-right: 15px;
            padding-left: 15px;
        }
        .container-lg {
            width: 100%;
            padding-right: 15px;
            padding-left: 15px;
            margin-right: auto;
            margin-left: auto;
            max-width: 900px;
        }
        @media (max-width: 767.98px) {
            .col-sm-2,
            .col-sm-10 {
                flex: 0 0 100%;
                max-width: 100%;
                padding-left: 0 !important;
                padding-right: 0 !important;
            }
        }
    </style>
</svelte:head>

<style>
    .left-nav {
        position: static;
    }

    .left-nav ul {
        list-style: none;
        padding: 0;
        margin: 0;
        border-left: 2px solid #ccc;
        padding-left: 1.5rem;
    }

    .left-nav li {
        margin-bottom: 1.25rem;
        line-height: 1.5;
    }

    .left-nav a {
        color: #254c6f;
        text-decoration: none;
        font-size: 0.95rem;
        transition: color 0.2s;
        line-height: 1.6;
        display: block;
    }

    .left-nav a:hover {
        color: #1a3454;
        text-decoration: underline;
    }

    .left-nav a.active {
        color: #1a3454;
        font-weight: 600;
        text-decoration: none;
    }

    .left-nav a.active:hover {
        color: #1a3454;
        text-decoration: none;
    }

    @media screen and (max-width: 768px) {
        .left-nav {
            display: none;
        }

        .col-sm-2 {
            display: none;
        }

        .col-sm-10 {
            width: 100%;
            flex: 0 0 100%;
            max-width: 100%;
            padding-left: 1rem !important;
            padding-right: 1rem !important;
        }

        .entry-content {
            padding-left: 0;
            padding-right: 0;
        }
    }

@media screen and (max-width: 768px) {

}
</style>