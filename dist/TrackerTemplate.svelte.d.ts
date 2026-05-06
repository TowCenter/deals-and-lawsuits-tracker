export default TrackerTemplate;
type TrackerTemplate = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<TrackerConfig>): void;
};
declare const TrackerTemplate: import("svelte").Component<{
    /**
     * - Brand name (e.g., "Platforms and Publishers")
     */
    brand: string;
    /**
     * - Main page title
     */
    title: string;
    /**
     * - HTML body text content
     */
    bodyText: string;
    /**
     * - Normalized data array
     */
    data: Array<Object>;
    /**
     * - Column names for filtering
     */
    columns: string[];
    /**
     * - Latest update date (optional)
     */
    latestDate?: string | undefined;
    /**
     * - Function to get latest date from data (optional)
     */
    getLatestDate?: Function | undefined;
    /**
     * - Left navigation items (optional)
     */
    navItems?: {
        /**
         * - Link URL
         */
        href: string;
        /**
         * - Link text
         */
        label: string;
    }[] | undefined;
}, {}, "">;
type TrackerConfig = {
    /**
     * - Brand name (e.g., "Platforms and Publishers")
     */
    brand: string;
    /**
     * - Main page title
     */
    title: string;
    /**
     * - HTML body text content
     */
    bodyText: string;
    /**
     * - Normalized data array
     */
    data: Array<Object>;
    /**
     * - Column names for filtering
     */
    columns: string[];
    /**
     * - Latest update date (optional)
     */
    latestDate?: string | undefined;
    /**
     * - Function to get latest date from data (optional)
     */
    getLatestDate?: Function | undefined;
    /**
     * - Left navigation items (optional)
     */
    navItems?: {
        /**
         * - Link URL
         */
        href: string;
        /**
         * - Link text
         */
        label: string;
    }[] | undefined;
};
