<script>
	import SearchBar from './SearchBar.svelte';
	import MultiSelect from './MultiSelect.svelte';
	import HierarchicalFilter from './HierarchicalFilter.svelte';
	import { getColumnKey, parseArray, buildCountryIndex, getRowLocations, groupPlacesByContinent } from './utils.js';

	let {
		data = [],
		filterType = [],
		filterInteraction = [],
		filterPlatform = [],
		filterPublishers = [],
		filterLocation = [],
		showCountries = false,
		availableValues = null,
		searchQuery = '',
		filteredRowCount = 0,
		onDownloadCSV = () => {},
		onFilterChange = () => {}
	} = $props();

	/**
	 * Gets unique values for a column, with special handling for News Org
	 * @param {string} column - Column name
	 * @returns {string[]} Sorted array of unique values
	 */
	function getUniqueValues(column) {
		const unique = new Set();
		
		data.forEach(row => {
			// Special handling for News Org - combine multiple fields
			if (column === 'News Org') {
				// Add news organizations
				const orgVal = row.organization_publisher_named_in_deal_suit;
				if (orgVal) {
					parseArray(orgVal).forEach(item => {
						const trimmed = String(item).trim();
						if (trimmed) unique.add(trimmed);
					});
				}
				
				// Add affected publications
				const affectedVal = row.affected_publications;
				if (affectedVal) {
					parseArray(affectedVal).forEach(item => {
						const trimmed = String(item).trim();
						if (trimmed) unique.add(trimmed);
					});
				}
				
				// Extract all organizations from parent_child_matches hierarchy
				const parentChildMatches = row.parent_child_matches;
				if (Array.isArray(parentChildMatches)) {
					parentChildMatches.forEach(match => {
						if (match?.lineage && Array.isArray(match.lineage)) {
							match.lineage.forEach(org => {
								const trimmed = String(org).trim();
								if (trimmed) unique.add(trimmed);
							});
						}
					});
				}
				return;
			}
			
			const key = getColumnKey(column);
			const val = row[key];
			if (!val) return;
			
			// Use parseArray for consistent parsing
			parseArray(val).forEach(item => {
				if (item) unique.add(item);
			});
		});
		
		return Array.from(unique).sort();
	}

	function handleTypeChange(selectedValues) {
		onFilterChange('filterType', selectedValues);
	}

	function handleInteractionChange(selectedValues) {
		onFilterChange('filterInteraction', selectedValues);
	}

	function handlePlatformChange(selectedValues) {
		onFilterChange('filterPlatform', selectedValues);
	}

	function handlePublishersChange(selectedValues) {
		onFilterChange('filterPublishers', selectedValues);
	}

	function handleLocationChange(selectedValues) {
		onFilterChange('filterLocation', selectedValues);
	}

	function handleShowCountriesChange(event) {
		onFilterChange('showCountries', event.currentTarget.checked);
	}

	function handleSearchChange(query) {
		onFilterChange('searchQuery', query);
	}

	function handleDownloadCSV() {
		onDownloadCSV();
	}

	const aiCompanyOptions = $derived(getUniqueValues('AI Company'));
	const newsOrgOptions = $derived(getUniqueValues('News Org'));

	const countryIndex = $derived(buildCountryIndex(data));

	const locationOptions = $derived.by(() => {
		const unique = new Set();
		data.forEach(row => {
			getRowLocations(row, countryIndex).forEach(location => unique.add(location));
		});
		return Array.from(unique).sort();
	});

	const locationGroups = $derived(groupPlacesByContinent(locationOptions, countryIndex.flags));
</script>

