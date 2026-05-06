<script>
	import { onMount } from 'svelte';

	/**
	 * @typedef {Object} Props
	 * @property {string} [label='Select'] - Label for the multi-select
	 * @property {string[]} [options=[]] - Available options
	 * @property {string[]} [selectedValues=[]] - Currently selected values
	 * @property {(values: string[]) => void} [onSelectionChange=() => {}] - Callback when selection changes
	 */

	/** @type {Props} */
	let { 
		label = 'Select',
		options = [],
		selectedValues = [],
		onSelectionChange = () => {}
	} = $props();

	let isOpen = $state(false);
	let searchQuery = $state('');
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

	function getFilteredOptions() {
		if (!searchQuery) return options;
		const query = searchQuery.toLowerCase();
		return options.filter(option => option.toLowerCase().includes(query));
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
				{#each getFilteredOptions() as option (option)}
					<label class="checkbox-label" role="option" aria-selected={selectedValues.includes(option)}>
						<input
							type="checkbox"
							checked={selectedValues.includes(option)}
							onchange={(e) => toggleSelection(option, e)}
							aria-label="{option}"
						/>
						<span>{option}</span>
					</label>
				{:else}
					<div class="no-results" role="status">No results found</div>
				{/each}
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

	.dropdown-options {
		padding: 0.5rem 0;
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
