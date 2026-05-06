<script>
    // Import the CJR styles
    import './cjr.css';
    
    // Logo configuration - update these URLs to change the logo
    const logoDesktopUrl = 'https://miro.medium.com/v2/resize:fit:1070/1*Bdt1nEsNDbLfk-w0b3dnqA.jpeg';
    const logoMobileUrl = 'https://miro.medium.com/v2/resize:fit:1070/1*Bdt1nEsNDbLfk-w0b3dnqA.jpeg';
    const logoAlt = 'Columbia Journalism School and Tow Center for Digital Journalism';
    const logoLink = 'https://towcenter.columbia.edu/';

    /**
     * @typedef {Object} NavItem
     * @property {string} href - Link anchor
     * @property {string} label - Link text
     */

    /** @type {{ navItems?: NavItem[] }} */
    let {
        navItems = [
            { href: 'https://towcenter.columbia.edu/news/platforms-and-publishers', label: 'Platforms and Publishers Project' },
            { href: 'https://tow.cjr.org/platform-timeline/', label: 'P&P Timeline' },
            { href: 'https://www.cjr.org/tow-center', label: 'Other Tow Center Reports' }
        ]
    } = $props();

    let mobileMenuOpen = $state(false);

    function toggleMobileMenu() {
        mobileMenuOpen = !mobileMenuOpen;
    }
</script>


<div class="container-fluid top-nav-box">
    <div class="container-lg top-nav-1">
        <header class="cjr-header">
            <a class="cjr-header__logo-link" href={logoLink} rel="home">
                <img
                    src={logoDesktopUrl}
                    alt={logoAlt}
                    class="cjr-header__logo"
                />
                <img
                    src={logoMobileUrl}
                    alt={logoAlt}
                    class="cjr-logo-mobile"
                />
            </a>
            {#if navItems && navItems.length > 0}
                <button 
                    class="mobile-menu-toggle"
                    onclick={toggleMobileMenu}
                    aria-label="Toggle navigation menu"
                    aria-expanded={mobileMenuOpen}
                >
                    <span class="hamburger-line"></span>
                    <span class="hamburger-line"></span>
                    <span class="hamburger-line"></span>
                </button>
            {/if}
            <a href="https://towcenter.columbia.edu/content/stay-updated-about-tow-centers-work-how-technology-changing-journalism-subscribe-our-weekly" class="subscribe-button">Stay Updated</a>
        </header>
        {#if navItems && navItems.length > 0}
            <nav class="mobile-nav" class:open={mobileMenuOpen} aria-label="Mobile navigation" aria-hidden={!mobileMenuOpen}>
                <ul>
                    {#each navItems as item}
                        <li>
                            <a href={item.href} onclick={() => { mobileMenuOpen = false; }}>{item.label}</a>
                        </li>
                    {/each}
                </ul>
            </nav>
        {/if}
    </div>
</div>
<style>
    .cjr-header__logo-link {
        display: flex;
        align-items: center;
        text-decoration: none;
        line-height: 0;
        width: auto;
        height: 100%;
    }
    
    .cjr-header__logo-link img.cjr-header__logo {
        max-width: 500px;
        width: auto !important;
        height: auto;
        max-height: 70px;
        object-fit: contain;
        display: block;
    }
    
    .cjr-header__logo-link img.cjr-logo-mobile {
        max-width: 100%;
        width: auto !important;
        height: auto;
        object-fit: contain;
        display: none;
    }
    
    .subscribe-button {
        display: block;
        padding: 0.6rem 1.5rem;
        background-color: #999999;
        color: white;
        text-decoration: none;
        border: none;
        border-radius: 0;
        font-family: 'Graphik Web', 'Helvetica', sans-serif;
        font-size: 0.95rem;
        font-weight: 500;
        white-space: nowrap;
        margin-left: auto;
        transition: background-color 0.2s ease;
    }

    .subscribe-button:hover {
        background-color: #777777;
        color: white;
        text-decoration: none;
    }

    .mobile-menu-toggle {
        display: none;
        position: relative;
        margin-left: 0;
        margin-right: auto;
        margin-bottom: 0;
        margin-top: 0;
        z-index: 1000;
        background: transparent;
        border: none;
        border-radius: 4px;
        padding: 0.5rem;
        cursor: pointer;
        flex-direction: column;
        gap: 4px;
        box-shadow: none;
        align-items: center;
        justify-content: center;
        width: auto;
    }

    .hamburger-line {
        width: 24px;
        height: 2px;
        background-color: #254c6f;
        transition: all 0.3s ease;
        position: relative;
    }

    .mobile-menu-toggle[aria-expanded="true"] .hamburger-line:nth-child(1) {
        transform: rotate(45deg);
        top: 6px;
    }

    .mobile-menu-toggle[aria-expanded="true"] .hamburger-line:nth-child(2) {
        opacity: 0;
    }

    .mobile-menu-toggle[aria-expanded="true"] .hamburger-line:nth-child(3) {
        transform: rotate(-45deg);
        top: -6px;
    }

    .mobile-nav {
        display: none;
        position: relative;
        background: #fff;
        border-bottom: 1px solid #ccc;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 999;
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.3s ease;
        margin-bottom: 0;
    }

    .mobile-nav.open {
        max-height: 300px;
    }

    .mobile-nav ul {
        list-style: none;
        padding: 1rem;
        margin: 0;
    }

    .mobile-nav li {
        margin-bottom: 0.75rem;
    }

    .mobile-nav a {
        color: #254c6f;
        text-decoration: none;
        font-size: 1rem;
        display: block;
        padding: 0.5rem 0;
    }

    .mobile-nav a:hover {
        color: #1a3454;
        text-decoration: underline;
    }

    @media screen and (max-width: 768px) {
        .cjr-header__logo-link img.cjr-header__logo {
            display: none;
        }
        
        .cjr-header__logo-link img.cjr-logo-mobile {
            display: block !important;
            max-height: 60px;
            width: auto !important;
            max-width: 100%;
        }
        
        .mobile-menu-toggle {
            display: flex;
            margin-left: auto;
            margin-right: 0;
        }

        .subscribe-button {
            display: none;
        }

        .mobile-nav {
            display: block;
        }
    }
</style>    
