<script>
	import { onMount } from 'svelte';
	import { parseArray, matchesSearch } from './utils.js';

	/**
	 * @typedef {Object} Props
	 * @property {Array<Object>} [data=[]] - Dataset to extract interactions and types from
	 * @property {string} [label='Category'] - Label for the filter
	 * @property {string[]} [selectedInteraction=[]] - Selected interactions
	 * @property {string[]} [selectedType=[]] - Selected types
	 * @property {(values: string[]) => void} [onInteractionChange=() => {}] - Callback when interactions change
	 * @property {(values: string[]) => void} [onTypeChange=() => {}] - Callback when types change
	 */

	/** @type {Props} */
	let { 
		data = [],
		label = 'Category',
		selectedInteraction = [],
		selectedType = [],
		availableInteractions = null,
		availableTypes = null,
		onInteractionChange = () => {},
		onTypeChange = () => {}
	} = $props();

	let isOpen = $state(false);
	let searchTerm = $state('');
	let container;

	// The click has to reach the document for the other filters to notice it and
	// close; this one stays open because its own handler sees the click inside
	/**
	 * A value that would return nothing given the other filters. A selected one
	 * is never dead — it has to stay clickable to be turned off again.
	 */
	function isDead(value, available, selected) {
		if (!available || selected.includes(value)) return false;
		return !available.has(value);
	}

	function toggleOpen() {
		isOpen = !isOpen;
	}

	function getUniqueInteractions() {
		const unique = new Set();
		data.forEach(row => {
			if (row?.interaction != null) {
				parseArray(row.interaction).forEach(i => {
					if (i) {
						// Normalize to capitalize first letter for consistency
						const normalized = String(i).trim();
						if (normalized) {
							const capitalized = normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
							unique.add(capitalized);
						}
					}
				});
			}
		});
		return Array.from(unique).sort();
	}

	function getTypesByInteraction(interaction) {
		const typeSet = new Set();
		// Normalize interaction for comparison (case-insensitive)
		const target = String(interaction).trim().toLowerCase();
		data.forEach(row => {
			if (!row) return;
			const rowInteractions = parseArray(row.interaction).map(v => String(v).trim().toLowerCase());
			if (rowInteractions.includes(target)) {
				const types = parseArray(row.type);
				types.forEach(t => {
					if (t) {
						const trimmed = String(t).trim();
						if (trimmed) typeSet.add(trimmed);
					}
				});
			}
		});
		return Array.from(typeSet).sort();
	}

	function getFilteredInteractions() {
		const allInteractions = getUniqueInteractions();
		if (!searchTerm) return allInteractions;
		
		return allInteractions.filter(interaction => {
			// Include if interaction name matches
			if (matchesSearch(interaction, searchTerm)) return true;
			
			// Include if any of its types match the search
			const types = getTypesByInteraction(interaction);
			return types.some(type => matchesSearch(type, searchTerm));
		});
	}

	function getFilteredTypesForInteraction(interaction) {
		const allTypes = getTypesByInteraction(interaction);
		if (!searchTerm) return allTypes;
		
		return allTypes.filter(type => matchesSearch(type, searchTerm));
	}

	function shouldShowTypes(interaction) {
		// Show types if:
		// 1. Interaction is selected, OR
		// 2. Search term matches any type in this interaction
		if (selectedInteraction.includes(interaction)) return true;
		if (searchTerm) {
			const types = getTypesByInteraction(interaction);
			return types.some(type => matchesSearch(type, searchTerm));
		}
		return false;
	}

	function toggleInteraction(interaction) {
		const newSelected = selectedInteraction.includes(interaction)
			? selectedInteraction.filter(i => i !== interaction)
			: [...selectedInteraction, interaction];
		onInteractionChange(newSelected);
		
		// If deselecting interaction, remove types that belong only to it
		if (!newSelected.includes(interaction)) {
			const typesForThisInteraction = getTypesByInteraction(interaction);
			const remainingTypes = selectedType.filter(type => 
				!typesForThisInteraction.includes(type) || 
				newSelected.some(selInteraction => {
					const typesForSel = getTypesByInteraction(selInteraction);
					return typesForSel.includes(type);
				})
			);
			onTypeChange(remainingTypes);
		}
	}

	function toggleType(type) {
		const newSelected = selectedType.includes(type)
			? selectedType.filter(t => t !== type)
			: [...selectedType, type];
		onTypeChange(newSelected);
	}

	function getDisplayLabel() {
		if (selectedInteraction.length === 0 && selectedType.length === 0) {
			return 'All';
		}
		if (selectedInteraction.length === 1 && selectedType.length === 0) {
			return selectedInteraction[0];
		}
		return `${selectedInteraction.length + selectedType.length} selected`;
	}

	function handleClickOutside(event) {
		if (container && !container.contains(event.target)) {
			isOpen = false;
		}
	}

	function handleKeydown(event) {
		if (event.key === 'Escape') {
			isOpen = false;
			buttonRef?.focus();
		}
	}

	function stopPropagation(event) {
		event.stopPropagation();
	}

	function clearAll(event) {
		event.stopPropagation();
		onInteractionChange([]);
		onTypeChange([]);
	}

	function handleSearchInput(event) {
		stopPropagation(event);
	}

	let buttonRef;

	onMount(() => {
		document.addEventListener('click', handleClickOutside);
		document.addEventListener('keydown', handleKeydown);
		return () => {
			document.removeEventListener('click', handleClickOutside);
			document.removeEventListener('keydown', handleKeydown);
		};
	});

	const filteredInteractions = $derived(getFilteredInteractions());