<div class="filter-bar">
	<div class="filter-row-1">
		<HierarchicalFilter 
			{data}
			label="Category"
			selectedInteraction={filterInteraction}
			selectedType={filterType}
			availableInteractions={availableValues?.interaction}
			availableTypes={availableValues?.type}
			onInteractionChange={handleInteractionChange}
			onTypeChange={handleTypeChange}
		/>

		<MultiSelect 
			label="AI Company"
			options={aiCompanyOptions}
			availableValues={availableValues?.platform}
			selectedValues={filterPlatform}
			onSelectionChange={handlePlatformChange}
		/>

		<MultiSelect
			label="News Org"
			options={newsOrgOptions}
			availableValues={availableValues?.publishers}
			selectedValues={filterPublishers}
			onSelectionChange={handlePublishersChange}
		/>
	</div>

	<div class="filter-row-2">
		<div class="location-filter">
			<MultiSelect
				label="Location"
				options={locationOptions}
				groups={locationGroups}
				availableValues={availableValues?.location}
				selectedValues={filterLocation}
				onSelectionChange={handleLocationChange}
			/>
		</div>

		<SearchBar
			searchQuery={searchQuery}
			onSearchChange={handleSearchChange}
		/>

		<!-- {#if filterInteraction || filterPlatform || filterPublishers || searchQuery}
			<button class="clear-filters-btn" onclick={() => {
				onFilterChange('clearAll', null);
			}}>
				Clear All
			</button>
		{/if} -->

		<button 
			class="download-csv-btn" 
			onclick={handleDownloadCSV}
			type="button"
			aria-label="Export {filteredRowCount} items"
		>
			Export {filteredRowCount} items
		</button>
	</div>
</div>

<!-- Not a filter: it changes what the cards show, not which ones, so it hangs off
     the bar rather than sitting among the controls that narrow the results -->
<div class="filter-extension">
	<label class="show-countries">
		<input type="checkbox" checked={showCountries} onchange={handleShowCountriesChange} />
		<span>Show all country flags</span>
	</label>
</div>

<style>
	.filter-bar {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin: 2rem auto 0;
		max-width: 900px;
		padding: 1.5rem;
		background-color: #fafafa;
		border: 1px solid #e0e0e0;
	}

	.filter-row-1 {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
		min-height: 44px;
	}

	@media screen and (max-width: 900px) {
		.filter-row-1 {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	.filter-row-2 {
		display: flex;
		gap: 1rem;
		align-items: flex-end;
	}

	.filter-row-2 > .location-filter {
		flex: 0 1 200px;
		min-width: 140px;
	}

	/* Hangs under the bar's right edge, sharing its ground and border so it reads
	   as part of the panel rather than a control of its own */
	.filter-extension {
		max-width: 900px;
		margin: 0 auto 2rem;
		display: flex;
		justify-content: flex-start;
	}

	.show-countries {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem 0.9rem;
		background-color: #fafafa;
		border: 1px solid #e0e0e0;
		border-top: none;
		font-size: 0.75rem;
		color: #555;
		cursor: pointer;
		user-select: none;
		white-space: nowrap;
	}

	.show-countries:hover {
		color: #1a1a1a;
	}

	.show-countries input {
		margin: 0;
		width: 13px;
		height: 13px;
		cursor: pointer;
		accent-color: #DE5A35;
	}

	/* The search bar, which takes whatever the location filter and button leave */
	.filter-row-2 > *:nth-child(2) {
		flex: 1;
		min-width: 300px;
	}

	.filter-row-2 > button {
		flex: 0 0 auto;
	}

	@media screen and (max-width: 768px) {
		.filter-bar {
			margin: 1rem 1rem 0;
			padding: 1rem;
		}

		.filter-row-1 {
			grid-template-columns: 1fr;
			gap: 0.75rem;
		}

		/* Stacked, so align-items now decides the width rather than the vertical
		   alignment: without stretch, each control shrinks to its content and sits
		   against the right edge */
		.filter-row-2 {
			flex-direction: column;
			align-items: stretch;
			gap: 0.75rem;
		}

		/* Stacked, so a flex basis would set a height rather than a width */
		.filter-row-2 > .location-filter,
		.filter-row-2 > *:nth-child(2) {
			flex: 0 0 auto;
			min-width: unset;
		}

		.filter-extension {
			margin: 0 1rem 1rem;
		}

		.download-csv-btn {
			width: 100%;
		}
	}

.download-csv-btn {
		padding: 0.6rem 1.5rem;
		background-color: #254c6f;
		color: white;
		/* Same padding, font and border width as the selects and the search box,
		   so the row of controls comes out one height */
		border: 1px solid transparent;
		border-radius: 0;
		cursor: pointer;
		font-size: 0.95rem;
		font-family: inherit;
		font-weight: 500;
		line-height: 1.2;
	}

	.download-csv-btn:hover {
		background-color: #1a3a52;
	}
</style>
