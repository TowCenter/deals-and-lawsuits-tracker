/**
 * Utility functions for data processing and formatting
 */

/**
 * Maps display column names to actual data keys
 * @param {string} column - Display column name
 * @returns {string} Data key
 */
export function getColumnKey(column) {
	const columnMap = {
		'News Org': 'organization_publisher_named_in_deal_suit',
		'AI Company': 'platform'
	};
	
	return columnMap[column] || column.toLowerCase().replace(/\s+/g, '_');
}

/**
 * Parses a value that could be an array, string, or comma-separated string
 * @param {any} value - Value to parse
 * @returns {string[]} Array of strings
 */
export function parseArray(value) {
	if (Array.isArray(value)) {
		return value.filter(v => v != null && String(v).trim());
	}
	if (typeof value === 'string') {
		return value.split(',').map(v => v.trim()).filter(v => v);
	}
	return value != null ? [String(value)] : [];
}

/**
 * Formats date string from YYYY-MM-DD to MM/DD/YYYY
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {string} Formatted date string
 */
export function formatDate(dateStr) {
	if (!dateStr) return '—';
	const trimmed = String(dateStr).trim();
	const [year, month, day] = trimmed.split('-');
	if (year && month && day) {
		return `${month}/${day}/${year}`;
	}
	return trimmed;
}

/**
 * Parses URLs from various formats (array, JSON string, comma-separated)
 * @param {any} readMoreUrls - URLs in various formats
 * @returns {string[]} Array of valid URLs
 */
export function parseUrls(readMoreUrls) {
	if (!readMoreUrls) return [];
	
	if (Array.isArray(readMoreUrls)) {
		return readMoreUrls
			.filter(v => v && String(v).trim().startsWith('http'))
			.map(v => String(v).trim());
	}
	
	if (typeof readMoreUrls === 'string') {
		const trimmed = readMoreUrls.trim();
		// Try parsing as JSON array
		if (trimmed.startsWith('[')) {
			try {
				const parsed = JSON.parse(trimmed.replace(/'/g, '"'));
				if (Array.isArray(parsed)) {
					return parsed
						.filter(v => v && String(v).trim().startsWith('http'))
						.map(v => String(v).trim());
				}
			} catch (e) {
				// Fall through to comma-separated parsing
			}
		}
		// Parse as comma-separated
		return trimmed
			.split(',')
			.map(v => v.trim())
			.filter(v => v && v.startsWith('http'));
	}
	
	return [];
}

/**
 * Formats citation links for reported details
 * @param {string[]} urls - Array of URLs
 * @returns {string} HTML string with citation links
 */
export function formatCitations(urls) {
	if (urls.length === 0) return '';
	
	const citationLinks = urls.map((url, index) => {
		const num = index + 1;
		try {
			const hostname = new URL(url).hostname;
			return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="citation-link" title="${hostname}">${num}</a>`;
		} catch (e) {
			return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="citation-link" title="${url}">${num}</a>`;
		}
	}).join(',');
	
	return ` <span class="citations">[${citationLinks}]</span>`;
}

/**
 * Gets unique values from a dataset for a given column
 * @param {Array<Object>} data - Dataset
 * @param {string} column - Column name (display name)
 * @param {Object} options - Options for special handling
 * @returns {string[]} Sorted array of unique values
 */
export function getUniqueValues(data, column, options = {}) {
	const key = getColumnKey(column);
	const unique = new Set();
	
	data.forEach(row => {
		if (!row) return;
		
		// Special handling for News Org - combine multiple fields
		if (column === 'News Org') {
			const orgKey = 'organization_publisher_named_in_deal_suit';
			const orgVal = row[orgKey];
			if (orgVal) {
				parseArray(orgVal).forEach(item => unique.add(item));
			}
			
			const titlesKey = 'known_titles_involved';
			const titlesVal = row[titlesKey];
			if (titlesVal) {
				parseArray(titlesVal).forEach(item => unique.add(item));
			}
			return;
		}
		
		const val = row[key];
		if (val == null) return;
		
		// Handle arrays and comma-separated strings
		const parsed = parseArray(val);
		parsed.forEach(item => unique.add(item));
	});
	
	return Array.from(unique).sort();
}

/**
 * Checks if text matches search query (case-insensitive)
 * @param {string} text - Text to search
 * @param {string} query - Search query
 * @returns {boolean}
 */
export function matchesSearch(text, query) {
	if (!query) return true;
	return String(text).toLowerCase().includes(query.toLowerCase());
}

