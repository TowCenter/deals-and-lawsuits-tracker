<script>
	/**
	 * Reusable Tracker Template Component
	 * 
	 * This template provides the complete structure for a tracker page with:
	 * - Header (with logo and navigation)
	 * - Headline (with brand and title)
	 * - Body (with left navigation and content area)
	 * - Filters (search and multi-select filters)
	 * - CardView (card-based data display)
	 * - Footer (Tow Center footer)
	 * 
	 * All styling, mobile responsiveness, and components are included.
	 */

	import Head from './Head.svelte';
	import Article from './Article.svelte';
	import Header from './Header.svelte';
	import Headline from './Headline.svelte';
	import Footer from './Footer.svelte';
	import BodyText from './BodyText.svelte';
	import Body from './Body.svelte';
	import Filters from './Filters.svelte';
	import CardView from './CardView.svelte';

	/**
	 * @typedef {Object} NavItem
	 * @property {string} href - Link URL
	 * @property {string} label - Link text
	 */

	/**
	 * @typedef {Object} TrackerConfig
	 * @property {string} brand - Brand name (e.g., "Platforms and Publishers")
	 * @property {string} title - Main page title
	 * @property {string} bodyText - HTML body text content
	 * @property {Array<Object>} data - Normalized data array
	 * @property {string[]} columns - Column names for filtering
	 * @property {string} [latestDate] - Latest update date (optional)
	 * @property {Function} [getLatestDate] - Function to get latest date from data (optional)
	 * @property {NavItem[]} [navItems] - Left navigation items (optional)
	 */

	/** @type {TrackerConfig} */
	let {
		brand = 'Platforms and Publishers',
		title = 'AI Deals and Lawsuits',
		bodyText = '',
		data = [],
		columns = [],
		latestDate = '',
		getLatestDate = () => '',
		navItems = [
			{ href: 'https://towcenter.columbia.edu/news/platforms-and-publishers', label: 'Platforms and Publishers Project' },
			{ href: 'https://tow.cjr.org/platform-timeline/', label: 'P&P Timeline' },
			{ href: 'https://www.cjr.org/tow-center', label: 'Other Tow Center Reports' }
		]
	} = $props();

	// Filter state
	let searchQuery = $state('');
	let filterInteraction = $state([]);
	let filterType = $state([]);
	let filterPlatform = $state([]);
	let filterPublishers = $state([]);
	let filterLocation = $state([]);
	let filteredData = $state([]);

	// CSV download function
	function downloadToCSV() {
		if (!filteredData || filteredData.length === 0) return;

		// Define CSV columns based on available data
		const csvColumns = [
			{ name: 'Date', key: 'date' },
			{ name: 'Interaction', key: 'interaction' },
			{ name: 'AI Company', key: 'platform' },
			{ name: 'News Org(s)', key: 'organization_publisher_named_in_deal_suit' },
			{ name: 'Type', key: 'type' },
			{ name: 'Reported Details', key: 'reported_details' },
			{ name: 'Affected Publications', key: 'affected_publications' },
			{ name: 'Read More', key: 'sources' },
			{ name: 'Defendant', key: 'defendant' },
			{ name: 'Plaintiff', key: 'plaintiff' },
			{ name: 'Status', key: 'status' },
			{ name: 'Case Number', key: 'case_number' },
			{ name: 'Case Filing', key: 'case_filing' },
			{ name: 'Location', key: 'location' },
		].filter(col => {
			// Only include columns that exist in the data
			return filteredData.some(row => row[col.key] !== undefined);
		});
		
		const header = csvColumns.map(col => col.name).join(',');
		
		const rows = filteredData.map(row => {
			return csvColumns.map(col => {
				let value = row[col.key];
				
				// Handle arrays by joining with semicolon
				if (Array.isArray(value)) {
					value = value.filter(v => v && String(v).trim()).join('; ');
				}
				
				// Convert to string and handle null/undefined
				const stringValue = value != null ? String(value) : '';
				
				// Escape quotes and wrap in quotes
				const escaped = stringValue.replace(/"/g, '""');
				return `"${escaped}"`;
			}).join(',');
		});
		
		const csv = [header, ...rows].join('\n');
		
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');
		const url = URL.createObjectURL(blob);
		link.setAttribute('href', url);
		link.setAttribute('download', 'tracker-data.csv');
		link.style.visibility = 'hidden';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		// Revoke the object URL to prevent memory leaks
		URL.revokeObjectURL(url);
	}

	// Get latest date if not provided
	$: displayDate = latestDate || getLatestDate(data) || '';
</script>

<Head />
<Header />
<Article>
	<Headline
		{brand}
		hed={title}
	/>

	<Body {navItems}>
		{#if bodyText}
			<BodyText text={bodyText} />
		{/if}
		
		{#if displayDate}
			<div class="update-date-divider">
				<div class="divider-line"></div>
				<div class="update-date">
					<em>Last updated on</em> <strong>{displayDate}</strong>
				</div>
			</div>
		{/if}
	</Body>

	{#if data && data.length > 0}
		<Filters 
			{data}
			{columns}
			bind:searchQuery
			bind:filterInteraction
			bind:filterType
			bind:filterPlatform
			bind:filterPublishers
			bind:filterLocation
			filteredRowCount={filteredData.length}
			onDownloadCSV={downloadToCSV}
		/>

		<CardView 
			{data}
			{columns}
			{searchQuery}
			{filterInteraction}
			{filterType}
			{filterPlatform}
			{filterPublishers}
			{filterLocation}
			onFilteredDataChange={(data) => { filteredData = data; }}
		/>
	{/if}
</Article>
<Footer />

