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

/**
 * Returns a plain object field, or {} for anything else (arrays, null, strings)
 * @param {any} value - Value to read
 * @returns {Object<string, any>}
 */
function asPlainObject(value) {
	return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

/**
 * Country name -> flag emoji, as carried by a row. Only real countries appear
 * here, so it doubles as the row's list of recognised country names.
 * @param {Object} row - Data row
 * @returns {Object<string, string>}
 */
export function getCountryFlagMap(row) {
	return asPlainObject(row?.country_flags);
}

/** First regional indicator, the codepoint the letter A maps to in a flag emoji */
const FIRST_INDICATOR = 0x1f1e6;

/**
 * The ISO 3166-1 alpha-2 code a flag emoji is built from: 🇧🇷 -> BR
 * @param {string} flag - Flag emoji
 * @returns {string} Two-letter code, or '' if this is not a flag
 */
function codeFromFlag(flag) {
	const letters = [...String(flag ?? '')]
		.map(character => character.codePointAt(0) - FIRST_INDICATOR)
		.filter(offset => offset >= 0 && offset <= 25)
		.map(offset => String.fromCharCode(65 + offset));

	return letters.length === 2 ? letters.join('') : '';
}

/** @type {Object<string, string>|null} */
let icuCodes = null;

/**
 * Country name -> alpha-2 code for every country the runtime knows, built once.
 * The tracker's own `country_flags` covers only the countries it has
 * publications in, so countries that reach a card any other way (Brazil, Japan,
 * South Korea, Denmark) would otherwise resolve to nothing.
 * @returns {Object<string, string>}
 */
function getIcuCodes() {
	if (icuCodes) return icuCodes;
	icuCodes = {};

	const names = typeof Intl !== 'undefined' && Intl.DisplayNames
		? new Intl.DisplayNames(['en'], { type: 'region' })
		: null;
	if (!names) return icuCodes;

	for (let first = 65; first <= 90; first++) {
		for (let second = 65; second <= 90; second++) {
			const code = String.fromCharCode(first, second);
			let name;
			try {
				name = names.of(code);
			} catch {
				continue;
			}
			// Aliases (UK for GB, FX for France) name a country the canonical code
			// already claimed, and only the canonical code is the country's own
			if (!name || name === code || name in icuCodes) continue;
			icuCodes[name] = code;
		}
	}
	return icuCodes;
}

/** Codes readers know by another name than the ISO one */
const CODE_ALIASES = { GB: 'UK' };

/**
 * The code a country is shown by. Taken from the tracker's own flag where it has
 * one, since a flag emoji is built from the country's code, and from the name
 * otherwise.
 * @param {string} country - Country name
 * @param {Object<string, string>} [flags] - Tracker's country -> flag lookup
 * @returns {string} Two-letter code, or '' when the name is not a known country
 */
export function getCountryCode(country, flags) {
	const code = codeFromFlag(flags?.[country]) || getIcuCodes()[country] || '';
	return CODE_ALIASES[code] || code;
}

/**
 * What a card shows beside a name: the country's code, or a region's name with
 * the tracker's "Region: " prefix dropped, since a region has no code.
 * @param {string} place - Country or region name
 * @param {Object<string, string>} [flags] - Tracker's country -> flag lookup
 * @returns {string}
 */
export function getPlaceLabel(place, flags) {
	return getCountryCode(place, flags) || String(place ?? '').replace(REGION_LABEL, '').trim();
}


/**
 * @typedef {Object} CountryIndex
 * @property {Object<string, string>} flags - Country name -> flag emoji
 * @property {Map<string, string[]>} publications - Publication name -> countries
 */

/**
 * Builds a dataset-wide country lookup, so a name keyed with a country on one
 * entry keeps it on the entries that name it without one. Only the countries
 * the data states are collected; nothing is inherited between a parent org and
 * the publications under it, in either direction.
 * @param {Array<Object>} data - All data rows
 * @returns {CountryIndex}
 */
export function buildCountryIndex(data) {
	const rows = Array.isArray(data) ? data : [];
	const flags = {};
	for (const row of rows) {
		Object.assign(flags, getCountryFlagMap(row));
	}

	const publications = new Map();
	for (const row of rows) {
		for (const [name, countries] of Object.entries(asPlainObject(row?.publication_countries))) {
			addCountries(publications, String(name).trim(), knownCountries(countries, flags));
		}
	}

	return { flags, publications };
}

/**
 * Merges countries into a name's entry, keeping them unique and ordered
 * @param {Map<string, string[]>} target - Name -> countries
 * @param {string} name - Name to merge into
 * @param {string[]} countries - Countries to add
 */
function addCountries(target, name, countries) {
	if (!name || countries.length === 0) return;
	const merged = target.get(name) || [];
	for (const country of countries) {
		if (!merged.includes(country)) merged.push(country);
	}
	target.set(name, merged);
}

/** The tracker's own label for a place that is not one country ("Region: Adria") */
const REGION_LABEL = /^region\s*:/i;

/**
 * A place the tracker names: a country, or one of its "Region: …" labels, which
 * are locations in their own right and simply have no code of their own. The
 * stray publication names that land in the countries field ("Diss Express") are
 * neither, and are what this drops.
 * @param {string} name - Name from a countries field
 * @param {Object<string, string>} [flags] - Country -> flag lookup
 * @returns {boolean}
 */
function isKnownPlace(name, flags) {
	return Boolean(getCountryCode(name, flags)) || REGION_LABEL.test(name);
}

/**
 * Keeps only the names that are places the tracker names
 * @param {any} countries - Country names in any shape
 * @param {Object<string, string>} flags - Country -> flag lookup
 * @returns {string[]}
 */
function knownCountries(countries, flags) {
	return parseArray(countries)
		.map(country => String(country).trim())
		.filter(country => country && isKnownPlace(country, flags));
}

/**
 * Countries the data names for this name: its own on this row, else the ones it
 * carries anywhere in the dataset. A parent org inherits nothing from the
 * publications under it — USA Today Co. has no country of its own in the data,
 * so it shows none, however many countries Newsquest and USA Today are in.
 * @param {CountryIndex} index - Dataset-wide country lookup
 * @param {Object} row - Data row
 * @param {string} name - Name as displayed
 * @returns {string[]}
 */
function lookupCountries(index, row, name) {
	const flags = index?.flags || getCountryFlagMap(row);
	const rowMap = asPlainObject(row?.publication_countries);

	// Display names are trimmed, the keys they came from may not be
	const rowKey = Object.keys(rowMap).find(key => String(key).trim() === name);
	if (rowKey !== undefined) {
		const known = knownCountries(rowMap[rowKey], flags);
		if (known.length > 0) return known;
	}

	return index?.publications?.get(name) || [];
}

/**
 * Places a name shown on a card is tied to — a publication, an intermediate org,
 * or a top-level news org. Names in several countries (PC Gamer, The Week) get
 * one entry per country. A name the data lists no country against has none: the
 * entry's own location is not borrowed for it, and nothing is guessed from the
 * name itself.
 * @param {CountryIndex} index - Dataset-wide country lookup
 * @param {Object} row - Data row the name is shown on
 * @param {string} name - Name as displayed
 * @returns {string[]}
 */
export function getCountriesForName(index, row, name) {
	const trimmed = String(name ?? '').trim();
	if (!trimmed) return [];

	return lookupCountries(index, row, trimmed);
}

/**
 * The places a name is tied to, as the codes a card shows them by
 * @param {CountryIndex} index - Dataset-wide country lookup
 * @param {Object} row - Data row the name is shown on
 * @param {string} name - Name as displayed
 * @returns {Array<{country: string, label: string}>}
 */
export function getPlacesForName(index, row, name) {
	const flags = index?.flags || getCountryFlagMap(row);

	return getCountriesForName(index, row, name)
		.map(country => ({ country, label: getPlaceLabel(country, flags) }))
		.filter(entry => entry.label);
}

/**
 * Every place a row is tied to: the interaction's own location plus the places
 * of every org and publication named on it.
 * @param {Object} row - Data row
 * @param {CountryIndex} [index] - Dataset-wide country lookup
 * @returns {string[]} Unique location names
 */
export function getRowLocations(row, index) {
	const locations = new Set();

	for (const value of parseArray(row?.location)) {
		const trimmed = String(value).trim();
		if (trimmed) locations.add(trimmed);
	}

	const names = [
		...parseArray(row?.organization_publisher_named_in_deal_suit),
		...Object.keys(asPlainObject(row?.publication_countries))
	];
	for (const name of names) {
		for (const country of getCountriesForName(index, row, name)) {
			locations.add(country);
		}
	}

	return Array.from(locations);
}

