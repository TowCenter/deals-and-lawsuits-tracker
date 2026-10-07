<script>
	import { isMdlConsolidation } from './mdl.js';
	import { buildOwnershipGraph, publisherNames, normalizeName } from './publisherNetwork.js';
	import PublisherNetwork from './PublisherNetwork.svelte';
	import CardView from './CardView.svelte';
	let networkRow = $state(null);
	import { parseArray, formatDate, buildCountryIndex, getPlacesForName, getRowLocations } from './utils.js';

	/**
	 * @typedef {Object} Props
	 * @property {Array<number|string>|null} [focusedRecordIds=null] - Records to display collapsed in the network panel
	 * @property {number|string|null} [focusedRecordId=null] - Record to display in the detail dialog
	 * @property {Array<Object>} [data=[]] - Card data rows
	 * @property {string} [searchQuery=''] - Search query string
	 * @property {string[]} [filterInteraction=[]] - Filter by interactions
	 * @property {string[]} [filterType=[]] - Filter by types
	 * @property {string[]} [filterPlatform=[]] - Filter by platforms
	 * @property {string[]} [filterPublishers=[]] - Filter by publishers
	 * @property {string[]} [filterLocation=[]] - Filter by locations
	 * @property {boolean} [showCountries=false] - Show the country code beside every name
	 * @property {(data: Array<Object>) => void} [onFilteredDataChange=() => {}] - Callback when filtered data changes
	 * @property {(values: Object<string, Set<string>>) => void} [onAvailableValuesChange=() => {}] - Callback with the values each filter can still return rows for
	 */

	/** @type {Props} */
	let {
		data = [],
		focusedRecordId = null,
		focusedRecordIds = null,
		searchQuery = '',
		filterInteraction = [],
		filterType = [],
		filterPlatform = [],
		filterPublishers = [],
		filterLocation = [],
		showCountries = false,
		onFilteredDataChange = () => {},
		onAvailableValuesChange = () => {}
	} = $props();

	// Countries only show while one is being filtered on — on a card of forty
	// titles the same code otherwise repeats down the whole column, and there is
	// no question it answers
	const countriesVisible = $derived(showCountries || filterLocation?.length > 0);

	/**
	 * The flags a name shows. The toggle asks for every country the data gives a
	 * name; filtering alone asks only for the country being filtered on, since
	 * the rest are not what the reader is looking at.
	 * @param {Object} row - Data row the name is shown on
	 * @param {string} name - Name as displayed
	 * @returns {Array<{country: string, label: string}>}
	 */
	function visiblePlaces(row, name) {
		if (!countriesVisible) return [];

		const places = getPlacesForName(countryIndex, row, name);
		if (showCountries) return places;

		return places.filter(place => filterLocation.includes(place.country));
	}

	let expandedCards = $state(new Set());
	$effect(() => { if (focusedRecordId != null) expandedCards = new Set([focusedRecordId]); });
	
	// True for a card shown because another card links to it, not the card being viewed
	function isRelatedCardInFilteredView(row) {
		if (viewingRelatedTo == null || row.id === viewingRelatedTo) return false;
		const sourceRow = idToRowMap.get(viewingRelatedTo);
		return Array.isArray(sourceRow?.linked_entry_ids) && sourceRow.linked_entry_ids.includes(row.id);
	}
	
	// Helper to check if a card is expanded
	function isCardExpanded(rowId) {
		return expandedCards.has(rowId);
	}
	
	// ID of the card whose related items we're viewing, or null for all
	let viewingRelatedTo = $state(null);

	// Track the last viewingRelatedTo to detect when it changes
	let lastViewingRelatedTo = null;

	// Related cards start expanded when entering the related view (only once)
	$effect(() => {
		if (viewingRelatedTo === lastViewingRelatedTo) return;
		lastViewingRelatedTo = viewingRelatedTo;
		if (viewingRelatedTo == null) return;

		const sourceRow = idToRowMap.get(viewingRelatedTo);
		if (!Array.isArray(sourceRow?.linked_entry_ids)) return;
		expandedCards = new Set([...expandedCards, ...sourceRow.linked_entry_ids]);
	});

	// Esc to dismiss the related view
	$effect(() => {
		if (viewingRelatedTo == null || typeof window === 'undefined') return;
		const onKey = (e) => { if (e.key === 'Escape') viewAllCards(); };
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	function isSourceCard(row) {
		return viewingRelatedTo != null && row.id === viewingRelatedTo;
	}

	// Country lookup for the flags shown beside org and publication names. Built
	// once over the whole dataset so a name missing a country on its own row can
	// still borrow the one it carries elsewhere.
	const countryIndex = $derived(buildCountryIndex(data));

	// Create ID-to-row lookup map for efficient related card access
	const idToRowMap = $derived.by(() => {
		const map = new Map();
		for (const row of data) {
			if (row.id != null) {
				map.set(row.id, row);
			}
		}
		return map;
	});

	/**
	 * Groups rows that share a lawsuit_id — these are the SAME case at different
	 * points in time, not related cases. Only cases with more than one entry are
	 * kept; a single-entry case renders exactly as it always has.
	 * @returns {Map<string, Object[]>} lawsuit_id -> entries sorted oldest first
	 */
 const networkAvailability = $derived.by(() => {
  const graph = buildOwnershipGraph(data), componentByKey = new Map(), recordsByComponent = new Map();
  let component = 0;
  for (const key of graph.keys()) {
   if (componentByKey.has(key)) continue;
   const pending = [key];
   componentByKey.set(key, component);
   while (pending.length) {
    for (const neighbor of graph.get(pending.pop())?.neighbors || []) if (!componentByKey.has(neighbor)) { componentByKey.set(neighbor,component); pending.push(neighbor); }
   }
   component++;
  }
  for (const record of data) {
   if (isMdlConsolidation(record)) continue;
   for (const group of new Set(publisherNames(record).map(name => componentByKey.get(normalizeName(name))).filter(value => value != null))) {
    if (!recordsByComponent.has(group)) recordsByComponent.set(group, []);
    recordsByComponent.get(group).push(record);
   }
  }
  const availability = new Map();
  for (const record of data) {
   const ids = new Set(record.lawsuit_ids || (record.lawsuit_id ? [record.lawsuit_id] : []));
   const candidates = publisherNames(record).flatMap(name => recordsByComponent.get(componentByKey.get(normalizeName(name))) || []);
   availability.set(record.id, candidates.some(other => other.id !== record.id &&
    !(record.lawsuit_id && other.lawsuit_id === record.lawsuit_id) &&
    !(other.lawsuit_ids || []).some(id => ids.has(id))));
  }
  return availability;
 });

	const caseGroups = $derived.by(() => {
		const groups = new Map();
		for (const row of data) {
			const caseId = row.lawsuit_id;
			if (!caseId) continue;
			if (!groups.has(caseId)) groups.set(caseId, []);
			groups.get(caseId).push(row);
		}
		for (const [caseId, entries] of groups) {
			if (entries.length < 2) {
				groups.delete(caseId);
				continue;
			}
			entries.sort((a, b) => parseDate(a.date || '').getTime() - parseDate(b.date || '').getTime());
		}
		return groups;
	});

	/**
	 * Returns every entry of the case this row belongs to, or null if the row is
	 * not part of a multi-entry case.
	 * @param {Object} row - Data row
	 * @returns {Object[]|null} Case entries, oldest first
	 */
	function getCaseEntries(row) {
		if (!row?.lawsuit_id) return null;
		return caseGroups.get(row.lawsuit_id) || null;
	}

	/** True when two rows are entries of the same case. */
	function isSameCase(rowA, rowB) {
		if (!rowA?.lawsuit_id || !rowB?.lawsuit_id) return false;
		return rowA.lawsuit_id === rowB.lawsuit_id && caseGroups.has(rowA.lawsuit_id);
	}

	/**
	 * Every status this case has moved through, oldest first. The same chronology
	 * shows on every card of the case, each marking its own step, so a reader who
	 * lands on any single entry can see where it sits in the case.
	 * @param {Object} row - Data row
	 * @returns {Object[]} Status changes in chronological order, preserving the first date of each change
	 */
	function getStatusProgression(row) {
		const changes = [];
        // Lawsuit IDs identify cases; MDL IDs identify their shared proceeding.
        const individualIds = (item) => (item.lawsuit_ids || [item.lawsuit_id]).filter(Boolean);
        const ids = new Set(individualIds(row));
        const history = data.filter(item => individualIds(item).some(id => ids.has(id)))
            .sort((a, b) => parseDate(a.date || '').getTime() - parseDate(b.date || '').getTime());
        for (const entry of history) {
            const rawStatus = String(entry.status || '').trim();
            const status = /^initiated\s*\/\s*in progress$/i.test(rawStatus) ? 'Initiated'
                : rawStatus;
            if (!status) continue;
            const key = status.toLowerCase().replace(/\s+/g, ' ');
            const previous = changes[changes.length - 1];
            if (previous?.statusKey === key) {
                previous.entryIds.push(entry.id);
            } else {
                changes.push({ ...entry, status, statusKey: key, entryIds: [entry.id] });
            }
        }
        return changes;
	}

	// Reveals an earlier or later entry of the same case: expands it and brings it
	// into view. Cards are already in the DOM, so this is a scroll, not a filter.
	function goToCaseEntry(entryId) {
		expandedCards = new Set([...expandedCards, entryId]);
		if (typeof document === 'undefined') return;
		requestAnimationFrame(() => {
			const el = document.getElementById(`card-${entryId}`);
			if (!el) return;
			el.scrollIntoView({ behavior: 'smooth', block: 'center' });
			el.classList.add('case-flash');
			setTimeout(() => el.classList.remove('case-flash'), 1200);
		});
	}

	/**
	 * Maps a status string to its indicator class.
	 * @param {string} status - Raw status value
	 * @returns {string} Status class
	 */
	function getStatusClass(status) {
		const normalized = String(status || '').toLowerCase().trim();
		if (!normalized) return 'default';
		if (normalized.includes('progress') || normalized.includes('pending') || normalized.includes('ongoing')) return 'in-progress';
		if (normalized.includes('settled') || normalized.includes('resolved') || normalized.includes('closed') || normalized.includes('summary judgement')) return 'settled';
		if (normalized.includes('dismissed') || normalized.includes('dropped')) return 'dismissed';
		if (normalized.includes('judgement') || normalized.includes('judgment') || normalized.includes('decided')) return 'decided';
		if (normalized.includes('consolidated') || normalized.includes('amended')) return 'consolidated';
		return 'default';
	}


	// Memoization caches
	const allPublishersCache = new WeakMap();
	const hierarchyTreeCache = new Map();
	const archiveInfoCache = new Map();
	const sourceDisplayTextCache = new Map();
	const parseDateCache = new Map();
	const getHostnameCache = new Map();
	const extractHierarchyOrgsCache = new Map();

	// Memoization helper for functions with object parameters
	function memoizeObject(fn, cache) {
		return function(...args) {
			const key = args[0]; // First argument is the object
			if (cache.has(key)) {
				return cache.get(key);
			}
			const result = fn.apply(this, args);
			cache.set(key, result);
			return result;
		};
	}

	// Memoization helper for functions with primitive parameters
	function memoizePrimitive(fn, cache, maxSize = 1000) {
		return function(...args) {
			const key = JSON.stringify(args);
			if (cache.has(key)) {
				return cache.get(key);
			}
			const result = fn.apply(this, args);
			cache.set(key, result);
			// Limit cache size to prevent memory issues
			if (cache.size > maxSize) {
				const firstKey = cache.keys().next().value;
				cache.delete(firstKey);
			}
			return result;
		};
	}

	function toggleExpandCard(rowId) {
		const next = new Set(expandedCards);
		if (!next.delete(rowId)) next.add(rowId);
		expandedCards = next;
	}

	function handleCardContentClick(event, rowId) {
		// Check if text is currently selected/highlighted
		const selection = window.getSelection();
		if (selection && selection.toString().trim().length > 0) {
			return; // Don't collapse if text is selected
		}
		
		// Don't collapse if clicking a link (let it work normally)
		const target = event.target;
		if (target.tagName === 'A' || target.closest('a')) {
			return;
		}
		// Collapse the card when clicking anywhere else
		toggleExpandCard(rowId);
	}

	function parseDateImpl(dateStr) {
		if (!dateStr) return new Date(0);
		const str = String(dateStr).trim();
		const [year, month, day] = str.split('-');
		if (year && month && day) {
			return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
		}
		return new Date(str);
	}

	// Memoized version of parseDate
	const parseDate = memoizePrimitive(parseDateImpl, parseDateCache, 500);

	// Cache for month names to avoid repeated locale string operations
	const monthNameCache = new Map();
	
	function getMonthName(dateObj) {
		const year = dateObj.getFullYear();
		const month = dateObj.getMonth();
		const cacheKey = `${year}-${month}`;
		if (monthNameCache.has(cacheKey)) {
			return monthNameCache.get(cacheKey);
		}
		const name = `${dateObj.toLocaleString('default', { month: 'long' })} ${year}`;
		monthNameCache.set(cacheKey, name);
		return name;
	}

	function groupByMonth(items) {
		const groups = {};
		for (const item of items) {
			if (!item.date) continue;
			const dateObj = parseDate(item.date);
			if (isNaN(dateObj.getTime())) continue;
			const key = getMonthName(dateObj);
			if (!groups[key]) groups[key] = [];
			groups[key].push(item);
		}

		// Sort items within each group by date descending
		for (const key in groups) {
			groups[key].sort((a, b) => {
				const aDate = parseDate(a.date);
				const bDate = parseDate(b.date);
				return bDate.getTime() - aDate.getTime();
			});
		}

		// Sort groups by date descending (newest first)
		const sortedGroups = {};
		const sortedKeys = Object.keys(groups).sort((a, b) => {
			const firstItemA = groups[a]?.[0];
			const firstItemB = groups[b]?.[0];
				if (!firstItemA || !firstItemB) return 0;
				const dateA = parseDate(firstItemA.date);
				const dateB = parseDate(firstItemB.date);
				return dateB.getTime() - dateA.getTime();
			});
		
		for (const key of sortedKeys) {
			sortedGroups[key] = groups[key];
		}

		return sortedGroups;
	}

	/**
	 * Normalizes a value to an array for filtering
	 * @param {any} value - Value to normalize
	 * @returns {any[]} Array of values (normalized and trimmed)
	 */
	function normalizeToArray(value) {
		if (Array.isArray(value)) {
			return value
				.map(v => v != null ? String(v).trim() : null)
				.filter(v => v !== null && v !== '');
		}
		if (value != null) {
			const trimmed = String(value).trim();
			return trimmed ? [trimmed] : [];
		}
		return [];
	}

	/**
	 * Checks if any value in array matches any filter value
	 * @param {any[]} values - Values to check (should be normalized)
	 * @param {any[]} filters - Filter values (should be normalized)
	 * @returns {boolean}
	 */
	function matchesFilter(values, filters) {
		if (!filters?.length) return true;
		// Use Set for O(1) lookup instead of array includes
		const normalizedValues = new Set(values.map(v => String(v).trim().toLowerCase()));
		return filters.some(f => normalizedValues.has(String(f).trim().toLowerCase()));
	}

	/**
	 * Extracts all organizations from parent_child_matches hierarchy
	 * @param {any[]} parentChildMatches - Parent-child matches array
	 * @returns {string[]} Array of organization names
	 */
	function extractHierarchyOrgsImpl(parentChildMatches) {
		if (!Array.isArray(parentChildMatches)) return [];
		
		const orgs = [];
		for (const match of parentChildMatches) {
			if (match?.lineage && Array.isArray(match.lineage)) {
				for (const org of match.lineage) {
					const trimmed = String(org).trim();
					if (trimmed) orgs.push(trimmed);
			}
			}
		}
		return orgs;
	}

	// Memoized version
	const extractHierarchyOrgs = memoizePrimitive(extractHierarchyOrgsImpl, extractHierarchyOrgsCache, 500);


	/**
	 * Gets all publishers for a row (including hierarchy)
	 * @param {Object} row - Data row
	 * @returns {string[]} Array of publisher names
	 */
	function getAllPublishersImpl(row) {
		const orgPublishers = normalizeToArray(row.organization_publisher_named_in_deal_suit);
		const affectedPubs = normalizeToArray(row.affected_publications);
		const hierarchyOrgs = extractHierarchyOrgs(row.parent_child_matches);
		return [...orgPublishers, ...affectedPubs, ...hierarchyOrgs];
	}


	// Memoized version using WeakMap (since row is an object reference)
	const getAllPublishers = memoizeObject(getAllPublishersImpl, allPublishersCache);

	/**
	 * Removes URLs and domains from text for searching
	 * @param {string} text - Text to clean
	 * @returns {string} Text with URLs and domains removed
	 */
	// Combined regex for better performance
	const URL_DOMAIN_PATTERN = /https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}[^\s]*|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
	
	function removeUrlsAndDomains(text) {
		if (!text) return '';
		return String(text).replace(URL_DOMAIN_PATTERN, '');
	}

	/**
	 * Checks if row matches search query
	 * @param {Object} row - Data row
	 * @param {string} query - Search query
	 * @returns {boolean}
	 */
	function matchesSearch(row, query) {
		if (!query?.trim()) return true;
		
		const queryLower = query.toLowerCase();
				const searchableFields = [
					row.date,
					row.interaction,
					row.platform,
					row.organization_publisher_named_in_deal_suit,
					row.type,
					row.reported_details,
			row.status,
			row.case_number,
            row.mdl_number, row.mdl_name, row.mdl_court, row.mdl_docket,
			row.defendant,
			row.plaintiff,
			row.location,
			row.affected_publications
				];
				
		// Build searchable text more efficiently
		let searchableText = '';
		for (const field of searchableFields) {
			if (!field) continue;
			if (Array.isArray(field)) {
				searchableText += ' ' + field.map(v => String(v).toLowerCase()).join(' ');
			} else {
				searchableText += ' ' + String(field).toLowerCase();
			}
		}
		
		// Handle sources separately - remove URLs/domains from sources only
		if (row.sources) {
			const sources = Array.isArray(row.sources) ? row.sources : [row.sources];
			for (const source of sources) {
				const cleaned = removeUrlsAndDomains(String(source));
				if (cleaned.trim()) {
					searchableText += ' ' + cleaned.toLowerCase();
				}
			}
		}
				
		return searchableText.includes(queryLower);
	}

	/**
	 * Filters and sorts data based on current filters
	 * @returns {Object[]} Filtered and sorted data
	 */
	function getFilteredAndSorted() {
		if (focusedRecordIds != null) return data.filter(row => !isMdlConsolidation(row) && focusedRecordIds.includes(row.id));
		if (focusedRecordId != null) return data.filter(row => !isMdlConsolidation(row) && row.id === focusedRecordId);
		// If viewing related cards, filter to show the source + its related cards.
		let dataToFilter = data.filter(row => !isMdlConsolidation(row));
		if (viewingRelatedTo != null) {
			const sourceRow = idToRowMap.get(viewingRelatedTo);
			if (sourceRow && sourceRow.linked_entry_ids && Array.isArray(sourceRow.linked_entry_ids)) {
				const relatedRows = [sourceRow]; // Include the main card
				for (const id of sourceRow.linked_entry_ids) {
					const relatedRow = idToRowMap.get(id);
					// Entries of the same case are not "related" — they are the same
					// lawsuit, already merged into the source card.
					if (relatedRow && !isSameCase(sourceRow, relatedRow)) {
						relatedRows.push(relatedRow);
					}
				}
				dataToFilter = relatedRows.filter(row => !isMdlConsolidation(row));
			} else {
				dataToFilter = [];
			}
		}
		
		// Early return if no filters
		if (!filterInteraction?.length && !filterType?.length && !filterPlatform?.length &&
		    !filterPublishers?.length && !filterLocation?.length && !searchQuery?.trim()) {
			// Still need to sort
			const sorted = [...dataToFilter];
			sorted.sort((a, b) => {
				const aDate = parseDate(a.date || '');
				const bDate = parseDate(b.date || '');
				return bDate.getTime() - aDate.getTime();
			});
			return sorted;
		}
		
		const filtered = [];
		for (const row of dataToFilter) {
			// Filter by interaction
			if (filterInteraction?.length > 0) {
				const rowInteractions = normalizeToArray(row.interaction);
				if (!matchesFilter(rowInteractions, filterInteraction)) continue;
			}

			// Filter by type
			if (filterType?.length > 0) {
				const rowTypes = normalizeToArray(row.type);
				if (!matchesFilter(rowTypes, filterType)) continue;
			}

			// Filter by platform
			if (filterPlatform?.length > 0) {
				const platforms = parseArray(row.platform);
				if (!matchesFilter(platforms, filterPlatform)) continue;
			}

			// Filter by publishers (News Org)
			if (filterPublishers?.length > 0) {
				const allPublishers = getAllPublishers(row);
				if (!matchesFilter(allPublishers, filterPublishers)) continue;
			}

			// Filter by location (the interaction's own location plus the countries of
			// the orgs and publications it names)
			if (filterLocation?.length > 0) {
				if (!matchesFilter(getRowLocations(row, countryIndex), filterLocation)) continue;
			}

			// Search query filter
			if (!matchesSearch(row, searchQuery)) continue;

			filtered.push(row);
		}

		// Sort by date descending (newest first)
		filtered.sort((a, b) => {
			const aDate = parseDate(a.date || '');
			const bDate = parseDate(b.date || '');
			return bDate.getTime() - aDate.getTime();
		});

		return filtered;
	}

	/**
	 * The values each filter could still return something for, judged against
	 * every *other* filter. Excluding a filter from its own facet is what keeps
	 * the options beside a chosen one live: picking OpenAI must not grey out
	 * Meta, since selecting both widens the results rather than narrowing them.
	 */
	const availableValues = $derived.by(() => {
		const available = {
			interaction: new Set(),
			type: new Set(),
			platform: new Set(),
			publishers: new Set(),
			location: new Set()
		};

		for (const row of data) {
			const values = {
				interaction: normalizeToArray(row.interaction),
				type: normalizeToArray(row.type),
				platform: parseArray(row.platform),
				publishers: getAllPublishers(row),
				location: getRowLocations(row, countryIndex)
			};
			const passes = {
				interaction: matchesFilter(values.interaction, filterInteraction),
				type: matchesFilter(values.type, filterType),
				platform: matchesFilter(values.platform, filterPlatform),
				publishers: matchesFilter(values.publishers, filterPublishers),
				location: matchesFilter(values.location, filterLocation),
				search: matchesSearch(row, searchQuery)
			};

			for (const dimension of Object.keys(available)) {
				const othersPass = Object.entries(passes)
					.every(([name, ok]) => name === dimension || ok);
				if (!othersPass) continue;
				for (const value of values[dimension]) available[dimension].add(value);
			}
		}

		return available;
	});

	$effect(() => {
		onAvailableValuesChange(availableValues);
	});

	let filteredData = $derived(getFilteredAndSorted());
	let groupedData = $derived(groupByMonth(filteredData));

	$effect(() => {
		onFilteredDataChange(filteredData);
	});

	// Auto-expand/collapse cards based on filters/search
	// Note: Excludes AI Company (filterPlatform) and Interaction Type (filterInteraction) from auto-expand
	$effect(() => {
		const hasActiveFilters = 
			(searchQuery?.trim().length > 0) ||
			(filterType?.length > 0) ||
			(filterPublishers?.length > 0) ||
			(filterLocation?.length > 0);

		// Expand every matching card while filtering, collapse everything otherwise
		expandedCards = focusedRecordId != null ? new Set([focusedRecordId]) : hasActiveFilters ? new Set(filteredData.map(row => row.id)) : new Set();
	});

	/**
	 * Escapes HTML to prevent XSS attacks
	 * @param {string} text - Text to escape
	 * @returns {string} Escaped HTML
	 */
	function escapeHtml(text) {
		return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}

	/**
	 * Highlights matching text in search results (only for search query and News Org filter)
	 * @param {any} text - Text to highlight
	 * @param {string[]} searchTerms - Additional search terms
	 * @returns {string} HTML string with highlighted matches
	 */
	// Cache for escaped patterns to avoid repeated regex compilation
	const highlightPatternCache = new Map();
	
	function highlightText(text, searchTerms = []) {
		if (!text) return '';

		// Build search patterns
		const searchPatterns = [];
		if (searchQuery?.trim()) {
			searchPatterns.push(searchQuery.trim());
		}
		if (filterPublishers?.length > 0) {
			searchPatterns.push(...filterPublishers);
		}
		if (searchTerms.length > 0) {
			searchPatterns.push(...searchTerms);
		}

		// If no patterns, just escape and return
		if (searchPatterns.length === 0) {
			return escapeHtml(text);
		}

		// Escape HTML first to prevent XSS
		const escapedText = escapeHtml(text);
		
		// Escape special regex characters and create pattern
		const escapedPatterns = searchPatterns
			.filter(p => p && String(p).trim())
			.map(p => String(p).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
		
		if (escapedPatterns.length === 0) {
			return escapedText;
		}

		// Get or create highlight pattern from cache
		const patternKey = escapedPatterns.sort().join('|');
		let highlightPattern = highlightPatternCache.get(patternKey);
		if (!highlightPattern) {
			highlightPattern = new RegExp(`(${escapedPatterns.join('|')})`, 'gi');
			highlightPatternCache.set(patternKey, highlightPattern);
			// Limit cache size
			if (highlightPatternCache.size > 100) {
				const firstKey = highlightPatternCache.keys().next().value;
				highlightPatternCache.delete(firstKey);
			}
		}
		
		// Split text into segments: URLs/domains and regular text
		const segments = [];
		let lastIndex = 0;
		URL_DOMAIN_PATTERN.lastIndex = 0;
		
		let match;
		while ((match = URL_DOMAIN_PATTERN.exec(escapedText)) !== null) {
			if (match.index > lastIndex) {
				segments.push({ type: 'text', content: escapedText.substring(lastIndex, match.index) });
			}
			segments.push({ type: 'url', content: match[0] });
			lastIndex = match.index + match[0].length;
		}
		
		if (lastIndex < escapedText.length) {
			segments.push({ type: 'text', content: escapedText.substring(lastIndex) });
		}
		
		if (segments.length === 0) {
			segments.push({ type: 'text', content: escapedText });
		}
		
		// Apply highlighting only to text segments (not URLs)
		return segments.map(segment => {
			if (segment.type === 'url') {
				return segment.content;
			}
			const parts = segment.content.split(highlightPattern);
		return parts.map(part => {
				// Check if part matches any pattern (case-insensitive)
				const partLower = part.toLowerCase();
				if (escapedPatterns.some(p => p.toLowerCase() === partLower)) {
				return `<mark class="highlight">${part}</mark>`;
			}
			return part;
			}).join('');
		}).join('');
	}

	// Interaction type constants
	const INTERACTION_TYPES = {
		LAWSUIT: 'lawsuit',
		GRANT: 'grant',
		DEAL: 'deal'
	};

	/**
	 * Gets all interaction types from a row
	 * @param {any} interaction - Interaction value (can be array or string)
	 * @returns {string[]} Array of normalized interaction types
	 */
	function getInteractionTypes(interaction) {
		if (!interaction) return [];
		
		const interactions = Array.isArray(interaction) ? interaction : [interaction];
		return interactions
			.map(i => {
				const normalized = String(i || '').trim().toLowerCase();
				// Map common variations to standard types
				if (normalized === 'lawsuit' || normalized === 'lawsuits') return INTERACTION_TYPES.LAWSUIT;
				if (normalized === 'grant' || normalized === 'grants') return INTERACTION_TYPES.GRANT;
				if (normalized === 'deal' || normalized === 'deals') return INTERACTION_TYPES.DEAL;
				return null;
			})
			.filter(i => i !== null);
	}

	/**
	 * Gets the primary interaction type from a row (for styling purposes)
	 * @param {any} interaction - Interaction value
	 * @returns {string} Normalized interaction type (prioritizes lawsuit > grant > deal)
	 */
	function getInteractionType(interaction) {
		const types = getInteractionTypes(interaction);
		if (types.includes(INTERACTION_TYPES.LAWSUIT)) return INTERACTION_TYPES.LAWSUIT;
		if (types.includes(INTERACTION_TYPES.GRANT)) return INTERACTION_TYPES.GRANT;
		if (types.includes(INTERACTION_TYPES.DEAL)) return INTERACTION_TYPES.DEAL;
		return INTERACTION_TYPES.DEAL; // default
	}

	// Removed unused formatPlatforms, formatPublishers, formatTypes functions
	// Use parseArray(value).join(', ') directly if needed

	function getHostnameImpl(url) {
		try {
			return new URL(url).hostname.replace('www.', '');
		} catch (e) {
			return url;
		}
	}

	// Memoized version of getHostname
	const getHostname = memoizePrimitive(getHostnameImpl, getHostnameCache, 500);

	// Check if URL is an Archive.org URL and extract the original URL
	function getArchiveInfoImpl(url) {
		try {
			const archivePattern = /^https?:\/\/web\.archive\.org\/web\/\d+\/(.+)$/;
			const match = url.match(archivePattern);
			if (match && match[1]) {
				return {
					isArchive: true,
					originalUrl: match[1],
					archiveUrl: url
				};
			}
		} catch (e) {
			// Not an archive URL or parsing failed
		}
		return {
			isArchive: false,
			originalUrl: null,
			archiveUrl: url
		};
	}

	// Memoized version
	const getArchiveInfo = memoizePrimitive(getArchiveInfoImpl, archiveInfoCache, 500);

	// Citations are labelled with their hostname, which reads correctly for a
	// publisher (storage.courtlistener.com, nytco-assets.nytimes.com) but not for a
	// document the tracker hosts itself — that prints the S3 bucket name at a reader.
	// Those get an explicit title here, keyed on the URL's decoded path so the query
	// string and the scheme don't matter. A self-hosted file that isn't listed still
	// falls back to its hostname: visibly wrong rather than silently mislabelled.
	// Rename an object in the bucket and its key below has to change with it.
	const SELF_HOSTED_SOURCE_LABELS = {
		"/La Presse Inc. c. OpenAI Group PBC et al - Demande introductive d'instance (24 novembre 2025).pdf":
			'Court filing (PDF)'
	};

	function getSelfHostedSourceLabel(url) {
		try {
			return SELF_HOSTED_SOURCE_LABELS[decodeURIComponent(new URL(url).pathname)] ?? null;
		} catch (e) {
			return null;
		}
	}

	// Get display text for a source URL
	function getSourceDisplayTextImpl(url) {
		const archiveInfo = getArchiveInfo(url);
		// An archived copy is the same document, so it takes the same label.
		const selfHostedLabel = getSelfHostedSourceLabel(archiveInfo.isArchive ? archiveInfo.originalUrl : url);
		if (selfHostedLabel) return selfHostedLabel;
		if (archiveInfo.isArchive) {
			// For archives, show the hostname of the original URL
			try {
				return new URL(archiveInfo.originalUrl).hostname.replace('www.', '');
			} catch (e) {
				// If URL parsing fails, try to extract hostname manually
				const urlMatch = archiveInfo.originalUrl.match(/https?:\/\/([^\/]+)/);
				if (urlMatch && urlMatch[1]) {
					return urlMatch[1].replace('www.', '');
				}
				return archiveInfo.originalUrl;
			}
		} else {
			// For regular URLs, show the hostname
			return getHostname(url);
		}
	}

	// Memoized version
	const getSourceDisplayText = memoizePrimitive(getSourceDisplayTextImpl, sourceDisplayTextCache, 500);

	// Build hierarchical tree from parent_child_matches using lineage
	// This ensures all organizations at the same depth appear at the same level (proper org chart)
	function buildHierarchyTreeImpl(matches, newsOrgs = []) {
		if (!Array.isArray(matches) || matches.length === 0) return {};

		const tree = {};
		
		// First pass: determine if we have any 3+ level lineages
		// If yes, ALL organizations at position 1 should be shown as intermediate nodes
		const hasMultiLevelLineages = matches.some(match => 
			match.lineage && Array.isArray(match.lineage) && match.lineage.length > 2
		);
		
		// Second pass: build the tree structure
		// Key rule: If ANY org at position 1 is intermediate (in a 3+ level lineage),
		// then ALL orgs at position 1 should be shown as intermediate nodes at the same level
		for (const match of matches) {
			if (!match.lineage || !Array.isArray(match.lineage) || match.lineage.length < 2) {
				return;
			}

			const lineage = match.lineage;
			const topLevel = lineage[0];
			const publication = lineage[lineage.length - 1];

			if (!tree[topLevel]) {
				tree[topLevel] = {};
			}

			let current = tree[topLevel];

			if (lineage.length > 2) {
				// 3+ level lineage: build all intermediate nodes at their proper depth
				for (let i = 1; i < lineage.length - 1; i++) {
					const level = lineage[i];
					if (!current[level]) {
						current[level] = {};
					}
					current = current[level];
				}
				// Add the publication as a leaf
				if (!current.publications) {
					current.publications = [];
				}
				if (!current.publications.includes(publication)) {
					current.publications.push(publication);
				}
			} else if (lineage.length === 2) {
				// 2-level lineage: if we have multi-level lineages, treat position 1 as intermediate
				if (hasMultiLevelLineages) {
					// Show as intermediate node (same level as other depth-1 orgs)
					const orgAtPos1 = lineage[1];
					if (!current[orgAtPos1]) {
						current[orgAtPos1] = {};
					}
					// Only add publication if it's different from the org name (trim and normalize)
					const normalizedPublication = String(publication).trim();
					const normalizedOrgName = String(orgAtPos1).trim();
					if (normalizedPublication !== normalizedOrgName && normalizedPublication !== '') {
						if (!current[orgAtPos1].publications) {
							current[orgAtPos1].publications = [];
						}
						if (!current[orgAtPos1].publications.includes(publication)) {
							current[orgAtPos1].publications.push(publication);
						}
					}
				} else {
					// No multi-level lineages: treat as direct publication
					if (!current.publications) {
						current.publications = [];
					}
					if (!current.publications.includes(publication)) {
						current.publications.push(publication);
					}
				}
			}
		}

		// Cleanup: Remove any publications that match their parent organization name
		function cleanupTree(node, parentName = null) {
			if (typeof node !== 'object' || node === null) return;
			
					const normalizedParent = parentName ? String(parentName).trim() : null;
			
			for (const key in node) {
				if (key === 'publications' && Array.isArray(node[key])) {
					// Filter out publications that match the parent name
					node[key] = node[key].filter(pub => {
						if (!pub) return false;
						const normalizedPub = String(pub).trim();
						return normalizedPub !== normalizedParent && normalizedPub !== '';
					});
					// Remove publications array if empty
					if (node[key].length === 0) {
						delete node[key];
					}
				} else if (typeof node[key] === 'object' && node[key] !== null) {
					// Recursively clean child nodes
					cleanupTree(node[key], key);
				}
			}
		}

		// Apply cleanup to all top-level trees
		for (const topLevel in tree) {
			cleanupTree(tree[topLevel]);
		}

		return tree;
	}

	// Memoized version of buildHierarchyTree
	const buildHierarchyTree = memoizePrimitive(buildHierarchyTreeImpl, hierarchyTreeCache, 200);

	// Removed unused renderHierarchyNode function

	// Cache for normalized sources to avoid re-processing (limit size)
	const sourceCache = new Map();
	const MAX_SOURCE_CACHE_SIZE = 1000;
	
	// Pre-compiled regex patterns for better performance
	const URL_PATTERNS = {
		completeArray: /\[['"](https?:\/\/[^'"]+)['"]/g,
		incompleteArray: /\[['"](https?:\/\/[^\s,]+)/g,
		aggressiveArray: /\[['"](https?:\/\/.+?)(?=['"]\]|$)/,
		quotedUrl: /['"](https?:\/\/[^'"]+)['"]?/g,
		unclosedQuote: /['"](https?:\/\/[^\s,]+)/g,
		plainUrl: /(https?:\/\/[^\s,\[\]'"]+)/g,
		domain: /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}/
	};
	
	function normalizeSources(value) {
		if (!value) return [];
		
		// Check cache first
		const cacheKey = typeof value === 'string' ? value : JSON.stringify(value);
		if (sourceCache.has(cacheKey)) {
			return sourceCache.get(cacheKey);
		}
		
		let result;
		if (Array.isArray(value)) {
			result = value
				.filter(s => s && String(s).trim())
				.map(s => cleanUrl(String(s).trim()));
		} else if (typeof value === 'string') {
			const trimmed = value.trim();
			const results = new Set(); // Use Set to avoid duplicates
			
			// Extract URLs using all patterns
			const extractUrl = (url) => {
				const cleaned = cleanUrl(url.trim());
				if (cleaned) results.add(cleaned);
			};
			
			// Pattern 1: Complete array format
			let match;
			URL_PATTERNS.completeArray.lastIndex = 0;
			while ((match = URL_PATTERNS.completeArray.exec(trimmed)) !== null) {
				extractUrl(match[1]);
			}
			
			// Pattern 2: Incomplete array format
			URL_PATTERNS.incompleteArray.lastIndex = 0;
			while ((match = URL_PATTERNS.incompleteArray.exec(trimmed)) !== null) {
				const url = match[1].replace(/['"]+$/, '').replace(/\]$/, '').trim();
				extractUrl(url);
			}
			
			// Pattern 2b: Aggressive array match
			if (trimmed.includes("['https://") || trimmed.includes('["https://')) {
				const aggressiveMatch = trimmed.match(URL_PATTERNS.aggressiveArray);
				if (aggressiveMatch) {
					const url = aggressiveMatch[1].replace(/['"]+$/, '').replace(/\]$/, '').trim();
					extractUrl(url);
				}
			}
			
			// Pattern 3: Quoted URLs
			URL_PATTERNS.quotedUrl.lastIndex = 0;
			while ((match = URL_PATTERNS.quotedUrl.exec(trimmed)) !== null) {
				extractUrl(match[1]);
			}
			
			// Pattern 3b: Unclosed quote URLs
			URL_PATTERNS.unclosedQuote.lastIndex = 0;
			while ((match = URL_PATTERNS.unclosedQuote.exec(trimmed)) !== null) {
				extractUrl(match[1]);
			}
			
			// Pattern 4: Plain URLs
			URL_PATTERNS.plainUrl.lastIndex = 0;
			while ((match = URL_PATTERNS.plainUrl.exec(trimmed)) !== null) {
				const url = match[1] || match[0];
				if (url.startsWith('http')) {
					extractUrl(url);
				}
			}
			
			// Process remaining string for plain domains
			let remaining = trimmed
				.replace(/\[['"](https?:\/\/[^\s,]+)/g, '')
				.replace(/\[['"](https?:\/\/[^'"]+)['"]/g, '')
				.replace(/\[['"]?/g, '')
				.replace(/['"]?\]?/g, '');
			
			const parts = remaining.split(',');
			for (const part of parts) {
				const cleaned = part.trim();
				if (!cleaned || cleaned.length < 3 || 
				    cleaned === '[' || cleaned === ']' || cleaned === "'" || cleaned === '"' ||
				    cleaned.includes('://') || cleaned.startsWith('www.')) {
					continue;
				}
				
				if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
					extractUrl(cleaned);
				} else if (URL_PATTERNS.domain.test(cleaned)) {
					results.add(`https://${cleaned}`);
				}
			}
			
			// Convert Set to array
			if (results.size > 0) {
				result = Array.from(results);
			} else if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
				// Try JSON parsing
				try {
					const jsonStr = trimmed.replace(/,\s*\]$/, ']').replace(/'/g, '"');
						const parsed = JSON.parse(jsonStr);
						result = Array.isArray(parsed) 
							? parsed.filter(s => s && String(s).trim()).map(s => cleanUrl(String(s).trim()))
							: [];
					} catch (e) {
						result = [];
					}
				} else {
					const cleaned = cleanUrl(trimmed);
					if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
						result = [cleaned];
				} else if (URL_PATTERNS.domain.test(cleaned)) {
						result = [`https://${cleaned}`];
					} else {
						result = [];
				}
			}
		} else {
			result = [];
		}
		
		// Cache the result
		if (result && result.length > 0) {
			sourceCache.set(cacheKey, result);
			// Limit cache size
			if (sourceCache.size > MAX_SOURCE_CACHE_SIZE) {
				const firstKey = sourceCache.keys().next().value;
				sourceCache.delete(firstKey);
			}
		}
		
		return result || [];
	}

	function cleanUrl(url) {
		if (!url) return url;
		// Remove leading slash if present before http/https
		url = url.replace(/^\/+(https?:\/\/)/, '$1');
		// Remove any trailing slashes or whitespace
		url = url.trim();
		return url;
	}

	/**
	 * Gets the entries a row links to, from its curated linked_entry_ids.
	 * @param {Object} row - Data row
	 * @returns {Object[]} Array of linked entry rows, sorted by date (newest first)
	 */
	function getLinkedEntries(row) {
		if (!row.linked_entry_ids || !Array.isArray(row.linked_entry_ids) || row.linked_entry_ids.length === 0) {
			return [];
		}

		const linkedEntries = [];
		for (const id of row.linked_entry_ids) {
			const linkedRow = idToRowMap.get(id);
			// Skip other entries of the same case — those live in the status track,
			// not the linked-entries tray.
			if (linkedRow && !isSameCase(row, linkedRow)) {
				linkedEntries.push(linkedRow);
			}
		}

		// Sort by date (newest first)
		linkedEntries.sort((a, b) => {
			const aDate = parseDate(a.date || '');
			const bDate = parseDate(b.date || '');
			return bDate.getTime() - aDate.getTime();
		});

		return linkedEntries;
	}


	function viewRelatedCards(rowId) {
		viewingRelatedTo = rowId;
	}

	function viewAllCards() {
		viewingRelatedTo = null;
	}
</script>

{#if networkRow}
 <PublisherNetwork row={networkRow} {data} onclose={() => networkRow = null}>
  {#snippet recordCard(selectedEntries, expandRecord)}
   {#key selectedEntries.map(entry => entry.id).join(',') + expandRecord}
    <CardView {data} focusedRecordId={expandRecord ? selectedEntries[0]?.id : null} focusedRecordIds={expandRecord ? null : selectedEntries.map(entry => entry.id)} {showCountries} />
   {/key}
  {/snippet}
 </PublisherNetwork>
{/if}


<!-- Country flags for a name on a card; a name in several countries gets several.
     Hovering one names the country it stands for. While filtering, only the
     filtered country is drawn, so a card shows what put it in the results —
     unless the toggle asks for every country a name is in, and then the filtered
     one is picked out among them. -->
{#snippet countryFlags(flagRow, flagName)}
	{#each visiblePlaces(flagRow, flagName) as { country, label }}
		<span
			class="publication-country"
			class:filtered={showCountries && filterLocation?.includes(country)}
			role="img"
			aria-label={country}
			data-place={country}
		>
			{label}
		</span>
	{/each}
{/snippet}

<div
	class="card-view"
	class:related-active={viewingRelatedTo != null}
>
	{#if viewingRelatedTo != null}
		<div
			class="related-backdrop"
			onclick={viewAllCards}
			role="button"
			tabindex="-1"
			aria-label="Dismiss related view"
		></div>
		<button class="related-tray-close" onclick={viewAllCards} title="Dismiss (Esc)" aria-label="Close related view">×</button>
	{/if}

	<div class="timeline-container">
		{#each Object.entries(groupedData) as [monthYear, items]}
			<div class="timeline-row">
				<div class="month-label">
					<span>{monthYear.split(' ')[0]}</span>
					<span class="year-label">{monthYear.split(' ')[1]}</span>
				</div>
				<div class="timeline-divider"></div>
				<div class="month-group">
					{#each items as row (row.id)}
			{@const interactionTypes = getInteractionTypes(row.interaction)}
			{@const interactionType = getInteractionType(row.interaction)}
						{@const entry = row}
						{@const allPublishers = Array.isArray(entry.organization_publisher_named_in_deal_suit) ? entry.organization_publisher_named_in_deal_suit : []}
							{@const allSources = normalizeSources(entry.sources)}
                            {@const hasCaseNumber = interactionType === 'lawsuit' && entry.case_number && !['unknown', '(unknown)', '—', 'nan'].includes(String(entry.case_number).trim().toLowerCase())}

						{@const parentChildMatches = Array.isArray(entry.parent_child_matches) ? entry.parent_child_matches : []}
						{@const hierarchyTree = buildHierarchyTree(parentChildMatches, allPublishers)}
						{@const borderColors = interactionTypes.map(t => {
							if (t === 'lawsuit') return '#e57373';
							if (t === 'grant') return '#64b5f6';
							return '#81c784';
						})}
						{@const borderGradient = interactionTypes.length > 1 
							? (() => {
								if (interactionTypes.length === 2) {
									return `linear-gradient(to bottom, ${borderColors[0]} 0%, ${borderColors[0]} 50%, ${borderColors[1]} 50%, ${borderColors[1]} 100%)`;
								} else if (interactionTypes.length === 3) {
									return `linear-gradient(to bottom, ${borderColors[0]} 0%, ${borderColors[0]} 33.33%, ${borderColors[1]} 33.33%, ${borderColors[1]} 66.66%, ${borderColors[2]} 66.66%, ${borderColors[2]} 100%)`;
								}
								return '';
							})()
							: ''}
						<div
							class="card-wrapper"
							class:is-source={isSourceCard(row)}
							class:is-related={viewingRelatedTo != null && !isSourceCard(row)}
						>
			<div
				id="card-{row.id}"
				class="card {interactionType}"
				class:collapsed={!isCardExpanded(row.id)}
				class:has-multiple-interactions={interactionTypes.length > 1}
				style={borderGradient ? `--border-gradient: ${borderGradient};` : ''}
			>
									<!-- Colored Header. Expanding drops the names, which the card
									     then lists in full below, and keeps the date and the tags -->
								<div 
									class="card-header {interactionType}"
										class:expanded={isCardExpanded(row.id)}
									onclick={() => toggleExpandCard(row.id)}
									role="button"
									tabindex="0"
									onkeydown={(e) => e.key === 'Enter' && toggleExpandCard(row.id)}
								>
									{#if row.date}
										<div class="header-date">{formatDate(row.date)}</div>
									{/if}
									{#if !isCardExpanded(row.id)}
									<div class="header-content">
										{#if interactionType === 'lawsuit'}
											<div class="header-left">
												{#if Array.isArray(row.defendant) && row.defendant.length > 0}
													{#each row.defendant as defendant}
														<div class="header-item">{@html highlightText(defendant)}</div>
													{/each}
												{/if}
											</div>
											<div class="header-separator"></div>
											<div class="header-right-content">
												{#if Array.isArray(row.plaintiff) && row.plaintiff.length > 0}
													{#each row.plaintiff as plaintiff}
														<div class="header-item">{@html highlightText(plaintiff)}</div>
													{/each}
												{/if}
											</div>
										{:else}
											<div class="header-left">
												{#if Array.isArray(row.platform) && row.platform.length > 0}
													{#each row.platform as platform}
														<div class="header-item">{@html highlightText(platform)}</div>
													{/each}
												{/if}
											</div>
											<div class="header-separator"></div>
											<div class="header-right-content">
												{#if Array.isArray(allPublishers) && allPublishers.length > 0}
													{#each allPublishers as pub}
														<div class="header-item">{@html highlightText(pub)}</div>
													{/each}
												{/if}
											</div>
										{/if}
								</div>
									{/if}
									<div class="header-right">
										<div class="interaction-tags">
											{#each interactionTypes as interaction}
												<span class="interaction-tag {interaction}">
													{interaction === 'lawsuit' ? 'Lawsuit' : interaction === 'grant' ? 'Grant' : 'Deal'}
												</span>
											{/each}
										</div>
										<span class="expand-icon">{isCardExpanded(row.id) ? '−' : '+'}</span>
						</div>
						</div>

								<!-- Two Column Layout -->
								{#if isCardExpanded(row.id)}
									<div class="card-content" onclick={(e) => handleCardContentClick(e, row.id)}>
									<!-- Column 1 -->
									<div class="card-column column-1">
					<div class="card-field">
						<div class="field-label">{interactionType === 'lawsuit' ? 'Defendant(s)' : 'AI Company'}</div>
						<div class="field-value">
							{#if interactionType === 'lawsuit' && Array.isArray(entry.defendant) && entry.defendant.length > 0}
								{#each entry.defendant as defendant}
									<div class="field-item">{@html highlightText(defendant)}</div>
								{/each}
							{:else if Array.isArray(entry.platform) && entry.platform.length > 0}
								{#each entry.platform as platform}
									<div class="field-item">{@html highlightText(platform)}</div>
								{/each}
					{/if}
								</div>
				</div>

					<div class="card-field news-org-field">
						<div class="news-org-header">
							<div class="field-label">{interactionType === 'lawsuit' ? 'News Org(s)' : 'Publication(s)'}</div>
							<div class="affected-note">(Publications named in {interactionType === 'lawsuit' ? 'suit' : interactionType === 'grant' ? 'deal announcement' : 'announcements or confirmed by platform'})</div>
						</div>
						<div class="field-value">
							{#each allPublishers as org}
								{@const orgTree = hierarchyTree[org] || {}}
								{@const hasMatches = Object.keys(orgTree).length > 0 || (orgTree.publications && orgTree.publications.length > 0)}
								<div class="publisher-item">
									<div class="field-item">
										{@html highlightText(org)}
										{@render countryFlags(entry, org)}
									</div>
									{#if hasMatches}
										<div class="affected-publications">
											{#snippet renderNode(node, parentName = null)}
												{#each Object.keys(node).sort() as key}
													{@const child = node[key]}
													{#if key === 'publications'}
														{#each child.slice().sort((a, b) => String(a || '').localeCompare(String(b || ''))) as publication}
															{@const normalizedPub = String(publication || '').trim()}
															{@const normalizedParent = parentName ? String(parentName).trim() : ''}
															{#if normalizedPub !== normalizedParent && normalizedPub !== ''}
																<div class="affected-title">
																	{#if interactionType === 'grant'}
																		<span class="hierarchy-label">Grantee: </span>
																	{/if}
																	{@html highlightText(publication)}
																	{@render countryFlags(entry, publication)}
																</div>
							{/if}
							{/each}
													{:else}
														<div class="hierarchy-intermediate">
															<span class="hierarchy-intermediate-name">
																{#if interactionType === 'grant'}
																	<span class="hierarchy-label">Grant Administrator: </span>
																{/if}
																{@html highlightText(key)}
																{@render countryFlags(entry, key)}
															</span>
															<div class="hierarchy-intermediate-children">
																{@render renderNode(child, key)}
						</div>
					</div>
				{/if}
												{/each}
											{/snippet}
											{@render renderNode(orgTree, org)}
						</div>
					{/if}
				</div>
							{/each}
						</div>
					</div>

					<div class="card-field">
						<div class="field-label">{interactionType === 'lawsuit' ? 'Complaint' : 'Type'}</div>
						<div class="field-value type-tags-wrapper">
							{#if Array.isArray(entry.type) && entry.type.length > 0}
								{#each entry.type as type}
									{@const normalizedType = String(type).trim()}
									{#if normalizedType}
										<span class="type-tag">{@html highlightText(normalizedType)}</span>
									{/if}
								{/each}
							{:else if entry.type}
								{@const normalizedType = String(entry.type).trim()}
								{#if normalizedType}
									<span class="type-tag">{@html highlightText(normalizedType)}</span>
								{/if}
							{/if}
						</div>
					</div>

										{#if interactionType === 'lawsuit'}
											{@const progression = getStatusProgression(row)}
											{#if entry.status || progression.length > 1}
					<div class="card-field">
													<div class="field-label">Status:</div>
													<div class="field-value">
														{#if progression.length > 1}
															<!-- Same chronology on every card of the case; this card marks its own step -->
															<ol class="status-chain">
																{#each progression as step (step.id)}
																	{@const isCurrentStep = step.entryIds.includes(row.id)}
																	<li class="status-chain-step {getStatusClass(step.status)}" class:current={isCurrentStep}>
																		<span class="status-chain-dot"></span>
																		{#if isMdlConsolidation(step) && (step.mdl_docket_url || row.mdl_docket_url || step.docket)}
                                                                    <a href={step.mdl_docket_url || row.mdl_docket_url || step.docket} target="_blank" rel="noopener noreferrer" class="status-chain-label status-chain-jump" onclick={(event) => event.stopPropagation()}>{@html highlightText(step.status)}</a>
                                                                {:else if isCurrentStep}
																			<span class="status-chain-label">{@html highlightText(step.status || 'Filed')}</span>
																		{:else}
																			<button
																				type="button"
																				class="status-chain-label status-chain-jump"
																				title="Go to this update"
																				onclick={(e) => { e.stopPropagation(); goToCaseEntry(step.id); }}
																			>{@html highlightText(step.status || 'Filed')}</button>
																		{/if}
																		<span class="status-chain-date">{formatDate(step.date)}</span>
																	</li>
																{/each}
															</ol>
														{:else if entry.status}
															<span class="status-badge {getStatusClass(entry.status)}">
																<span class="status-indicator"></span>
																<span class="status-text">{@html highlightText(entry.status)}</span>
															</span>
														{/if}
					</div>
												</div>
											{/if}
											{#if entry.location}
					<div class="card-field">
													<div class="field-label">Location:</div>
													<div class="field-value">{@html highlightText(entry.location)}</div>
												</div>
											{/if}
										{/if}
					</div>

									<!-- Column 2 -->
									<div class="card-column column-2">
					<div class="card-field reported-details">
						<div class="field-label">Reported Details</div>
						<div class="field-value">
							<span class="reported-text">
							{@html highlightText(entry.reported_details || '—')}
							</span>
										</div>
									</div>

                            {#if hasCaseNumber || entry.mdl_number}
                                <div class="card-field case-details-field">
                                    <div class="field-label">Docket(s)</div>
                                    <div class="field-value">
                                        {#if hasCaseNumber}
                                            <div>Case:
                                                {#if entry.docket}
                                                    <a href={entry.docket} target="_blank" rel="noopener noreferrer" class="source-link">{@html highlightText(String(entry.case_number).trim())}</a>
                                                {:else}
                                                    {@html highlightText(String(entry.case_number).trim())}
                                                {/if}
                                            </div>
                                        {/if}
                                        {#if entry.mdl_number}
                                            <div>MDL:
                                                {#if entry.mdl_docket_url}
                                                    <a href={entry.mdl_docket_url} target="_blank" rel="noopener noreferrer" class="source-link">{entry.mdl_docket}</a>
                                                {:else}
                                                    <span>{entry.mdl_docket}</span>
                                                {/if}
                                            </div>
                                        {/if}
                                    </div>
                                </div>
                            {/if}

                            {#each [{ label: 'Case Filing', value: entry.case_filing }, { label: 'Additional Coverage', value: entry.additional_coverage }] as linkField}
                                {@const urls = normalizeSources(linkField.value)}
                                {#if urls.length > 0}
                                    <div class="card-field">
                                        <div class="field-label">{linkField.label}:</div>
                                        <div class="field-value">
                                            {#each urls as url}
                                                <div><a href={url} target="_blank" rel="noopener noreferrer" class="source-link">{getSourceDisplayText(url)}</a></div>
                                            {/each}
                                        </div>
                                    </div>
                                {/if}
                            {/each}

							{#if allSources.length > 0}
								<div class="citations-section">
									<div class="citations-label">Read More:</div>
									<div class="citations">
										{#each allSources as source, index}
											{@const archiveInfo = getArchiveInfo(source)}
											{@const displayUrl = archiveInfo.isArchive ? archiveInfo.archiveUrl : source}
											{@const displayText = getSourceDisplayText(source)}
											<a href={displayUrl} target="_blank" rel="noopener noreferrer" class="citation-link">{@html highlightText(displayText)}</a>{#if index < allSources.length - 1}<span class="citation-separator">, </span>{/if}
							{/each}
						</div>
					</div>
				{/if}
								
                                {#if networkAvailability.get(row.id)}
                                    <div class="related-cards-toggle">
                                        <button class="related-toggle-btn publisher-network-btn" onclick={(event) => { event.stopPropagation(); networkRow = row; }}>
                                            <img class="network-icon" src="/publisher-network-icon.png" alt="" aria-hidden="true" />
                                            <span class="network-button-copy"><strong>Related Relationships</strong></span>
                                        </button>
                                    </div>
                                {/if}
						</div>
					</div>
				{/if}
							</div>
						</div>
					{/each}
					</div>
			</div>
		{/each}
		{#if filteredData.length === 0}
			<div class="no-results">
				No results found
			</div>
		{/if}
	</div>
</div>

<style>
	.card-view {
		width: 100%;
		margin-top: 1rem;
	}


	.timeline-container {
		max-width: 1000px;
		margin: 0 auto;
		padding: 0 3rem 2rem;
		overflow: visible;
		position: relative;
	}

	.timeline-row {
		display: grid;
		grid-template-columns: 100px 2px 1fr;
		gap: 2rem;
		align-items: flex-start;
		margin-bottom: 4rem;
		overflow: visible;
		overflow-x: visible;
	}

	.timeline-divider {
		background: #e0e0e0;
		width: 1.5px;
		height: 100%;
		opacity: 1;
	}

	.month-label {
		font-family: inherit;
		font-size: 1.5rem;
		font-weight: 600;
		color: #1a1a1a;
		text-transform: capitalize;
		position: sticky;
		top: calc(200px + 1rem);
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		padding-right: 0.5rem;
		margin-right: -1rem;
		z-index: 900;
		padding-top: 0.5rem;
		line-height: 1.2;
	}

	.year-label {
		font-size: 1rem;
		color: #666;
		margin-top: 0.25rem;
		font-weight: 400;
	}

	.month-group {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		overflow: visible;
		overflow-x: visible;
		min-width: 0;
		width: 100%;
	}

	.card-wrapper {
		width: 100%;
		overflow: visible;
		position: relative;
		min-width: 0;
		margin-left: 0;
		padding-left: 0;
	}


	@media screen and (max-width: 768px) {
		.timeline-container {
			padding: 0 1rem 2rem;
		}


		.timeline-row {
		display: flex;
		flex-direction: column;
			margin-bottom: 2.5rem;
			gap: 0;
		}

		.timeline-divider {
			display: none;
		}

		.month-label {
			flex-direction: row;
			justify-content: flex-start;
			align-items: baseline;
			font-size: 1.25rem;
			position: static;
			padding: 0;
			padding-bottom: 1rem;
			margin-bottom: 1rem;
			border-bottom: 2px solid #DE5A35;
		}

		.year-label {
			font-size: 0.875rem;
			margin-top: 0;
			margin-left: 0.5rem;
			color: #666;
		}

		.month-group {
			gap: 1.25rem;
		}

		.card-content {
			display: flex !important;
			flex-direction: column !important;
			grid-template-columns: none !important;
			padding: 0.5rem 0.5rem 0.5rem 0;
		}

		.card-column.column-1 {
			padding: 0 !important;
			margin: 0 !important;
			padding-bottom: 1rem !important;
			border-right: none !important;
		border-bottom: 1px solid #e0e0e0;
			width: 100%;
		}

		.card-column.column-2 {
			padding: 0 !important;
			margin: 0 !important;
			padding-left: 0 !important;
			padding-right: 0 !important;
			padding-top: 1rem !important;
			width: 100%;
		}

		.card-column {
			align-items: flex-start;
		}

		.card-column.column-2 .card-field {
			margin-left: 0;
			padding-left: 0;
	}

	.card-header {
		padding: 0.5rem 0.5rem 0.5rem 0 !important;
		flex-wrap: wrap;
		gap: 0.5rem;
		flex-direction: column;
	}

	.card-header > .header-date {
		position: static;
		margin-bottom: 0;
		margin-left: 0;
		padding-left: 0;
		order: -2;
		font-size: 0.7rem;
	}

	.header-right {
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		justify-content: flex-start;
		order: -1;
		margin-bottom: 0.5rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid #e0e0e0;
		margin-left: 0;
		padding-left: 0;
	}

	/* Expanded there are no names below, so the rule under the tags would sit
	   directly on the header's own bottom border */
	.card-header.expanded .header-right {
		margin-bottom: 0;
		padding-bottom: 0;
		border-bottom: none;
	}

	/* 1.2rem to match the date above it, which is absolutely placed at that left.
	   The !important is holding off the desktop 5rem indent, declared later in
	   the file at the same specificity. */
	.header-content {
		gap: 0;
		margin-left: 1.2rem !important;
		margin-bottom: 1.1rem;
		padding-left: 0;
		width: 100%;
		order: 1;
		flex-direction: column;
	}

	.header-left {
		width: 100%;
		padding-bottom: 0.5rem;
		border-bottom: none;
		margin-bottom: 0.5rem;
		margin-left: 0;
		padding-left: 0;
	}

	.card-header .header-left::before {
		content: 'AI Company';
		display: block;
		font-size: 0.65rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: #666;
		margin-bottom: 0.25rem;
	}

	.card.lawsuit .header-left::before {
		content: 'Defendant';
	}

	.header-left .header-item {
		font-weight: 600;
		font-size: 0.85rem;
	}

	.header-right-content {
		width: 100%;
		padding-top: 0;
		margin-left: 0;
		padding-left: 0;
	}

	.card-header .header-right-content::before {
		content: 'Publication(s)';
		display: block;
		font-size: 0.65rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: #666;
		margin-bottom: 0.25rem;
	}

	.card.lawsuit .header-right-content::before {
		content: 'Plaintiff';
	}

	.header-right-content .header-item {
		font-weight: 600;
		font-size: 0.85rem;
	}

	.header-separator {
		display: none;
	}

	.header-item {
		font-size: 0.8rem;
		line-height: 1.4;
	}

	.header-date {
		font-size: 0.7rem;
	}

		.interaction-tags {
			display: flex;
			flex-wrap: wrap;
			gap: 0.3rem;
	}

	.interaction-tag {
		font-size: 0.6rem;
		padding: 0.15rem 0.4rem;
	}


		.type-tag {
			font-size: 0.75rem;
			padding: 0.25rem 0.6rem;
			background-color: #f5f5f5;
			margin: 0.2rem 0.2rem 0.2rem 0;
		}

		.card-field {
			gap: 0.25rem;
		display: flex;
		flex-direction: column;
			align-items: flex-start;
		}

		.field-label {
			font-size: 0.65rem;
			width: 100%;
			text-align: left;
		}

		.field-value {
		font-size: 0.85rem;
			width: 100%;
			text-align: left;
		}

		.type-tags-wrapper {
			display: flex;
			flex-wrap: wrap;
			gap: 0.4rem;
		}




		.affected-publications {
			margin-left: 1.25rem;
			padding-left: 0.75rem;
		}

		.affected-title {
			font-size: 0.75rem;
			padding-left: 0.75rem;
		}

		.affected-title::before {
			left: -0.75rem;
			width: 0.75rem;
		}

		.affected-title:not(:last-child)::after {
			left: -0.75rem;
		}

		.affected-note {
			font-size: 0.6rem;
			padding-left: 0;
		}

		/* Removed asterisk - now using parentheses */
		/* .affected-note::before {
			left: -0.75rem;
			width: 0.75rem;
		} */

		.hierarchy-intermediate {
			padding-left: 0.75rem;
		}

		.hierarchy-intermediate::before {
			left: -0.75rem;
			width: 0.75rem;
		}

		.hierarchy-intermediate-children {
			margin-left: 0.75rem;
			padding-left: 0.75rem;
		}


		.source-link {
		font-size: 0.85rem;
			word-break: break-word;
		}

		.expand-icon {
			font-size: 1rem;
		}


	}

	.card {
		width: 100%;
		min-width: 0;
		background-color: #fff;
		border: 1px solid #e0e0e0;
		border-radius: 0;
		box-shadow: none;
		transition: background-color 0.2s ease;
		display: flex;
		flex-direction: column;
		margin-bottom: 0;
		margin-left: 0;
		box-sizing: border-box;
		position: relative;
		overflow: hidden;
	}

	.card.collapsed {
		background-color: #f5f5f5 !important;
	}

	.card:not(.collapsed) {
		background-color: #ffffff;
	}

	/* Remove hover effect on expanded cards */
	.card:not(.collapsed):hover {
		background-color: #ffffff;
	}

	/* Colored Header */
	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0.75rem 1.2rem;
		background-color: #fafafa;
		color: #333;
		font-weight: 600;
		font-size: 0.8rem;
		letter-spacing: 0.5px;
		border-radius: 0;
		border-bottom: 1px solid #e0e0e0;
		cursor: pointer;
		user-select: none;
		transition: background-color 0.2s ease;
		position: relative;
	}

	/* Lifted out of the flow so it can sit at the header's left edge without the
	   names having to leave room for it. This wins on mobile too, where the
	   header stacks — the names there are indented to match its 1.2rem. */
	.card-header > .header-date {
		position: absolute;
		left: 1.2rem;
		top: 0.75rem;
		line-height: 1.5;
	}

	.card-header:hover {
		background-color: rgba(0, 0, 0, 0.02);
	}

	.card-header.grant:hover {
		background-color: rgba(0, 0, 0, 0.02);
	}

	.card-header.lawsuit:hover {
		background-color: rgba(0, 0, 0, 0.02);
	}

	.card-header.deal:hover {
		background-color: rgba(0, 0, 0, 0.02);
	}

	.card.lawsuit:not(.has-multiple-interactions) {
		border-left: 3px solid #e57373;
	}

	.card.grant:not(.has-multiple-interactions) {
		border-left: 3px solid #64b5f6;
	}

	.card.deal:not(.has-multiple-interactions) {
		border-left: 3px solid #81c784;
	}

	/* Multiple interaction borders using gradient */
	.card.has-multiple-interactions {
		border-left: none;
		position: relative;
	}

	.card.has-multiple-interactions::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 3px;
		z-index: 1;
		background: var(--border-gradient, #81c784);
	}

	.header-content {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		flex: 1;
		min-width: 0;
		margin-left: 5rem;
	}

	.header-left {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex-shrink: 0;
		align-items: flex-start;
	}

	.header-separator {
		width: 1px;
		background-color: #d0d0d0;
		align-self: stretch;
		margin: 0.2rem 0;
		flex-shrink: 0;
	}

	.header-right-content {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1;
		min-width: 0;
		align-items: flex-start;
	}

	.header-item {
		font-weight: 600;
		font-size: 0.75rem;
		line-height: 1.5;
		color: #333;
		word-wrap: break-word;
		overflow-wrap: break-word;
	}


	.header-right {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-shrink: 0;
		flex-direction: row;
		justify-content: flex-end;
		align-self: flex-start;
	}

	/* Expanded, the names are gone and the date is absolutely placed, so the tags
	   are the only item left in flow — and space-between puts a lone item at the
	   start, on top of the date. Scoped wide, since on mobile the header is a
	   column where justify-content would distribute vertically instead. */
	@media screen and (min-width: 769px) {
		.card-header.expanded {
			justify-content: flex-end;
		}

		/* Expanded, the tags are the only thing setting the header's height, and
		   the date is out of the flow at the padding edge — 3.7px above their
		   centre, since the tag row is the taller of the two. Centring the date
		   in the header is the same as centring it against them. */
		.card-header.expanded > .header-date {
			top: 50%;
			transform: translateY(-50%);
		}
	}

	.interaction-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
	}

	.interaction-tag {
		display: inline-block;
		padding: 0.2rem 0.5rem;
		border-radius: 3px;
		font-size: 0.65rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		white-space: nowrap;
	}

	.interaction-tag.lawsuit {
		background-color: #f5c2c2;
		color: #8b1a1a;
	}

	.interaction-tag.deal {
		background-color: #c8e6c9;
		color: #2e7d32;
	}

	.interaction-tag.grant {
		background-color: #bbdefb;
		color: #1565c0;
	}

	.header-date {
		font-size: 0.65rem;
		color: #666;
		font-weight: 500;
		white-space: nowrap;
		line-height: 1.5;
		margin: 0;
		padding: 0;
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
		border: 1px solid #e0e0e0;
	}
	
	.type-tags-wrapper {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
	}

	.expand-icon {
		font-size: 1.2rem;
		font-weight: 300;
		line-height: 1.2;
		width: 1.5rem;
		text-align: center;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.2s ease;
		flex-shrink: 0;
		margin: 0;
		padding: 0;
	}

	/* Two Column Content Layout */
	.card-content {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0;
		padding: 1.5rem;
		position: relative;
		cursor: pointer;
	}

	/* Anchored to the card, not the content, so it lands on the same spot
	   the header's expand icon occupies when the card is collapsed. */

	.card-column {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 0;
		overflow-wrap: break-word;
		word-wrap: break-word;
	}

	.card-column.column-1 {
		padding-right: 1.5rem;
		border-right: 1px solid #e0e0e0;
	}

	.card-column.column-2 {
		padding-left: 1.5rem;
	}


	.source-link {
		color: #254c6f;
		text-decoration: none;
		font-size: 0.9rem;
		transition: color 0.2s ease;
		word-break: break-word;
		overflow-wrap: break-word;
	}

	.source-link:hover {
		color: #1a3a52;
		text-decoration: underline;
	}

	.card-field {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.field-label {
		font-size: 0.65rem;
		font-weight: 400;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: #999;
		margin-bottom: 0.05rem;
	}

	.field-value {
		font-size: 0.9rem;
		line-height: 1.5;
		color: #1a1a1a;
		font-weight: 500;
		word-wrap: break-word;
		overflow-wrap: break-word;
		word-break: break-word;
		min-width: 0;
	}

	/* Field items - display items in flex layout */
	.field-value:has(.field-item):not(:has(.publisher-item)) {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		align-items: flex-start;
	}
	
	.field-item,
	.field-value,
	.field-label,
	.citation-link,
	.affected-title,
	.hierarchy-intermediate-name {
		cursor: default;
	}

	.field-item {
		font-size: 0.9rem;
		color: #1a1a1a;
		font-weight: 500;
		line-height: 1.5;
		word-wrap: break-word;
		overflow-wrap: break-word;
	}

	.field-value:has(.publisher-item) {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		align-items: flex-start;
	}


	/* Publisher Hierarchy Styles */

	/* Vertical line from field-label to all children */

	.publisher-item {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		position: relative;
		width: fit-content;
		align-items: flex-start;
		margin-bottom: 0;
	}
	
	/* Add margin only when publisher-item has children */
	.publisher-item:has(.affected-publications) {
		margin-bottom: 0.3rem;
	}
	
	/* Reduce margin when publisher-item has hierarchy-intermediate (grandchildren) */
	.publisher-item:has(.hierarchy-intermediate) {
		margin-bottom: 0.2rem;
	}

	/* Vertical line from tag down to connect with children */




	.affected-publications {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		margin-left: 0.5rem;
		padding-left: 0.5rem;
		position: relative;
		margin-top: 0.15rem;
		padding-top: 0.15rem;
		border-left: 1.5px solid #e5e5e5;
	}
	
	/* Reduce gap when affected-publications contains hierarchy-intermediate (grandchildren) */
	.affected-publications:has(.hierarchy-intermediate) {
		gap: 0.1rem;
	}

	.news-org-header {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		margin-bottom: 0.4rem;
	}

	.news-org-header .field-label {
		margin-bottom: 0;
	}

	.affected-note {
		font-size: 0.6rem;
		line-height: 1.3;
		color: #b0b0b0;
		font-style: normal;
		letter-spacing: 0.2px;
	}

	.hierarchy-intermediate {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin-left: 0;
		padding-left: 0.5rem;
		position: relative;
		margin-top: 0.1rem;
		margin-bottom: 0.1rem;
	}

	/* Horizontal dash connecting from vertical line to this child */
	.hierarchy-intermediate::before {
		content: '';
		position: absolute;
		left: -0.5rem;
		top: 0.75rem;
		width: 0.5rem;
		height: 1.5px;
		background-color: #e5e5e5;
	}


	.hierarchy-intermediate-name {
		font-size: 0.8rem;
		color: #333;
		font-weight: 400;
		line-height: 1.5;
		position: relative;
		padding-left: 0;
		margin-bottom: 0;
	}

	.hierarchy-label {
		font-weight: 600;
		color: #666;
		font-size: 0.75rem;
	}

	.hierarchy-intermediate-children {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin-left: 1.25rem;
		padding-left: 0.5rem;
		position: relative;
		margin-top: 0.15rem;
		border-left: 1.5px solid #e5e5e5;
		padding-top: 0.15rem;
	}

	/* Horizontal dash connecting from vertical line to each publication */
	.affected-title::before {
		content: '';
		position: absolute;
		left: -0.5rem;
		top: 0.75rem;
		width: 0.5rem;
		height: 1.5px;
		background-color: #e5e5e5;
	}

	.affected-title {
		font-size: 0.8rem;
		color: #555;
		font-weight: 400;
		line-height: 1.5;
		font-style: italic;
		position: relative;
		padding-left: 0.75rem;
		margin: 0;
	}

	/* Country code for a publication; a publication in several countries gets
	   several. Quiet by default — on a card of forty titles the code repeats and
	   it is the name that should read first */
	.publication-country {
		font-style: normal;
		margin-left: 0.25rem;
		cursor: help;
		position: relative;
		display: inline-block;
	}

	/* The country being filtered on, so it is clear which name put the entry in
	   the results. A pale wash of the search-hit yellow — the code is 0.65rem and
	   repeats down the column, so it wants marking, not shouting */
	.publication-country.filtered {
		background-color: #fdf3c7;
		color: #4a3c00;
		font-weight: 600;
		border-radius: 2px;
		padding: 0.05rem 0.25rem;
		margin-left: 0.3rem;
	}

	/* Names the country on hover. The card clips at its edges, so this sits above
	   the code, where a name always has card left over it */
	.publication-country::after {
		content: attr(data-place);
		position: absolute;
		bottom: calc(100% + 0.25rem);
		left: 0;
		z-index: 5;
		padding: 0.25rem 0.5rem;
		background-color: #1a1a1a;
		color: #fff;
		font-size: 0.7rem;
		font-weight: 400;
		letter-spacing: 0.3px;
		white-space: nowrap;
		opacity: 0;
		visibility: hidden;
		transition: opacity 0.15s ease;
		pointer-events: none;
	}

	.publication-country:hover::after {
		opacity: 1;
		visibility: visible;
	}


	.card-field.reported-details .field-value {
		line-height: 1.6;
		font-weight: 400;
	}

	.card-field.case-details-field {
		padding-bottom: 0;
		margin-bottom: 0;
	}

	.citations-section {
		margin-top: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.citations-label {
		font-size: 0.65rem;
		font-weight: 400;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: #999;
		margin-bottom: 0.3rem;
	}

	.citations {
		display: block;
		line-height: 1.6;
		word-wrap: break-word;
		overflow-wrap: break-word;
	}

	.citation-link {
		color: #254c6f;
		text-decoration: none;
		font-size: 0.9rem;
		font-weight: 400;
		transition: color 0.2s ease;
		display: inline-block;
		overflow-wrap: anywhere;
		word-break: normal;
		hyphens: none;
	}

	.citation-link:hover {
		color: #1a3a52;
		text-decoration: underline;
	}

	.citation-separator {
		color: #666;
		margin: 0 0.15rem;
	}

	.status-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0.6rem;
		border-radius: 4px;
		background-color: #f5f5f5;
		font-size: 0.85rem;
	}

	.status-indicator {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	/* One colour per status, shared by the single-status badge and the dots of a
	   progression chain, so the same status reads the same on every card.
	   Adding a status means adding one line here and one case in getStatusClass. */
	.status-badge.in-progress,
	.status-chain-step.in-progress { --status-color: #ffb300; --status-glow: rgba(255, 179, 0, 0.2); }
	.status-badge.settled,
	.status-chain-step.settled { --status-color: #4caf50; --status-glow: rgba(76, 175, 80, 0.2); }
	.status-badge.dismissed,
	.status-chain-step.dismissed { --status-color: #9e9e9e; --status-glow: rgba(158, 158, 158, 0.2); }
	.status-badge.decided,
	.status-chain-step.decided { --status-color: #254c6f; --status-glow: rgba(37, 76, 111, 0.2); }
	.status-badge.consolidated,
	.status-chain-step.consolidated { --status-color: #8d6e63; --status-glow: rgba(141, 110, 99, 0.2); }
	.status-badge.default,
	.status-chain-step.default { --status-color: #666; --status-glow: rgba(102, 102, 102, 0.2); }

	.status-badge .status-indicator {
		background-color: var(--status-color);
		box-shadow: 0 0 0 2px var(--status-glow);
	}

	.status-text {
		color: #333;
		font-weight: 400;
	}



	/* ===== Case progression (rows sharing a lawsuit_id) ===== */

	/* Newest entry: the chain of statuses the case has moved through.
	   Stacked rather than inline — chained chips wrapped mid-sequence and left
	   arrows stranded at the start of a line. */
	.status-chain {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.status-chain-step {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: baseline;
		column-gap: 0.5rem;
		position: relative;
	}

	/* Rail joining one status to the next, standing in for the arrows */
	.status-chain-step:not(:last-child)::before {
		content: '';
		position: absolute;
		left: 3px;
		top: 1.05em;
		height: calc(100% - 0.5em);
		border-left: 1px solid #dcdcdc;
	}

	/* Neutral by default — only the step this card is gets its status colour, so
	   the colour marks where you are rather than repeating down the whole chain. */
	.status-chain-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background-color: #cfcfcf;
		/* Baseline alignment nudges the dot onto the text's optical centre */
		transform: translateY(-0.15em);
	}

	.status-chain-label {
		font-size: 0.8rem;
		color: #777;
		line-height: 1.3;
		text-align: left;
	}

	/* The step this card is */
	.status-chain-step.current .status-chain-label {
		color: #1a1a1a;
		font-weight: 600;
	}

	.status-chain-step.current .status-chain-dot {
		background-color: var(--status-color, #666);
		box-shadow: 0 0 0 3px var(--status-glow, rgba(102, 102, 102, 0.2));
	}

	.status-chain-step.current .status-chain-date {
		color: #555;
	}

	/* Other steps jump to that card */
	.status-chain-jump {
		padding: 0;
		background: none;
		border: none;
		font-family: inherit;
		cursor: pointer;
		text-decoration: underline;
		text-decoration-color: #d5d5d5;
		text-underline-offset: 2px;
	}

	.status-chain-jump:hover {
		color: #DE5A35;
		text-decoration-color: currentColor;
	}

	.status-chain-jump:focus-visible {
		outline: 2px solid #DE5A35;
		outline-offset: 2px;
	}

	.status-chain-date {
		font-size: 0.68rem;
		font-variant-numeric: tabular-nums;
		color: #888;
		white-space: nowrap;
	}

	/* Brief highlight when a card is jumped to from its sibling entry */
	:global(.card.case-flash) {
		animation: case-flash 1.2s ease-out;
	}

	@keyframes case-flash {
		0%, 40% { box-shadow: 0 0 0 3px rgba(222, 90, 53, 0.45); }
		100% { box-shadow: 0 0 0 3px rgba(222, 90, 53, 0); }
	}

	@media (prefers-reduced-motion: reduce) {
		:global(.card.case-flash) { animation: none; }
	}










	.no-results {
		grid-column: 1 / -1;
		text-align: center;
		color: #999;
		padding: 3rem;
		font-style: italic;
		background-color: #fff;
		border: 1px solid #e0e0e0;
		border-radius: 8px;
	}

	.highlight {
		background-color: #ffeb3b;
		padding: 0;
		border-radius: 2px;
		font-weight: 600;
		color: #1a1a1a;
	}

	/* Related Cards - Integrated Design */
	/* Related Cards - Filter View Design */








	.related-cards-toggle {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid #e0e0e0;
	}

	.related-toggle-btn {
		background: none;
		border: none;
		color: #254c6f;
		cursor: pointer;
		font-size: 0.85rem;
		padding: 0.5rem 0.75rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		transition: all 0.2s ease;
		font-family: inherit;
		font-weight: 500;
		text-align: left;
		border-radius: 4px;
		width: 100%;
	}

	.related-toggle-btn:hover {
		background-color: #f0f4f8;
		color: #1a3a52;
	}

 .related-toggle-btn.publisher-network-btn {
  background:#fffbea;
  border:1px solid #d8c779;
  padding:0.85rem 1rem;
  gap:0.85rem;
 }
 .related-toggle-btn.publisher-network-btn:hover { background:#fff5d4; border-color:#c7b565; }
 .publisher-network-btn:focus-visible { outline:2px solid #254c6f; outline-offset:3px; }
 .network-icon { width:32px; height:32px; object-fit:contain; flex-shrink:0; }
 .network-button-copy { display:flex; flex-direction:column; gap:0.25rem; }
 .network-button-copy strong { font-size:0.9rem; line-height:1.35; font-weight:600; }


	@media screen and (max-width: 768px) {



		.related-cards-toggle {
			margin-top: 0.75rem;
			padding-top: 0.75rem;
		}

		.related-toggle-btn {
			font-size: 0.8rem;
			padding: 0.4rem 0.6rem;
		}
	}

	/* ====================================================================
	   Related-view: spotlight tray overlay
	   ==================================================================== */

	.related-backdrop {
		position: fixed;
		inset: 0;
		z-index: 900;
		background: rgba(20, 24, 32, 0.28);
		cursor: pointer;
		animation: backdrop-fade 180ms ease-out;
	}
	@keyframes backdrop-fade {
		from { opacity: 0; }
		to   { opacity: 1; }
	}

	.related-tray-close {
		position: fixed;
		top: 14px;
		right: 16px;
		z-index: 1100;
		background: #fff;
		border: 1px solid #d4d4d4;
		border-radius: 0;
		width: 32px;
		height: 32px;
		font-size: 1.1rem;
		line-height: 1;
		color: #555;
		cursor: pointer;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
		transition: background 0.15s ease, color 0.15s ease;
	}
	.related-tray-close:hover { background: #f3f3f3; color: #222; }

	.card-view.related-active .timeline-container {
		position: relative;
		z-index: 1000;
		max-width: 980px;
		margin: 48px auto 64px;
		background: #fff;
		padding: 20px 24px 24px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05);
		animation: tray-rise 220ms cubic-bezier(0.2, 0.7, 0.2, 1);
	}
	.card-view.related-active .timeline-container::before {
		content: 'Related cluster';
		display: block;
		font-size: 0.7rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #999;
		margin-bottom: 12px;
		padding-bottom: 8px;
		border-bottom: 1px solid #eee;
	}
	.card-view.related-active .card-wrapper.is-source .card {
		box-shadow: 0 0 0 1px #254c6f, 0 2px 6px rgba(37, 76, 111, 0.08);
	}
	.card-view.related-active .card-wrapper.is-related .card {
		box-shadow: 0 0 0 1px #d4dde6, 0 1px 3px rgba(0, 0, 0, 0.04);
	}
	@keyframes tray-rise {
		from { opacity: 0; transform: translateY(8px); }
		to   { opacity: 1; transform: translateY(0); }
	}

	@media (max-width: 600px) {
		.card-view.related-active .timeline-container {
			margin: 24px 8px 80px;
			padding: 16px;
		}
		.related-tray-close {
			top: 10px;
			right: 10px;
		}
	}
</style>

