<script>
	import { getColumnKey, parseArray, formatDate, parseUrls, formatCitations } from './utils.js';

	/**
	 * @typedef {Object} Props
	 * @property {Array<Object>} [data=[]] - Table data rows
	 * @property {string[]} [columns=[]] - Column names to display
	 * @property {string} [searchQuery=''] - Search query string
	 * @property {string[]} [filterInteraction=[]] - Filter by interactions
	 * @property {string[]} [filterType=[]] - Filter by types
	 * @property {string[]} [filterPlatform=[]] - Filter by platforms
	 * @property {string[]} [filterPublishers=[]] - Filter by publishers
	 * @property {(data: Array<Object>) => void} [onFilteredDataChange=() => {}] - Callback when filtered data changes
	 */

	/** @type {Props} */
	let { 
		data = [], 
		columns = [],
		searchQuery = '',
		filterInteraction = [],
		filterType = [],
		filterPlatform = [],
		filterPublishers = [],
		onFilteredDataChange = () => {}
	} = $props();

	let sortColumn = $state('Date');
	let sortDirection = $state('desc');
	let expandedRows = $state(new Set());

	function toggleExpandRow(rowIndex) {
		const newSet = new Set(expandedRows);
		if (newSet.has(rowIndex)) {
			newSet.delete(rowIndex);
		} else {
			newSet.add(rowIndex);
		}
		expandedRows = newSet;
	}

	function toggleSort(column) {
		if (sortColumn === column) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortColumn = column;
			sortDirection = 'asc';
		}
	}

	/**
	 * Removes URLs and domains from text for searching
	 * @param {string} text - Text to clean
	 * @returns {string} Text with URLs and domains removed
	 */
	function removeUrlsAndDomains(text) {
		if (!text) return '';
		
		// Remove URLs (http://, https://, www.)
		let cleaned = String(text)
			.replace(/https?:\/\/[^\s]+/gi, '') // Remove http:// and https:// URLs
			.replace(/www\.[^\s]+/gi, '') // Remove www. domains
			.replace(/[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}[^\s]*/g, '') // Remove domain names (e.g., example.com, subdomain.example.com)
			.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, ''); // Remove email addresses
		
		return cleaned;
	}

	function getFilteredAndSorted() {
		let filtered = data.filter(row => {
			// Filter by interaction (case-insensitive matching)
			if (Array.isArray(filterInteraction) && filterInteraction.length > 0) {
				const rowInteractions = getInteractionArray(row.interaction);
				const normalizedRowInteractions = rowInteractions.map(i => String(i).trim().toLowerCase());
				const normalizedFilters = filterInteraction.map(f => String(f).trim().toLowerCase());
				const matches = normalizedFilters.some(selected => normalizedRowInteractions.includes(selected));
				if (!matches) return false;
			}

			// Filter by type
			if (Array.isArray(filterType) && filterType.length > 0) {
				const rowTypes = Array.isArray(row.type) ? row.type : [row.type];
				const matches = filterType.some(selected => rowTypes.includes(selected));
				if (!matches) return false;
			}

			// Filter by platform
			if (Array.isArray(filterPlatform) && filterPlatform.length > 0) {
				const platforms = parseArray(row.platform);
				const matches = filterPlatform.some(selected => platforms.includes(selected));
				if (!matches) return false;
			}

			// Filter by publishers (checks both organization_publisher_named_in_deal_suit and known_titles_involved)
			if (Array.isArray(filterPublishers) && filterPublishers.length > 0) {
				const orgPublishers = parseArray(row.organization_publisher_named_in_deal_suit);
				const knownTitles = parseArray(row.known_titles_involved);
				const allPublishers = [...orgPublishers, ...knownTitles];
				const matches = filterPublishers.some(selected => allPublishers.includes(selected));
				if (!matches) return false;
			}

			// Search across all columns (including known_titles_involved)
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				
				const searchableText = columns
					.map(col => {
						const key = getColumnKey(col);
						const value = row[key];
						if (!value) return '';
						// Handle arrays in search
						let text;
						if (Array.isArray(value)) {
							text = value.map(v => String(v)).join(' ');
						} else {
							text = String(value);
						}
						// Only remove URLs/domains from sources field, keep all other fields searchable as-is
						const isSourcesField = col.toLowerCase().includes('source') || key === 'sources' || key === 'read_more';
						return isSourcesField ? removeUrlsAndDomains(text).toLowerCase() : text.toLowerCase();
					})
					.join(' ');
				
				// Also include known_titles_involved in search even if not displayed
				let knownTitles = '';
				if (row.known_titles_involved) {
					let titlesText;
					if (Array.isArray(row.known_titles_involved)) {
						titlesText = row.known_titles_involved.map(t => String(t)).join(' ');
					} else {
						titlesText = String(row.known_titles_involved);
					}
					knownTitles = titlesText.toLowerCase();
				}
				
				// Handle sources separately - remove URLs/domains from sources only
				let sourcesText = '';
				if (row.sources || row.read_more) {
					const sources = row.sources || row.read_more;
					const sourcesArray = Array.isArray(sources) ? sources : [sources];
					sourcesText = sourcesArray
						.map(s => removeUrlsAndDomains(String(s)))
						.filter(s => s.trim())
						.join(' ')
						.toLowerCase();
				}
				
				const fullSearchableText = searchableText + ' ' + knownTitles + ' ' + sourcesText;
				
				if (!fullSearchableText.includes(query)) return false;
			}

			return true;
		});

		// Sort
		if (sortColumn) {
			const key = getColumnKey(sortColumn);
			filtered.sort((a, b) => {
				let aVal = a[key] || '';
				let bVal = b[key] || '';
				
				// Handle arrays - convert to string for sorting
				if (Array.isArray(aVal)) {
					aVal = aVal.join(', ');
				}
				if (Array.isArray(bVal)) {
					bVal = bVal.join(', ');
				}
				
				const aStr = String(aVal);
				const bStr = String(bVal);
				const comparison = aStr.localeCompare(bStr);
				return sortDirection === 'asc' ? comparison : -comparison;
			});
		}

		return filtered;
	}

	let filteredData = $derived(getFilteredAndSorted());

	$effect(() => {
		onFilteredDataChange(filteredData);
	});

	function formatReportedDetailsWithCitations(reportedDetails, readMoreUrls) {
		if (!reportedDetails) return '—';
		
		const urls = parseUrls(readMoreUrls);
		let text = String(reportedDetails);
		
		if (urls.length > 0) {
			// Add punctuation if missing
			if (!text.match(/[.!?]$/)) {
				text += '.';
			}
			text += formatCitations(urls);
		}
		
		return text;
	}

	function formatCellValue(value, column) {
		if (!value) return '—';
		
		// Handle arrays
		if (Array.isArray(value)) {
			// Handle Type - display as tags
			if (column === 'Type') {
				return value
					.filter(v => v && String(v).trim())
					.map(item => `<span class="type-tag">${item}</span>`)
					.join('');
			}
			// Handle AI Company, News Org - array of strings
			if (column === 'AI Company' || column === 'News Org') {
				return value
					.filter(v => v && String(v).trim())
					.map(item => `<div class="list-item">${item}</div>`)
					.join('');
			}
			
			// Default array handling - line breaks
			return value
				.filter(v => v)
				.map(v => String(v).trim())
				.join(',');
		}
		
		// Handle Date column - format as MM/DD/YYYY
		if (column === 'Date') {
			const dateStr = String(value).trim();
			// Parse YYYY-MM-DD format
			const [year, month, day] = dateStr.split('-');
			if (year && month && day) {
				return `${month}/${day}/${year}`;
			}
			return dateStr;
		}

		if (column === 'Type' && typeof value === 'string') {
			const items = value.split(',').map(v => v.trim()).filter(v => v);
			return items.map(item => `<span class="type-tag">${item}</span>`).join('');
		}
		
		if ((column === 'AI Company' || column === 'News Org') && typeof value === 'string') {
			const items = value.split(',').map(v => v.trim()).filter(v => v);
			return items.map(item => `<div class="list-item">${item}</div>`).join('');
		}

		return String(value);
	}

	function getInteractionTagClass(value) {
		const valueStr = String(value).trim().toLowerCase();
		if (valueStr === 'lawsuit') return 'lawsuit';
		if (valueStr === 'grant') return 'grant';
		return 'deal';
	}

	function normalizeInteractionValue(value) {
		if (!value) return '';
		const normalized = String(value).trim().toLowerCase();
		if (normalized === 'lawsuit' || normalized === 'grant' || normalized === 'deal') {
			return normalized.charAt(0).toUpperCase() + normalized.slice(1);
		}
		return String(value).trim();
	}

	function getInteractionArray(value) {
		if (!value) return [];
		if (Array.isArray(value)) {
			return value.map(v => normalizeInteractionValue(v)).filter(v => v);
		}
		const normalized = normalizeInteractionValue(value);
		return normalized ? [normalized] : [];
	}