</script>

<div class="hierarchical-filter-container" bind:this={container}>
	<label class="hierarchical-label">{label}</label>
	
	<div class="hierarchical-filter">
		<button 
			class="dropdown-toggle"
			type="button"
			bind:this={buttonRef}
			onclick={toggleOpen}
			aria-haspopup="listbox"
			aria-expanded={isOpen}
			aria-label="{label} filter"
		>
			<span class="toggle-text">{getDisplayLabel()}</span>
			<span class="toggle-arrow" class:open={isOpen}>▼</span>
		</button>

		{#if isOpen}
			<div class="dropdown-menu" onclick={stopPropagation} role="listbox" aria-label="{label} filter options">
				<div class="menu-header">
					<span class="header-text" aria-live="polite">
						{selectedInteraction.length + selectedType.length} selected
					</span>
					{#if selectedInteraction.length > 0 || selectedType.length > 0}
						<button 
							class="clear-link" 
							onclick={clearAll}
							aria-label="Clear all selections"
							type="button"
						>
							Clear
						</button>
					{/if}
				</div>

				<div class="search-box">
					<input 
						type="text"
						placeholder="Search interactions and types..."
						bind:value={searchTerm}
						class="search-input"
						onclick={handleSearchInput}
						oninput={handleSearchInput}
						aria-label="Search interactions and types"
					/>
				</div>

				<div class="menu-content">
					{#if filteredInteractions.length === 0}
						<div class="no-results">No results found</div>
					{:else}
						{#each filteredInteractions as interaction}
							<div class="interaction-section">
								<label
									class="interaction-item"
									class:unavailable={isDead(interaction, availableInteractions, selectedInteraction)}
								>
									<input 
										type="checkbox"
										checked={selectedInteraction.includes(interaction)}
										disabled={isDead(interaction, availableInteractions, selectedInteraction)}
										onchange={() => toggleInteraction(interaction)}
										class="checkbox"
									/>
									<span class="interaction-text">{interaction}</span>
								</label>

								{#if shouldShowTypes(interaction)}
									<div class="types-section">
										{#each getFilteredTypesForInteraction(interaction) as type}
											<label
												class="type-item"
												class:unavailable={isDead(type, availableTypes, selectedType)}
											>
												<input 
													type="checkbox"
													checked={selectedType.includes(type)}
													disabled={isDead(type, availableTypes, selectedType)}
													onchange={() => toggleType(type)}
													class="checkbox"
												/>
												<span class="type-text">{type}</span>
											</label>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.hierarchical-filter-container {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 100%;
		position: relative;
	}

	.hierarchical-label {
		font-weight: 400;
		font-size: 0.7rem;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.hierarchical-filter {
		position: relative;
		width: 100%;
	}

	.dropdown-toggle {
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
		appearance: none;
		-webkit-appearance: none;
		-moz-appearance: none;
		background-image: none;
		background-clip: padding-box;
	}

	.dropdown-toggle:hover {
		border-color: #999;
	}

	.dropdown-toggle::after,
	.dropdown-toggle::before {
		display: none;
	}

	.toggle-text {
		flex: 1;
		text-align: left;
		color: #999;
	}

	.toggle-arrow {
		margin-left: 0.5rem;
		flex-shrink: 0;
		font-size: 0.75rem;
		transition: transform 0.2s ease;
	}

	.toggle-arrow.open {
		transform: rotate(180deg);
	}

	.dropdown-menu {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		background-color: #fff;
		border: 1px solid #ccc;
		z-index: 1000;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		max-height: 350px;
		display: flex;
		flex-direction: column;
	}

	.menu-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.6rem 0.8rem;
		border-bottom: 1px solid #eee;
		background-color: #fff;
		font-size: 0.85rem;
		flex-shrink: 0;
	}

	.header-text {
		color: #666;
	}

	.clear-link {
		background: none;
		border: none;
		color: #0066cc;
		cursor: pointer;
		font-size: 0.85rem;
		padding: 0;
	}

	.clear-link:hover {
		color: #0052a3;
		text-decoration: underline;
	}

	.search-box {
		padding: 0;
		border-bottom: 1px solid #eee;
		flex-shrink: 0;
	}

	.search-input {
		width: 100%;
		padding: 0.6rem 0.8rem;
		border: none;
		font-size: 0.9rem;
		font-family: inherit;
		box-sizing: border-box;
		background-color: #fff;
		color: #333;
	}

	.search-input::placeholder {
		color: #999;
	}

	.search-input:focus {
		outline: none;
		background-color: #f9f9f9;
	}

	.menu-content {
		padding: 0.25rem 0;
		max-height: 250px;
		overflow-y: auto;
		flex: 1;
	}

	.no-results {
		padding: 1rem 0.8rem;
		color: #999;
		text-align: center;
		font-size: 0.9rem;
	}

	.interaction-section {
		border-bottom: none;
	}

	.interaction-item {
		display: flex;
		align-items: center;
		padding: 0.5rem 0.8rem;
		cursor: pointer;
		background-color: #fff;
		font-size: 0.95rem;
		user-select: none;
		color: #333;
	}

	/* Nothing left to find under it, given the other filters */
	.interaction-item.unavailable,
	.type-item.unavailable {
		color: #bbb;
		cursor: default;
	}

	.interaction-item.unavailable:hover,
	.type-item.unavailable:hover {
		background-color: transparent;
	}

	.interaction-item.unavailable .checkbox,
	.type-item.unavailable .checkbox {
		cursor: default;
	}

	.interaction-item:hover {
		background-color: #f5f5f5;
	}

	.interaction-text {
		flex: 1;
		font-weight: 500;
	}

	.types-section {
		background-color: #fafafa;
		padding: 0;
	}

	.type-item {
		display: flex;
		align-items: center;
		padding: 0.5rem 0.8rem 0.5rem 2rem;
		cursor: pointer;
		font-size: 0.95rem;
		user-select: none;
		color: #333;
	}

	.type-item:hover {
		background-color: #f0f0f0;
	}

	.type-text {
		flex: 1;
	}

	.checkbox {
		width: 16px;
		height: 16px;
		margin-right: 0.5rem;
		cursor: pointer;
		accent-color: #DE5A35;
		flex-shrink: 0;
	}

	.menu-footer {
		padding: 0;
		border-top: 1px solid #eee;
		background-color: #f9f9f9;
		flex-shrink: 0;
	}

	.done-btn {
		width: 100%;
		padding: 0.6rem 0.8rem;
		background-color: #254c6f;
		color: white;
		border: none;
		cursor: pointer;
		font-size: 0.95rem;
		font-family: inherit;
		font-weight: 500;
	}

	.done-btn:hover {
		background-color: #1a3a52;
	}

	@media screen and (max-width: 768px) {
		.dropdown-menu {
			position: fixed;
			top: auto;
			bottom: 0;
			left: 0;
			right: 0;
			max-height: 70vh;
			border-radius: 8px 8px 0 0;
			box-shadow: 0 -2px 16px rgba(0, 0, 0, 0.2);
		}

		.hierarchical-filter-container {
			width: 100%;
		}

		/* The sheet is already capped at 70vh; a second cap here left the rest of
		   it empty and the list scrolling in a 250px window */
		.menu-content {
			max-height: none;
		}

		.search-input {
			font-size: 16px; /* Prevents zoom on iOS */
		}

		/* Room enough to hit with a thumb */
		.interaction-item {
			padding-top: 0.75rem;
			padding-bottom: 0.75rem;
		}

		.type-item {
			padding-top: 0.75rem;
			padding-bottom: 0.75rem;
		}
	}
</style>