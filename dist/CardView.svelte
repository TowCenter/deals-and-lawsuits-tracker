<script>
	import { getColumnKey, parseArray, formatDate, parseUrls, formatCitations } from './utils.js';

	/**
	 * @typedef {Object} Props
	 * @property {Array<Object>} [data=[]] - Card data rows
	 * @property {string[]} [columns=[]] - Column names (for filtering/search compatibility)
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

	let expandedCards = $state(new Set());
	
	// Helper to check if a card is a related card (not the main one) in filtered view
	function isRelatedCardInFilteredView(row) {
		if (viewingRelatedTo == null) return false;
		const sourceRow = idToRowMap.get(viewingRelatedTo);
		if (!sourceRow || !sourceRow.related_ids) return false;
		// If this is the main card, it's not a related card
		if (row.id === viewingRelatedTo) return false;
		// If this card is in the related_ids, it's a related card
		return Array.isArray(sourceRow.related_ids) && sourceRow.related_ids.includes(row.id);
	}
	
	// Helper to check if a card is expanded
	function isCardExpanded(cardId, row) {
		return expandedCards.has(cardId);
	}
	
	// Removed auto-expand effect - it was causing inconsistent behavior
	// Related cards will start expanded naturally when entering related view
	let viewingRelatedTo = $state(null); // ID of the card whose related items we're viewing, or null for all

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

	function toggleExpandCard(cardIndex) {
		const newSet = new Set(expandedCards);
		if (newSet.has(cardIndex)) {
			newSet.delete(cardIndex);
		} else {
			newSet.add(cardIndex);
		}
		expandedCards = newSet;
	}

	function handleCardContentClick(event, cardId) {
		// Check if text is currently selected/highlighted
		const selection = window.getSelection();
		if (selection && selection.toString().trim().length > 0) {
			return; // Don't collapse if text is selected
		}
		
		// Don't collapse if clicking on links or the collapse button (let them work normally)
		const target = event.target;
		if (target.tagName === 'A' || target.closest('a') || target.closest('.collapse-button')) {
			return; // Let links and collapse button work normally
		}
		// Collapse the card when clicking anywhere else
		toggleExpandCard(cardId);
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
	 * Recursively extracts all publications and organization names from a hierarchy tree
	 * @param {Object} tree - Hierarchy tree node
	 * @returns {Set<string>} Set of all publication and organization names
	 */
	function extractAllFromTree(tree) {
		const result = new Set();
		if (!tree || typeof tree !== 'object') return result;
		
		for (const key in tree) {
			if (key === 'publications' && Array.isArray(tree[key])) {
				for (const pub of tree[key]) {
					const trimmed = String(pub || '').trim();
					if (trimmed) result.add(trimmed);
				}
			} else if (typeof tree[key] === 'object' && tree[key] !== null) {
				const trimmed = String(key || '').trim();
				if (trimmed) result.add(trimmed);
				// Recursively extract from child nodes
				const childResults = extractAllFromTree(tree[key]);
				for (const item of childResults) {
					result.add(item);
				}
			}
		}
		
		return result;
	}

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

	/**
	 * Gets all publications and organizations from a row including those in hierarchy tree
	 * @param {Object} row - Data row
	 * @param {Object} hierarchyTree - Hierarchy tree built from parent_child_matches
	 * @param {string[]} orgsToDisplay - Organizations to check in the tree
	 * @returns {Set<string>} Set of all publication and organization names
	 */
	function getAllPublicationsIncludingHierarchy(row, hierarchyTree, orgsToDisplay) {
		const result = new Set();
		
		// Add direct publishers
		const allPublishers = getAllPublishers(row);
		for (const pub of allPublishers) {
			result.add(pub);
		}
		
		// Add publications from hierarchy tree
		for (const org of orgsToDisplay) {
			const orgTree = hierarchyTree[org] || {};
			const treeItems = extractAllFromTree(orgTree);
			for (const item of treeItems) {
				result.add(item);
			}
		}
		
		return result;
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
		// If viewing related cards, filter to show the main card and its related cards
		let dataToFilter = data;
		if (viewingRelatedTo != null) {
			const sourceRow = idToRowMap.get(viewingRelatedTo);
			if (sourceRow && sourceRow.related_ids && Array.isArray(sourceRow.related_ids)) {
				const relatedRows = [sourceRow]; // Include the main card
				for (const id of sourceRow.related_ids) {
					const relatedRow = idToRowMap.get(id);
					if (relatedRow) {
						relatedRows.push(relatedRow);
					}
				}
				dataToFilter = relatedRows;
			} else {
				dataToFilter = [];
			}
		}
		
		// Early return if no filters
		if (!filterInteraction?.length && !filterType?.length && !filterPlatform?.length && 
		    !filterPublishers?.length && !searchQuery?.trim()) {
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
			(filterPublishers?.length > 0);

		if (hasActiveFilters) {
			// Expand all filtered cards
			const filteredCardIds = new Set();
			for (const [monthYear, items] of Object.entries(groupedData)) {
				for (let rowIndex = 0; rowIndex < items.length; rowIndex++) {
					const row = items[rowIndex];
					filteredCardIds.add(`${monthYear}-${rowIndex}-${row.date || ''}`);
				}
			}
			expandedCards = filteredCardIds;
		} else {
			// Collapse all cards
			expandedCards = new Set();
		}
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

	// Get display text for a source URL
	function getSourceDisplayTextImpl(url) {
		const archiveInfo = getArchiveInfo(url);
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
	 * Gets related cards for a given row based on related_ids
	 * @param {Object} row - Data row
	 * @returns {Object[]} Array of related card rows, sorted by date (newest first)
	 */
	function getRelatedCards(row) {
		if (!row.related_ids || !Array.isArray(row.related_ids) || row.related_ids.length === 0) {
			return [];
		}
		
		const relatedCards = [];
		for (const id of row.related_ids) {
			const relatedRow = idToRowMap.get(id);
			if (relatedRow) {
				relatedCards.push(relatedRow);
			}
		}
		
		// Sort by date (newest first)
		relatedCards.sort((a, b) => {
			const aDate = parseDate(a.date || '');
			const bDate = parseDate(b.date || '');
			return bDate.getTime() - aDate.getTime();
		});
		
		return relatedCards;
	}

	/**
	 * Gets the intersection of publishers between two rows (including hierarchy)
	 * Uses exact matching (case-insensitive) - no substring matching
	 * @param {Object} mainRow - Main card row
	 * @param {Object} relatedRow - Related card row
	 * @returns {string[]} Array of shared publisher names
	 */
	function getSharedPublishers(mainRow, relatedRow) {
		// Get all publications from main row (including hierarchy)
		const mainPublishers = new Set();
		const mainAllPublishers = getAllPublishers(mainRow);
		for (const pub of mainAllPublishers) {
			const normalized = String(pub).trim().toLowerCase();
			if (normalized) {
				mainPublishers.add(normalized);
			}
		}
		
		// Get all publications from related row (including hierarchy)
		const relatedPublishers = new Set();
		const relatedAllPublishers = getAllPublishers(relatedRow);
		for (const pub of relatedAllPublishers) {
			const normalized = String(pub).trim().toLowerCase();
			if (normalized) {
				relatedPublishers.add(normalized);
			}
		}
		
		// Find exact intersection (case-insensitive, no substring matching)
		const shared = [];
		const addedNormalized = new Set();
		const mainPubsArray = Array.from(mainAllPublishers);
		for (const pub of mainPubsArray) {
			const pubNormalized = String(pub).trim().toLowerCase();
			if (pubNormalized && relatedPublishers.has(pubNormalized) && !addedNormalized.has(pubNormalized)) {
				shared.push(String(pub).trim());
				addedNormalized.add(pubNormalized);
			}
		}
		
		return shared;
	}

	function viewRelatedCards(cardId) {
		viewingRelatedTo = cardId;
	}

	function viewAllCards() {
		// Get the source card ID before clearing viewingRelatedTo
		const sourceCardId = viewingRelatedTo;
		viewingRelatedTo = null;
		
		// Collapse all cards except the source card
		if (sourceCardId != null) {
			// Use a microtask to ensure groupedData is updated
			queueMicrotask(() => {
				const grouped = groupedData;
				const newSet = new Set();
				
				// Find and keep only the source card expanded
				for (const [monthYear, items] of Object.entries(grouped)) {
					for (let index = 0; index < items.length; index++) {
						const item = items[index];
						if (item.id === sourceCardId) {
							const cardId = `${monthYear}-${index}-${item.date || ''}`;
							newSet.add(cardId);
							break;
						}
					}
				}
				
				expandedCards = newSet;
			});
		} else {
			// If no source card, collapse all
			expandedCards = new Set();
		}
	}
</script>

<div class="card-view">
	{#if viewingRelatedTo != null}
		{@const sourceRow = idToRowMap.get(viewingRelatedTo)}
		{#if sourceRow}
			<div class="related-view-banner">
				<div class="related-view-banner-content">
					<span class="related-view-banner-icon">🔗</span>
					<span class="related-view-banner-text">
						Viewing related cards
						{#if Array.isArray(sourceRow.platform) && sourceRow.platform.length > 0}
							<span class="related-view-banner-detail">• {sourceRow.platform[0]}</span>
						{/if}
						{#if sourceRow.date}
							<span class="related-view-banner-detail">• {formatDate(sourceRow.date)}</span>
						{/if}
					</span>
				</div>
			</div>
		{/if}
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
					{#each items as row, rowIndex (row)}
			{@const interactionTypes = getInteractionTypes(row.interaction)}
			{@const interactionType = getInteractionType(row.interaction)}
						{@const allPublishers = Array.isArray(row.organization_publisher_named_in_deal_suit) ? row.organization_publisher_named_in_deal_suit : []}
						{@const cardId = `${monthYear}-${rowIndex}-${row.date || ''}`}
						{@const allSources = normalizeSources(row.sources)}
						{@const aiCompany = Array.isArray(row.platform) && row.platform.length > 0 ? row.platform[0] : '—'}
						{@const parentChildMatches = Array.isArray(row.parent_child_matches) ? row.parent_child_matches : []}
						{@const orgsToDisplay = interactionType === 'lawsuit' && Array.isArray(row.plaintiff) && row.plaintiff.length > 0 ? row.plaintiff : allPublishers}
						{@const hierarchyTree = buildHierarchyTree(parentChildMatches, orgsToDisplay)}
						{@const relatedCards = getRelatedCards(row)}
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
						{@const isRelatedCard = viewingRelatedTo != null && isRelatedCardInFilteredView(row)}
						<div class="card-wrapper" data-card-id={cardId} class:related-card-wrapper={isRelatedCard}>
			<div 
				class="card {interactionType}" 
				class:collapsed={!isCardExpanded(cardId, row)}
				class:has-multiple-interactions={interactionTypes.length > 1}
				class:related-card={isRelatedCard}
				style={borderGradient ? `--border-gradient: ${borderGradient};` : ''}
			>
								<!-- Colored Header -->
								{#if !isCardExpanded(cardId, row)}
								<div 
									class="card-header {interactionType}"
									onclick={() => toggleExpandCard(cardId)}
									role="button"
									tabindex="0"
									onkeydown={(e) => e.key === 'Enter' && toggleExpandCard(cardId)}
								>
									{#if row.date}
										<div class="header-date">{formatDate(row.date)}</div>
									{/if}
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
									<div class="header-right">
										<div class="interaction-tags">
											{#each interactionTypes as interaction}
												<span class="interaction-tag {interaction}">
													{interaction === 'lawsuit' ? 'Lawsuit' : interaction === 'grant' ? 'Grant' : 'Deal'}
												</span>
											{/each}
										</div>
										<span class="expand-icon">{isCardExpanded(cardId, row) ? '−' : '+'}</span>
						</div>
						</div>
					{/if}
					
								<!-- Two Column Layout -->
								{#if isCardExpanded(cardId, row)}
									<div class="card-content" onclick={(e) => handleCardContentClick(e, cardId)}>
										<div class="collapse-button" onclick={(e) => { e.stopPropagation(); toggleExpandCard(cardId); }} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && toggleExpandCard(cardId)}>
											<span class="expand-icon">−</span>
										</div>
									<!-- Column 1 -->
									<div class="card-column column-1">
					<div class="card-field">
						<div class="field-label">{interactionType === 'lawsuit' ? 'Defendant(s)' : 'AI Company'}</div>
						<div class="field-value">
							{#if interactionType === 'lawsuit' && Array.isArray(row.defendant) && row.defendant.length > 0}
								{#each row.defendant as defendant}
									<div class="field-item">{@html highlightText(defendant)}</div>
								{/each}
							{:else if Array.isArray(row.platform) && row.platform.length > 0}
								{#each row.platform as platform}
									<div class="field-item">{@html highlightText(platform)}</div>
								{/each}
					{/if}
								</div>
				</div>

					<div class="card-field news-org-field">
						<div class="field-label">{interactionType === 'lawsuit' ? 'Plaintiff(s)' : 'Publication(s)'}</div>
						<div class="field-value">
							{#each (interactionType === 'lawsuit' && Array.isArray(row.plaintiff) && row.plaintiff.length > 0 ? row.plaintiff : allPublishers) as org}
								{@const orgTree = hierarchyTree[org] || {}}
								{@const hasMatches = Object.keys(orgTree).length > 0 || (orgTree.publications && orgTree.publications.length > 0)}
								<div class="publisher-item">
									<div class="field-item">{@html highlightText(org)}</div>
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
							{#if (interactionType === 'lawsuit' && Array.isArray(row.plaintiff) && row.plaintiff.length > 0 ? row.plaintiff : allPublishers).some(org => {
								const orgTree = hierarchyTree[org] || {};
								return Object.keys(orgTree).length > 0 || (orgTree.publications && orgTree.publications.length > 0);
							})}
								<div class="affected-note">
									(Publications named in {interactionType === 'lawsuit' ? 'suit' : interactionType === 'grant' ? 'deal announcement' : 'announcements or confirmed by platform'})
								</div>
							{/if}
						</div>
					</div>

					<div class="card-field">
						<div class="field-label">{interactionType === 'lawsuit' ? 'Complaint' : 'Type'}</div>
						<div class="field-value type-tags-wrapper">
							{#if Array.isArray(row.type) && row.type.length > 0}
								{#each row.type as type}
									{@const normalizedType = String(type).trim()}
									{#if normalizedType}
										<span class="type-tag">{@html highlightText(normalizedType)}</span>
									{/if}
								{/each}
							{:else if row.type}
								{@const normalizedType = String(row.type).trim()}
								{#if normalizedType}
									<span class="type-tag">{@html highlightText(normalizedType)}</span>
								{/if}
							{/if}
						</div>
					</div>

										{#if interactionType === 'lawsuit'}
											{#if row.status}
												{@const status = String(row.status).toLowerCase().trim()}
												{@const statusClass = status.includes('progress') || status.includes('pending') || status.includes('ongoing') ? 'in-progress' : status.includes('settled') || status.includes('resolved') || status.includes('closed') || status.includes('summary judgement') ? 'settled' : status.includes('dismissed') || status.includes('dropped') ? 'dismissed' : 'default'}
					<div class="card-field">
													<div class="field-label">Status:</div>
													<div class="field-value">
														<span class="status-badge {statusClass}">
															<span class="status-indicator"></span>
															<span class="status-text">{@html highlightText(row.status)}</span>
														</span>
					</div>
												</div>
											{/if}
											{#if row.location}
					<div class="card-field">
													<div class="field-label">Location:</div>
													<div class="field-value">{@html highlightText(row.location)}</div>
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
							{@html highlightText(row.reported_details || '—')}
							</span>
										</div>
									</div>

										{#if interactionType === 'lawsuit' && row.case_number && row.case_number}
											{@const caseNumber = String(row.case_number).trim()}
											{@const isUnknown = caseNumber.toLowerCase() === '(unknown)' || caseNumber.toLowerCase() === 'unknown' || caseNumber === '—' || caseNumber === 'nan'}
											{#if !isUnknown}
												<div class="card-field case-details-field">
													<div class="field-label">Case Details:</div>
													<div class="field-value">
														{#if row.case_filing && row.case_filing}
															<a href={row.case_filing} target="_blank" rel="noopener noreferrer" class="source-link">
																{@html highlightText(caseNumber)}
															</a>
														{:else}
															{@html highlightText(caseNumber)}
							{/if}
						</div>
					</div>
											{/if}
										{/if}

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
								
								<!-- Related Cards Link -->
								{#if relatedCards.length > 0}
									{@const isInRelatedView = viewingRelatedTo != null && (viewingRelatedTo === row.id || isRelatedCardInFilteredView(row))}
									{@const relatedInteractionLabel = interactionType === 'lawsuit' ? 'Lawsuit' : interactionType === 'grant' ? 'Grant' : 'Deal'}
									<div class="related-cards-toggle">
										{#if isInRelatedView}
											<button 
												class="related-toggle-btn see-all-btn"
												onclick={(e) => { e.stopPropagation(); viewAllCards(); }}
												onkeydown={(e) => e.key === 'Enter' && viewAllCards()}
												tabindex="0"
											>
												<span class="related-toggle-icon">←</span>
												<span class="related-toggle-text">See all</span>
											</button>
										{:else}
											<button 
												class="related-toggle-btn"
												onclick={(e) => { e.stopPropagation(); viewRelatedCards(row.id); }}
												onkeydown={(e) => e.key === 'Enter' && viewRelatedCards(row.id)}
												tabindex="0"
											>
												<span class="related-toggle-icon">→</span>
												<span class="related-toggle-text">
													Related {relatedInteractionLabel} ({relatedCards.length})
												</span>
											</button>
										{/if}
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

	.related-view-banner {
		max-width: 1000px;
		margin: 0 auto 1.5rem;
		padding: 0 3rem;
		background-color: #f5f5f5;
		border-left: 4px solid #666;
		padding: 0.75rem 1rem 0.75rem calc(1rem - 4px);
		border-radius: 4px;
	}

	.related-view-banner-content {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		color: #333;
	}

	.related-view-banner-icon {
		font-size: 1rem;
	}

	.related-view-banner-text {
		font-weight: 500;
	}

	.related-view-banner-detail {
		color: #666;
		font-weight: 400;
		margin-left: 0.25rem;
	}

	@media (max-width: 768px) {
		.related-view-banner {
			margin: 0 auto 1rem;
			padding: 0.75rem 1rem 0.75rem calc(1rem - 4px);
		}

		.related-view-banner-content {
			font-size: 0.85rem;
		}
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

	.card-wrapper.related-card-wrapper {
		position: relative;
		padding-left: 1.5rem;
		margin-left: 0.5rem;
	}

	.card-wrapper.related-card-wrapper::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 3px;
		background: linear-gradient(to bottom, #4a90e2, #7bb3f0);
		border-radius: 2px;
	}

	.card-wrapper.related-card-wrapper::after {
		content: '🔗';
		position: absolute;
		left: -0.75rem;
		top: 0.5rem;
		width: 1.5rem;
		height: 1.5rem;
		background-color: #4a90e2;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.7rem;
		z-index: 1;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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

	.header-content {
		gap: 0;
		margin-left: 1.1rem !important;
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

		.header-type-tags {
			display: none !important;
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

		.publisher-hierarchy {
		gap: 0.5rem;
			width: 100%;
			align-items: flex-start;
			margin-left: 1rem;
			padding-left: 0.5rem;
	}

		.publisher-tag {
		font-size: 0.75rem;
			padding: 0.2rem 0.5rem;
		}

		.hierarchy-item-text {
			font-size: 0.75rem;
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
			font-size: 0.65rem;
			padding-left: 0.75rem;
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

		.tag {
			font-size: 0.75rem;
			padding: 0.2rem 0.5rem;
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
		transition: background-color 0.2s ease, border-color 0.2s ease;
		display: flex;
		flex-direction: column;
		margin-bottom: 0;
	}

	.card.related-card {
		background-color: #f8f9ff;
		border-left: 3px solid #4a90e2;
		border-color: #d0e3ff;
		position: relative;
	}

	.card.related-card .card-header {
		position: relative;
	}

	.card.related-card .card-header::before {
		content: "Related";
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		background-color: #4a90e2;
		color: white;
		padding: 0.2rem 0.5rem;
		border-radius: 12px;
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		z-index: 1;
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

	.header-pipe {
		font-weight: 400;
		font-size: 0.85rem;
		color: #999;
		margin: 0 0.5rem;
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

	.header-type-tags {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		align-items: flex-end;
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

	.collapse-button {
		position: absolute;
		top: 0.5rem;
		right: 1rem;
		cursor: pointer;
		user-select: none;
		z-index: 10;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: 4px;
		transition: background-color 0.2s ease;
	}

	.collapse-button:hover {
		background-color: #f5f5f5;
	}

	.collapse-button .expand-icon {
		font-size: 1rem;
		color: #666;
	}

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

	.links-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.25rem;
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
	.hierarchy-item-text,
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

	.tag {
		display: inline-block;
		background-color: #f5f5f5;
		color: #2c3e50;
		padding: 0.35rem 0.75rem;
		border-radius: 4px;
		font-size: 0.85rem;
		font-weight: 500;
		line-height: 1.4;
		width: fit-content;
		max-width: 100%;
		word-wrap: break-word;
		overflow-wrap: break-word;
		border: 1px solid #e8e8e8;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
		position: relative;
	}

	/* Publisher Hierarchy Styles */
	.publisher-hierarchy {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		position: relative;
		margin-left: 1.25rem;
		padding-left: 0.75rem;
	}

	/* Vertical line from field-label to all children */
	.publisher-hierarchy::before {
		content: '';
		position: absolute;
		left: 0;
		top: -0.4rem;
		bottom: 0;
		width: 1.5px;
		background-color: #e0e0e0;
	}

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
	.publisher-item:has(.affected-publications) .tag::after {
		content: '';
		position: absolute;
		left: 0.5rem;
		bottom: -0.15rem;
		width: 1px;
		height: 0.15rem;
		background-color: #e5e5e5;
	}


	.publisher-tag {
		display: inline-block;
		background-color: #f0f0f0;
		color: #333;
		padding: 0.25rem 0.6rem;
		border-radius: 3px;
		font-size: 0.8rem;
		font-weight: 500;
		line-height: 1.4;
		white-space: nowrap;
		align-self: flex-start;
		position: relative;
	}

	.hierarchy-item-text {
		display: inline-block;
		color: #333;
		font-size: 0.8rem;
		font-weight: 500;
		line-height: 1.4;
		white-space: nowrap;
		align-self: flex-start;
		position: relative;
	}

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

	.affected-note {
		font-size: 0.65rem;
		color: #999;
		font-style: italic;
		margin-top: 0.5rem;
		position: relative;
		padding-left: 0;
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

	.status-badge.in-progress .status-indicator {
		background-color: #ffb300;
		box-shadow: 0 0 0 2px rgba(255, 179, 0, 0.2);
	}

	.status-badge.settled .status-indicator {
		background-color: #4caf50;
		box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
	}

	.status-badge.dismissed .status-indicator {
		background-color: #9e9e9e;
		box-shadow: 0 0 0 2px rgba(158, 158, 158, 0.2);
	}

	.status-badge.default .status-indicator {
		background-color: #666;
		box-shadow: 0 0 0 2px rgba(102, 102, 102, 0.2);
	}

	.status-text {
		color: #333;
		font-weight: 400;
	}

	.status-badge.header-status {
		padding: 0.15rem 0.4rem;
		background-color: transparent;
	}

	.status-badge.header-status .status-indicator {
		width: 10px;
		height: 10px;
	}

	.expand-btn {
		display: inline-block;
		margin-top: 0.5rem;
		background: none;
		border: none;
		color: #254c6f;
		cursor: pointer;
		font-size: 0.75rem;
		padding: 0;
		text-decoration: underline;
		font-weight: 500;
	}

	.expand-btn:hover {
		color: #1a3a52;
	}

	.titles-section {
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid #eee;
	}

	.titles-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.title-tag {
		display: inline-block;
		background-color: #f0f0f0;
		padding: 0.25rem 0.5rem;
		border-radius: 3px;
		font-size: 0.75rem;
		color: #333;
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
	.related-view-header {
		max-width: 1000px;
		margin: 0 auto 1.5rem;
		padding: 1rem 1.5rem;
		background-color: #f8f9fa;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.related-view-back-btn {
		background: #254c6f;
		border: none;
		color: white;
		cursor: pointer;
		font-size: 0.85rem;
		padding: 0.5rem 1rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		transition: all 0.2s ease;
		font-family: inherit;
		font-weight: 500;
		border-radius: 4px;
	}

	.related-view-back-btn:hover {
		background-color: #1a3a52;
	}

	.related-view-back-icon {
		font-size: 1rem;
		font-weight: 600;
	}

	.related-view-back-text {
		font-weight: 500;
	}

	.related-view-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
		font-size: 0.9rem;
	}

	.related-view-label {
		color: #666;
		font-weight: 400;
	}

	.related-view-source {
		color: #333;
		font-weight: 500;
	}

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

	.related-toggle-btn.see-all-btn {
		color: #666;
	}

	.related-toggle-btn.see-all-btn:hover {
		background-color: #f5f5f5;
		color: #333;
	}

	.related-toggle-icon {
		font-size: 1rem;
		font-weight: 600;
		color: #254c6f;
		transition: transform 0.2s ease;
	}

	.related-toggle-btn:hover .related-toggle-icon {
		transform: translateX(2px);
	}

	.related-toggle-btn.see-all-btn .related-toggle-icon {
		transform: translateX(-2px);
	}

	.related-toggle-btn.see-all-btn:hover .related-toggle-icon {
		transform: translateX(-4px);
	}

	.related-toggle-text {
		font-weight: 500;
		flex: 1;
	}

	@media screen and (max-width: 768px) {
		.related-view-header {
			padding: 0.75rem 1rem;
			margin-bottom: 1rem;
		}

		.related-view-back-btn {
			font-size: 0.8rem;
			padding: 0.4rem 0.8rem;
		}

		.related-view-info {
			font-size: 0.85rem;
			flex-direction: column;
			align-items: flex-start;
			gap: 0.25rem;
		}

		.related-cards-toggle {
			margin-top: 0.75rem;
			padding-top: 0.75rem;
		}

		.related-toggle-btn {
			font-size: 0.8rem;
			padding: 0.4rem 0.6rem;
		}
	}
</style>