</script>

<div class="table-wrapper">
	<table class="data-table">
		<thead>
			<tr>
				{#each columns as column (column)}
					<th 
						class="sortable-header" 
						onclick={() => toggleSort(column)}
						class:active={sortColumn === column}
					>
						<div class="header-content">
							<span>{column}</span>
							{#if sortColumn === column}
								<span class="sort-icon" class:asc={sortDirection === 'asc'}>
									{sortDirection === 'asc' ? '↑' : '↓'}
								</span>
							{/if}
						</div>
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each filteredData as row, rowIndex (row)}
				<tr>
					{#each columns as column (column)}
						<td>
							{#if column.toLowerCase() === 'reported details'}
								<div class="reported-details-cell">
									<div class="details-text">
										{@html formatReportedDetailsWithCitations(row[getColumnKey(column)], row.read_more)}
									</div>
									{#if row.known_titles_involved && (Array.isArray(row.known_titles_involved) ? row.known_titles_involved.length > 0 : String(row.known_titles_involved).trim())}
										<button 
											class="read-more-btn" 
											onclick={(e) => {
												e.preventDefault();
												toggleExpandRow(rowIndex);
											}}
										>
											{expandedRows.has(rowIndex) ? '- Hide' : '+ Affected Publications'}
										</button>
											{#if expandedRows.has(rowIndex)}
												<div class="titles-section">
													<div class="titles-tags">
													{#each Array.isArray(row.known_titles_involved) ? row.known_titles_involved.filter(t => t) : row.known_titles_involved.split(',').map(t => t.trim()).filter(t => t) as title}
														<span class="title-tag">{title}</span>
													{/each}
												</div>
											</div>
										{/if}
									{/if}
								</div>
							{:else if column.toLowerCase() === 'interaction' && row[getColumnKey(column)]}
								<div class="interaction-tags-wrapper">
									{#each getInteractionArray(row[getColumnKey(column)]) as interaction}
										<span class="interaction-tag {getInteractionTagClass(interaction)}">
											{interaction}
										</span>
									{/each}
								</div>
							{:else if column.toLowerCase() === 'type'}
								<div class="type-tags-wrapper">
									{@html formatCellValue(row[getColumnKey(column)], column)}
								</div>
							{:else}
								{@html formatCellValue(row[getColumnKey(column)], column)}
							{/if}
						</td>
					{/each}
				</tr>
			{/each}
			{#if filteredData.length === 0}
				<tr>
					<td colspan={columns.length} class="no-results">
						No results found
					</td>
				</tr>
			{/if}
		</tbody>
	</table>
</div>

<!-- Mobile Card Layout -->
<div class="mobile-cards">
	{#each filteredData as row, rowIndex (row)}
		<div class="mobile-card">
			<div class="mobile-card-header">
				{#if row.interaction}
					<div class="interaction-tags-wrapper">
						{#each getInteractionArray(row.interaction) as interaction}
							<span class="interaction-tag {getInteractionTagClass(interaction)}">
								{interaction}
							</span>
						{/each}
					</div>
				{/if}
				{#if row.date}
					<span class="mobile-card-date">{@html formatCellValue(row.date, 'Date')}</span>
				{/if}
			</div>
			
			{#each columns as column (column)}
				{#if column.toLowerCase() !== 'date' && column.toLowerCase() !== 'interaction'}
					<div class="mobile-card-field">
						<div class="mobile-card-label">{column}</div>
						<div class="mobile-card-value">
							{#if column.toLowerCase() === 'reported details'}
								<div class="reported-details-cell">
									<div class="details-text">
										{@html formatReportedDetailsWithCitations(row[getColumnKey(column)], row.read_more)}
									</div>
									{#if row.known_titles_involved && (Array.isArray(row.known_titles_involved) ? row.known_titles_involved.length > 0 : String(row.known_titles_involved).trim())}
										<button 
											class="read-more-btn" 
											onclick={(e) => {
												e.preventDefault();
												toggleExpandRow(rowIndex);
											}}
										>
											{expandedRows.has(rowIndex) ? '- Hide' : '+ Affected Publications'}
										</button>
											{#if expandedRows.has(rowIndex)}
												<div class="titles-section">
													<div class="titles-tags">
													{#each Array.isArray(row.known_titles_involved) ? row.known_titles_involved.filter(t => t) : row.known_titles_involved.split(',').map(t => t.trim()).filter(t => t) as title}
														<span class="title-tag">{title}</span>
													{/each}
												</div>
											</div>
										{/if}
									{/if}
								</div>
							{:else if column.toLowerCase() === 'type'}
								<div class="type-tags-wrapper">
									{@html formatCellValue(row[getColumnKey(column)], column)}
								</div>
							{:else}
								{@html formatCellValue(row[getColumnKey(column)], column)}
							{/if}
						</div>
					</div>
				{/if}
			{/each}
		</div>
	{/each}
	{#if filteredData.length === 0}
		<div class="mobile-no-results">
			No results found
		</div>
	{/if}
</div>

<style>
	.table-wrapper {
		overflow-x: auto;
		width: 100%;
		margin-top: 1rem;
		-webkit-overflow-scrolling: touch;
	}

	.data-table {
		width: 100%;
		border-collapse: collapse;
		background-color: #fff;
		font-size: 0.75rem;
		line-height: 1.4;
		table-layout: auto;
	}

	.data-table th {
		padding: 0.7rem 0.6rem;
		text-align: left;
		font-weight: 500;
		color: #333;
		text-transform: uppercase;
		font-size: 0.65rem;
		letter-spacing: 0.5px;
		border-bottom: 2px solid #333;
	}

	/* Column widths */
	.data-table th:nth-child(1),
	.data-table td:nth-child(1) {
		width: 9%;
		min-width: 55px;
	}

	.data-table th:nth-child(2),
	.data-table td:nth-child(2) {
		width: 9%;
		min-width: 55px;
	}

	.data-table th:nth-child(3),
	.data-table td:nth-child(3) {
		width: 6%;
		min-width: 40px;
	}

	.data-table th:nth-child(4),
	.data-table td:nth-child(4) {
		width: 7%;
		min-width: 45px;
	}

	.data-table th:nth-child(5),
	.data-table td:nth-child(5) {
		width: 6%;
		min-width: 40px;
	}

	.data-table th:nth-child(6),
	.data-table td:nth-child(6) {
		width: 38%;
		min-width: 200px;
	}

	.data-table th:nth-child(7),
	.data-table td:nth-child(7) {
		width: 15%;
		min-width: 90px;
	}

	.sortable-header {
		cursor: pointer;
		user-select: none;
	}

	/* .sortable-header:hover {
		background-color: #ebebeb;
	} */

	/* .sortable-header.active {
		background-color: #e0e0e0;
	} */

	.header-content {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.sort-icon {
		font-size: 0.8rem;
		opacity: 0.7;
	}

	.data-table td {
		padding: 0.6rem;
		border-bottom: 1px solid #e0e0e0;
		font-weight: 400;
		color: #1a1a1a;
		word-wrap: break-word;
		overflow-wrap: break-word;
		hyphens: auto;
	}

	.data-table tbody tr:hover {
		background-color: #fafafa;
	}

	.no-results {
		text-align: center;
		color: #999;
		padding: 2rem !important;
		font-style: italic;
	}

	.cell-link {
		color: #254c6f;
		text-decoration: none;
		cursor: pointer;
	}

	.cell-link:hover {
		text-decoration: underline;
	}

	.list-item {
		display: block;
		margin: 0.2rem 0;
		padding: 0.2rem 0.4rem;
		background-color: #f0f0f0;
		border-radius: 3px;
		font-size: 0.7rem;
		width: fit-content;
	}

	.list-item:last-child {
		margin-right: 0;
		margin-bottom: 0;
	}

	.interaction-tags-wrapper {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
	}

	.interaction-tag {
		display: inline-block;
		padding: 0.15rem 0.4rem;
		border-radius: 4px;
		font-size: 0.7rem;
		font-weight: 500;
		text-align: center;
		min-width: 60px;
	}

	.interaction-tag.deal {
		background-color: #c8e6c9;
		color: #2e7d32;
	}

	.interaction-tag.lawsuit {
		background-color: #ffcccc;
		color: #c62828;
	}

	.interaction-tag.grant {
		background-color: #bbdefb;
		color: #1565c0;
	}

	.reported-details-cell {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.details-text {
		line-height: 1.5;
		color: #333;
		hyphens: none;
		word-break: break-word;
		white-space: normal;
	}

	.read-more-btn {
		align-self: flex-start;
		background: none;
		border: none;
		color: #254c6f;
		cursor: pointer;
		font-size: 0.7rem;
		padding: 0;
		text-decoration: underline;
		font-weight: 500;
		margin-top: 0.2rem;
	}

	.read-more-btn:hover {
		color: #1a3a52;
	}

	.titles-section {
		border-top: 1px solid #eee;
		padding-top: 0.8rem;
		margin-top: 0.5rem;
	}

	.titles-label {
		font-weight: 600;
		font-size: 0.85rem;
		color: #333;
		margin-bottom: 0.6rem;
		text-transform: capitalize;
	}

	.titles-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.title-tag {
		display: inline-block;
		background-color: #f0f0f0;
		padding: 0.2rem 0.4rem;
		border-radius: 3px;
		font-size: 0.7rem;
		color: #333;
	}

	.type-tags-wrapper {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.type-tag {
		display: inline-block;
		background-color: #f5f5f5;
		color: #333;
		padding: 0.25rem 0.6rem;
		border-radius: 3px;
		font-size: 0.75rem;
		font-weight: 500;
		line-height: 1.3;
		white-space: nowrap;
		margin: 0.2rem 0.2rem 0.2rem 0;
	}

	.citations {
		display: inline-block;
		margin-left: 0.5rem;
		font-size: 0.85em;
		color: #888;
		letter-spacing: 0.02em;
	}

	.citation-link {
		color: #254c6f;
		text-decoration: none;
		font-weight: 600;
		font-size: 0.95em;
		padding: 0.15rem 0.25rem;
		margin: 0 0.1rem;
		vertical-align: baseline;
		transition: all 0.2s ease;
		position: relative;
		border-radius: 3px;
		display: inline-block;
		line-height: 1;
	}

	.citation-link:hover {
		color: #fff;
		background-color: #254c6f;
		text-decoration: none;
		transform: translateY(-1px);
		box-shadow: 0 2px 4px rgba(37, 76, 111, 0.2);
	}

	.citation-link:active {
		color: #fff;
		background-color: #1a3a52;
		transform: translateY(0);
		box-shadow: 0 1px 2px rgba(37, 76, 111, 0.3);
	}

	/* Mobile Card Layout */
	.mobile-cards {
		display: none;
	}

	@media screen and (max-width: 768px) {
		.table-wrapper {
			display: none;
		}

		.mobile-cards {
			display: block;
			width: 100%;
			margin-top: 1rem;
			padding: 0 1rem;
		}

		.mobile-card {
			background-color: #fff;
			border: 1px solid #e0e0e0;
			border-radius: 4px;
			padding: 1rem;
			margin-bottom: 1rem;
			box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		}

		.mobile-card-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 1rem;
			padding-bottom: 0.75rem;
			border-bottom: 2px solid #333;
		}

		.mobile-card-date {
			font-size: 0.85rem;
			font-weight: 500;
			color: #666;
		}

		.mobile-card-field {
			margin-bottom: 1rem;
		}

		.mobile-card-field:last-child {
			margin-bottom: 0;
		}

		.mobile-card-label {
			font-size: 0.65rem;
			font-weight: 500;
			color: #666;
			text-transform: uppercase;
			letter-spacing: 0.5px;
			margin-bottom: 0.4rem;
		}

		.mobile-card-value {
			font-size: 0.85rem;
			line-height: 1.5;
			color: #1a1a1a;
			word-wrap: break-word;
		}

		.mobile-no-results {
			text-align: center;
			color: #999;
			padding: 2rem;
			font-style: italic;
			background-color: #fff;
			border: 1px solid #e0e0e0;
			border-radius: 4px;
		}
	}
</style>