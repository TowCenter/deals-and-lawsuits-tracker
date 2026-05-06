/**
 * Utility functions for data processing and formatting
 */
/**
 * Maps display column names to actual data keys
 * @param {string} column - Display column name
 * @returns {string} Data key
 */
export function getColumnKey(column: string): string;
/**
 * Parses a value that could be an array, string, or comma-separated string
 * @param {any} value - Value to parse
 * @returns {string[]} Array of strings
 */
export function parseArray(value: any): string[];
/**
 * Formats date string from YYYY-MM-DD to MM/DD/YYYY
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {string} Formatted date string
 */
export function formatDate(dateStr: string): string;
/**
 * Parses URLs from various formats (array, JSON string, comma-separated)
 * @param {any} readMoreUrls - URLs in various formats
 * @returns {string[]} Array of valid URLs
 */
export function parseUrls(readMoreUrls: any): string[];
/**
 * Formats citation links for reported details
 * @param {string[]} urls - Array of URLs
 * @returns {string} HTML string with citation links
 */
export function formatCitations(urls: string[]): string;
/**
 * Gets unique values from a dataset for a given column
 * @param {Array<Object>} data - Dataset
 * @param {string} column - Column name (display name)
 * @param {Object} options - Options for special handling
 * @returns {string[]} Sorted array of unique values
 */
export function getUniqueValues(data: Array<Object>, column: string, options?: Object): string[];
/**
 * Checks if text matches search query (case-insensitive)
 * @param {string} text - Text to search
 * @param {string} query - Search query
 * @returns {boolean}
 */
export function matchesSearch(text: string, query: string): boolean;
