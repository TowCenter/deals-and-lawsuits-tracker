<script>
	import { onMount } from 'svelte';

	/**
	 * @typedef {Object} Props
	 * @property {string} [label='Select'] - Label for the multi-select
	 * @property {string[]} [options=[]] - Available options
	 * @property {string[]} [selectedValues=[]] - Currently selected values
	 * @property {(values: string[]) => void} [onSelectionChange=() => {}] - Callback when selection changes
	 * @property {Set<string>} [availableValues] - Values that can still return rows; the rest are shown greyed and cannot be picked
	 * @property {Array<{label: string, options: string[], implied?: string[]}>} [groups] - Options under headings, in place of one flat list. A heading also selects its `implied` values, which are not listed as rows.
	 */

	/** @type {Props} */
	let {
		label = 'Select',
		options = [],
		selectedValues = [],
		onSelectionChange = () => {},
		groups = null,
		availableValues = null
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

	/**
	 * An option that would return nothing given the other filters. A selected one
	 * is never dead — it has to stay clickable to be turned off again.
	 */
	function isUnavailable(option) {
		if (!availableValues || selectedValues.includes(option)) return false;
		return !availableValues.has(option);
	}

	function matchesSearch(option) {
		if (!searchQuery) return true;
		return option.toLowerCase().includes(searchQuery.toLowerCase());
	}

	function getFilteredOptions() {
		return options.filter(matchesSearch);
	}

	/**
	 * Groups with their non-matching options dropped, and the emptied ones with
	 * them. A group whose own name matches keeps everything under it.
	 */
	function getFilteredGroups() {
		if (!groups) return [];
		return groups
			.map(group => (matchesSearch(group.label)
				? group
				: { ...group, options: group.options.filter(matchesSearch) }))
			.filter(group => group.options.length > 0 || matchesSearch(group.label));
	}

	/** Everything a group's heading selects, including what it stands in for */
	function getGroupValues(group) {
		return [...group.options, ...(group.implied || [])];
	}

	/** Whether all, some or none of what a group covers is selected */
	function getGroupState(group) {
		const values = getGroupValues(group);
		const chosen = values.filter(value => selectedValues.includes(value)).length;
		return { all: chosen === values.length, some: chosen > 0 };
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

	// Selecting a group selects the options in it, so the filter stays a list of
	// countries and a continent is a shorthand for reaching them. Dead options are
	// left out, so a continent never selects something that returns nothing.
	function toggleGroup(group, event) {
		event?.stopPropagation();
		const values = getGroupValues(group).filter(value => !isUnavailable(value));
		const { all } = getGroupState(group);
		const newSelection = all
			? selectedValues.filter(value => !values.includes(value))
			: [...selectedValues, ...values.filter(value => !selectedValues.includes(value))];
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
		class:unavailable={isUnavailable(option)}
		role="option"
		aria-selected={selectedValues.includes(option)}
	>
		<input
			type="checkbox"
			checked={selectedValues.includes(option)}
			disabled={isUnavailable(option)}
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
								aria-label="Select all of {group.label}"
							/>
							<button
								type="button"
								class="group-toggle"
								onclick={() => toggleGroupOpen(group)}
								aria-expanded={open}
							>
								<span class="group-name">{group.label}</span>
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
		display: flex;
		flex-direction: column;
	}

	.dropdown-header {
		padding: 0.6rem 0.8rem;
		border-bottom: 1px solid #eee;
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.85rem;
		color: #666;
		background-color: #fff;
		flex-shrink: 0;
	}

	.clear-all-btn {
		background: none;
		border: none;
		color: #0066cc;
		cursor: pointer;
		font-size: 0.85rem;
		padding: 0;
	}

	.clear-all-btn:hover {
		color: #0052a3;
		text-decoration: underline;
	}

	.dropdown-search {
		width: 100%;
		padding: 0.6rem 0.8rem;
		border: none;
		border-bottom: 1px solid #eee;
		font-size: 0.9rem;
		font-family: inherit;
		box-sizing: border-box;
		background-color: #fff;
		color: #333;
		flex-shrink: 0;
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
		overflow-y: auto;
		flex: 1;
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
		color: #333;
	}

	.checkbox-label:hover {
		background-color: #f5f5f5;
	}

	/* Nothing left to find under it, given the other filters */
	.checkbox-label.unavailable {
		color: #bbb;
		cursor: default;
	}

	.checkbox-label.unavailable:hover {
		background-color: transparent;
	}

	.checkbox-label.unavailable input {
		cursor: default;
	}

	/* A continent heading, set like the Category filter's parent rows: the box
	   selects every country under it, the rest of the row opens it. Sticks to the
	   top so the continent stays named while its countries scroll past */
	.group-label {
		display: flex;
		align-items: center;
		position: sticky;
		top: 0;
		z-index: 1;
		background-color: #fff;
		padding: 0 0.8rem;
	}

	.group-label:hover {
		background-color: #f5f5f5;
	}

	.group-toggle {
		display: flex;
		align-items: center;
		flex: 1;
		gap: 0.5rem;
		padding: 0.5rem 0;
		background: none;
		border: none;
		cursor: pointer;
		font-family: inherit;
		font-size: 0.95rem;
		font-weight: 500;
		color: #333;
		text-align: left;
	}

	.group-name {
		flex: 1;
	}

	.group-arrow {
		font-size: 0.6rem;
		color: #999;
		transition: transform 0.2s;
	}

	.group-arrow.open {
		transform: rotate(180deg);
	}

	/* The countries of an open continent, tinted and indented as its children */
	.group-options {
		background-color: #fafafa;
	}

	.in-group {
		padding-left: 2rem;
	}

	.dropdown-options input[type="checkbox"] {
		width: 16px;
		height: 16px;
		margin-right: 0.5rem;
		cursor: pointer;
		accent-color: #DE5A35;
		flex-shrink: 0;
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

		.dropdown-search {
			font-size: 16px; /* Prevents zoom on iOS */
		}

		/* Room enough to hit with a thumb */
		.checkbox-label {
			padding-top: 0.75rem;
			padding-bottom: 0.75rem;
		}

		.group-toggle {
			padding-top: 0.75rem;
			padding-bottom: 0.75rem;
		}
	}
</style>
