# Tracker Template Usage Guide

This template provides a complete, reusable structure for creating tracker pages with the same header, footer, body, left navigation, filter components, and mobile styles.

## Quick Start

### 1. Create a New Page

Create a new route file (e.g., `demo-app/src/routes/new-tracker/+page.svelte`):

```svelte
<script>
    import TrackerTemplate from '../../../src/lib/TrackerTemplate.svelte';
    import rawData from '../../../src/lib/your-data.json';

    // Data normalization function (customize based on your data structure)
    function normalizeData(rawDataArray) {
        if (!Array.isArray(rawDataArray)) return [];
        
        return rawDataArray.map((row) => {
            return {
                date: row?.Date || null,
                interaction: row?.Interaction || null,
                platform: Array.isArray(row?.['AI Company']) ? row['AI Company'] : [row?.['AI Company']].filter(Boolean),
                // ... add other fields as needed
            };
        }).filter(row => row !== null);
    }

    // Get latest date function
    function getLatestDate(data) {
        if (!Array.isArray(data) || data.length === 0) return '';
        
        const dates = data
            .map(row => row['Last Modified'])
            .filter(Boolean)
            .sort()
            .reverse();
        
        if (dates.length === 0) return '';
        
        const latestDate = new Date(dates[0]);
        if (isNaN(latestDate.getTime())) return '';
        
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
        
        const month = months[latestDate.getMonth()];
        const day = String(latestDate.getDate()).padStart(2, '0');
        const year = latestDate.getFullYear();
        
        return `${month} ${day}, ${year}`;
    }

    const normalizedData = normalizeData(rawData);
    
    const columns = [
        "Date",
        "Interaction",
        "AI Company",
        "News Org",
        "Type",
        "Reported Details"
    ];

    const bodyText = `
        Your body text here with HTML support.
        <br><br>
        You can include <a href='#'>links</a> and <span class='interaction-tag-inline lawsuit'>tags</span>.
    `;
</script>

<TrackerTemplate
    brand="Your Brand Name"
    title="Your Tracker Title"
    bodyText={bodyText}
    data={normalizedData}
    {columns}
    {getLatestDate}
/>
```

### 2. Update Layout for New Route

If creating a new route, you may want to create a layout file (`demo-app/src/routes/new-tracker/+layout.svelte`) with custom meta tags:

```svelte
<script>
	import favicon from '$lib/assets/Tow Center Logo.png';
	import '../../../src/lib/cjr.css';
	import '../../../src/lib/tow.css';

	let { children } = $props();

	const siteUrl = 'https://tow.cjr.org/your-new-tracker/';
	const title = 'Your Tracker Title | Your Brand';
	const description = 'Your description here.';
	const imageUrl = 'https://www.cjr.org/wp-content/uploads/2017/08/tow-design-hero-3.jpg';
</script>

<svelte:head>
	<title>{title}</title>
	<link rel="icon" href={favicon} />
	
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
```

## Template Features

The `TrackerTemplate` component includes:

### ✅ Header
- Tow Center logo
- Responsive navigation
- Mobile hamburger menu

### ✅ Headline
- Brand name (smaller, bold)
- Main title
- Customizable via props

### ✅ Body
- Left navigation sidebar
- Content area with body text
- "Last updated on" date section
- Mobile-responsive layout

### ✅ Filters
- Keyword search
- Multi-select filters (Interaction, Type, AI Company, News Org)
- Export to CSV button
- Filtered row count display

### ✅ CardView
- Card-based data display
- Color-coded by interaction type (Lawsuits, Deals, Grants)
- Expandable/collapsible cards
- Hierarchical data display
- Mobile-responsive

### ✅ Footer
- Tow Center footer with logo
- Links to other Tow Center content

### ✅ Mobile Styles
- Responsive breakpoints
- Hamburger menu
- Mobile-optimized card layout
- Touch-friendly interactions

## Data Structure Requirements

Your data should be normalized to match this structure:

```javascript
{
    date: string | null,
    interaction: string | null,
    platform: string[],  // AI Company
    organization_publisher_named_in_deal_suit: string[],  // News Org(s)
    type: string[],
    reported_details: string,
    affected_publications: string[],
    sources: string[],
    parent_child_matches: array,
    // Lawsuit-specific (optional)
    status: string | null,
    case_number: string | null,
    defendant: string[],
    plaintiff: string[],
    case_filing: string | null,
    location: string | null,
}
```

## Customization

### Change Left Navigation

Edit `src/lib/Body.svelte` to modify the left navigation items, or pass custom nav items if the component supports it.

### Change Body Text Styling

The body text supports HTML, including:
- Line breaks: `<br>`
- Links: `<a href='...'>text</a>`
- Inline tags: `<span class='interaction-tag-inline lawsuit'>Lawsuits</span>`

### Customize Filters

The filters automatically detect available values from your data. To customize filter labels, edit `src/lib/HierarchicalFilter.svelte` and `src/lib/MultiSelect.svelte`.

### Change Card Colors

Edit the CSS in `src/lib/CardView.svelte`:
- `.card.lawsuit` - Red border
- `.card.grant` - Blue border  
- `.card.deal` - Green border

## Example: Complete New Tracker

See `demo-app/src/routes/+page.svelte` for a complete working example.






