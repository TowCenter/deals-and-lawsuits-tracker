<script>
	import FilterBar from './FilterBar.svelte';

	let {
		data = [],
		searchQuery = $bindable(''),
		filterInteraction = $bindable([]),
		filterType = $bindable([]),
		filterPlatform = $bindable([]),
		filterPublishers = $bindable([]),
		filterLocation = $bindable([]),
		showCountries = $bindable(false),
		availableValues = null,
		filteredRowCount = 0,
		onDownloadCSV = () => {}
	} = $props();

	function handleFilterChange(filterName, value) {
		if (filterName === 'clearAll') {
			filterInteraction = [];
			filterType = [];
			filterPlatform = [];
			filterPublishers = [];
			filterLocation = [];
			showCountries = false;
			searchQuery = '';
		} else if (filterName === 'filterInteraction') {
			filterInteraction = value;
		} else if (filterName === 'filterType') {
			filterType = value;
		} else if (filterName === 'filterPlatform') {
			filterPlatform = value;
		} else if (filterName === 'filterPublishers') {
			filterPublishers = value;
		} else if (filterName === 'filterLocation') {
			filterLocation = value;
		} else if (filterName === 'showCountries') {
			showCountries = value;
		} else if (filterName === 'searchQuery') {
			searchQuery = value;
		}
	}
</script>

<FilterBar
	{data}
	{filterInteraction}
	{filterType}
	{filterPlatform}
	{filterPublishers}
	{filterLocation}
	{showCountries}
	{availableValues}
	{searchQuery}
	{filteredRowCount}
	onDownloadCSV={onDownloadCSV}
	onFilterChange={handleFilterChange}
/>
