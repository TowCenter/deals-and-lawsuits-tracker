export default Table;
type Table = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<Props>): void;
};
declare const Table: import("svelte").Component<{
    /**
     * - Table data rows
     */
    data?: Object[] | undefined;
    /**
     * - Column names to display
     */
    columns?: string[] | undefined;
    /**
     * - Search query string
     */
    searchQuery?: string | undefined;
    /**
     * - Filter by interactions
     */
    filterInteraction?: string[] | undefined;
    /**
     * - Filter by types
     */
    filterType?: string[] | undefined;
    /**
     * - Filter by platforms
     */
    filterPlatform?: string[] | undefined;
    /**
     * - Filter by publishers
     */
    filterPublishers?: string[] | undefined;
    /**
     * - Callback when filtered data changes
     */
    onFilteredDataChange?: ((data: Array<Object>) => void) | undefined;
}, {}, "">;
type Props = {
    /**
     * - Table data rows
     */
    data?: Object[] | undefined;
    /**
     * - Column names to display
     */
    columns?: string[] | undefined;
    /**
     * - Search query string
     */
    searchQuery?: string | undefined;
    /**
     * - Filter by interactions
     */
    filterInteraction?: string[] | undefined;
    /**
     * - Filter by types
     */
    filterType?: string[] | undefined;
    /**
     * - Filter by platforms
     */
    filterPlatform?: string[] | undefined;
    /**
     * - Filter by publishers
     */
    filterPublishers?: string[] | undefined;
    /**
     * - Callback when filtered data changes
     */
    onFilteredDataChange?: ((data: Array<Object>) => void) | undefined;
};
