export default CardView;
type CardView = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<Props>): void;
};
declare const CardView: import("svelte").Component<{
    /**
     * - Card data rows
     */
    data?: Object[] | undefined;
    /**
     * - Column names (for filtering/search compatibility)
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
     * - Card data rows
     */
    data?: Object[] | undefined;
    /**
     * - Column names (for filtering/search compatibility)
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
