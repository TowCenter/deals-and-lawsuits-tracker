<script>
	import { onMount } from 'svelte';

	/**
	 * @typedef {Object} Props
	 * @property {string} [label='Select'] - Label for the multi-select
	 * @property {string[]} [options=[]] - Available options
	 * @property {string[]} [selectedValues=[]] - Currently selected values
	 * @property {(values: string[]) => void} [onSelectionChange=() => {}] - Callback when selection changes
	 * @property {Array<{label: string, options: string[]}>} [groups] - Options under headings, in place of one flat list
	 */

	/** @type {Props} */
	let {
		label = 'Select',
		options = [],
		selectedValues = [],
		onSelectionChange = () => {},
		groups = null
	} = $props();

	let isOpen = $state(false);
	let searchQuery = $state('');
	let openGroups = $state(new Set());
	let containerRef;
	let buttonRef;

	function toggleSelection(value, event) {
		event?.stopPropagation();
		const newSelection = selectedValues.includes(value)
			? selectedValues.filter(v => v !== value)
			: [...selectedValues, value];
		onSelectionChange(newSelection);
	}

	function clearSelection(event) {
		event?.stopPropagation();
		onSelectionChange([]);
	}

	function getDisplayText() {
		if (selectedValues.length === 0) return 'All';
		if (selectedValues.length === 1) return selectedValues[0];
		return `${selectedValues.length} selected`;
	}

	function matchesSearch(option) {
		if (!searchQuery) return true;
		return option.toLowerCase().includes(searchQuery.toLowerCase());
	}

	function getFilteredOptions() {
		return options.filter(matchesSearch);
	}

	/** Groups with their non-matching options dropped, and the emptied ones with them */
	function getFilteredGroups() {
		if (!groups) return [];
		return groups
			.map(group => ({ ...group, options: group.options.filter(matchesSearch) }))
			.filter(group => group.options.length > 0);
	}

	/** Whether all, some or none of a group's options are selected */
	function getGroupState(group) {
		const chosen = group.options.filter(option => selectedValues.includes(option)).length;
		return { all: chosen === group.options.length, some: chosen > 0 };
	}

	/**
	 * Groups start closed, and open when opened by hand, when something in them
	 * is selected, or when a search has narrowed them to what it matched
	 */
	function isGroupOpen(group) {
		return openGroups.has(group.label) || Boolean(searchQuery) || getGroupState(group).some;
	}

	function toggleGroupOpen(group) {
		const next = new Set(openGroups);
		if (next.has(group.label)) next.delete(group.label);
		else next.add(group.label);
		openGroups = next;
	}

	// Selecting a region selects the countries in it, so the filter stays a list
	// of countries and a region is a shorthand for reaching them
	function toggleGroup(group, event) {
		event?.stopPropagation();
		const { all } = getGroupState(group);
		const newSelection = all
			? selectedValues.filter(value => !group.options.includes(value))
			: [...selectedValues, ...group.options.filter(option => !selectedValues.includes(option))];
		onSelectionChange(newSelection);
	}

	function handleClickOutside(event) {
		if (containerRef && !containerRef.contains(event.target)) {
			isOpen = false;
		}
	}

	function handleKeydown(event) {
		if (event.key === 'Escape') {
			isOpen = false;
			buttonRef?.focus();
		}
	}

	onMount(() => {
		document.addEventListener('click', handleClickOutside);
		document.addEventListener('keydown', handleKeydown);
		return () => {
			document.removeEventListener('click', handleClickOutside);
			document.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

<!-- One selectable option, indented when it sits under a group heading -->
{#snippet optionRow(option, indented)}
	<label
		class="checkbox-label"
		class:in-group={indented}
		role="option"
		aria-selected={selectedValues.includes(option)}
	>
		<input
			type="checkbox"
			checked={selectedValues.includes(option)}
			onchange={(e) => toggleSelection(option, e)}
			aria-label="{option}"
		/>
		<span>{option}</span>
	</label>
{/snippet}

<div class="multiselect-container" bind:this={containerRef}>
	<label class="multiselect-label" for="multiselect-trigger-{label}">{label}</label>
	<button 
		id="multiselect-trigger-{label}"
		class="multiselect-trigger"
		bind:this={buttonRef}
		onclick={() => isOpen = !isOpen}
		aria-haspopup="listbox"
		aria-expanded={isOpen}
		aria-label="{label} selector"
		type="button"
	>
		<span class="trigger-text">{getDisplayText()}</span>
		<span class="trigger-arrow" class:open={isOpen} aria-hidden="true">▼</span>
	</button>

	{#if isOpen}
		<div class="multiselect-dropdown" role="listbox" aria-label="{label} options">
			<div class="dropdown-header">
				<span aria-live="polite">{selectedValues.length} of {options.length} selected</span>
				{#if selectedValues.length > 0}
					<button 
						class="clear-all-btn" 
						onclick={clearSelection}
						aria-label="Clear all selections"
						type="button"
					>
						Clear
					</button>
				{/if}
			</div>
			<input 
				type="text" 
				class="dropdown-search"
				placeholder="Search..."
				bind:value={searchQuery}
				onclick={(e) => e.stopPropagation()}
				aria-label="Search options"
			/>
			<div class="dropdown-options" role="group">
				{#if groups}
					{#each getFilteredGroups() as group (group.label)}
						{@const state = getGroupState(group)}
						{@const open = isGroupOpen(group)}
						<div class="group-label">
							<input
								type="checkbox"
								checked={state.all}
								indeterminate={state.some && !state.all}
								onchange={(e) => toggleGroup(group, e)}
								aria-label="Select all {group.options.length} in {group.label}"
							/>
							<button
								type="button"
								class="group-toggle"
								onclick={() => toggleGroupOpen(group)}
								aria-expanded={open}
							>
								<span class="group-name">{group.label}</span>
								<span class="group-count">{group.options.length}</span>
								<span class="group-arrow" class:open aria-hidden="true">▼</span>
							</button>
						</div>
						{#if open}
							<div class="group-options">
								{#each group.options as option (option)}
									{@render optionRow(option, true)}
								{/each}
							</div>
						{/if}
					{:else}
						<div class="no-results" role="status">No results found</div>
					{/each}
				{:else}
					{#each getFilteredOptions() as option (option)}
						{@render optionRow(option, false)}
					{:else}
						<div class="no-results" role="status">No results found</div>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.multiselect-container {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 100%;
	}

	.multiselect-label {
		font-weight: 400;
		font-size: 0.7rem;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.multiselect-trigger {
		width: 100%;
		padding: 0.6rem 0.8rem;
		background-color: #fff;
		border: 1px solid #ccc;
		border-radius: 0;
		cursor: pointer;
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.95rem;
		font-family: inherit;
		line-height: 1.2;
	}

	.multiselect-trigger:hover {
		border-color: #999;
	}

	.trigger-text {
		flex: 1;
		text-align: left;
		color: #999;
	}

	.trigger-arrow {
		font-size: 0.7rem;
		transition: transform 0.2s;
		margin-left: 0.5rem;
		flex-shrink: 0;
	}

	.trigger-arrow.open {
		transform: rotate(180deg);
	}

	.multiselect-dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		background-color: #fff;
		border: 1px solid #ccc;
		border-top: none;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		z-index: 1000;
		max-height: 300px;
		overflow-y: auto;
	}

	.dropdown-header {
		padding: 0.75rem 0.8rem;
		border-bottom: 1px solid #eee;
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.85rem;
		background-color: #f9f9f9;
	}

	.clear-all-btn {
		background: none;
		border: none;
		color: #254c6f;
		cursor: pointer;
		font-size: 0.8rem;
		padding: 0;
		text-decoration: underline;
	}

	.clear-all-btn:hover {
		color: #1a3a52;
	}

	.dropdown-search {
		width: 100%;
		padding: 0.6rem 0.8rem;
		border: none;
		border-bottom: 1px solid #eee;
		font-size: 0.9rem;
		font-family: inherit;
		box-sizing: border-box;
	}

	.dropdown-search:focus {
		outline: none;
		background-color: #f9f9f9;
	}

	.dropdown-search::placeholder {
		color: #999;
	}

	/* No padding at the top: a group heading sticks there, and a gap above it
	   would show the options sliding through */
	.dropdown-options {
		padding: 0 0 0.5rem;
	}

	.no-results {
		padding: 1rem 0.8rem;
		text-align: center;
		color: #999;
		font-size: 0.9rem;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		padding: 0.5rem 0.8rem;
		cursor: pointer;
		font-size: 0.95rem;
		user-select: none;
	}

	.checkbox-label:hover {
		background-color: #f5f5f5;
	}

	/* A region heading: the box selects every country under it, the rest of the
	   row opens the region. Sticks to the top of the list so the region stays
	   named while its countries scroll past */
	.group-label {
		display: flex;
		align-items: center;
		position: sticky;
		top: 0;
		z-index: 1;
		background-color: #fff;
		border-bottom: 1px solid #eee;
		padding: 0 0.8rem;
	}

	.group-label input[type="checkbox"] {
		margin-right: 0.5rem;
		cursor: pointer;
		accent-color: #DE5A35;
	}

	.group-toggle {
		display: flex;
		align-items: center;
		flex: 1;
		gap: 0.5rem;
		padding: 0.55rem 0;
		background: none;
		border: none;
		cursor: pointer;
		font-family: inherit;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #555;
		text-align: left;
	}

	.group-toggle:hover {
		color: #1a1a1a;
	}

	.group-name {
		flex: 1;
	}

	.group-count {
		font-weight: 400;
		color: #aaa;
		font-variant-numeric: tabular-nums;
	}

	.group-arrow {
		font-size: 0.55rem;
		color: #999;
		transition: transform 0.2s;
	}

	.group-arrow.open {
		transform: rotate(180deg);
	}

	/* The countries of an open region, tinted and indented as its children */
	.group-options {
		background-color: #fafafa;
	}

	.in-group {
		padding-left: 2rem;
	}

	.checkbox-label input[type="checkbox"] {
		margin-right: 0.5rem;
		cursor: pointer;
		accent-color: #DE5A35;
	}

	.checkbox-label span {
		flex: 1;
	}

	@media screen and (max-width: 768px) {
		.multiselect-dropdown {
			position: fixed;
			top: auto;
			bottom: 0;
			left: 0;
			right: 0;
			max-height: 70vh;
			border-radius: 8px 8px 0 0;
			box-shadow: 0 -2px 16px rgba(0, 0, 0, 0.2);
		}

		.multiselect-container {
			width: 100%;
		}
	}
</style>
