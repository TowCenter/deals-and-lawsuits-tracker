export default SearchBar;
type SearchBar = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<Props>): void;
};
declare const SearchBar: import("svelte").Component<{
    /**
     * - Current search query
     */
    searchQuery?: string | undefined;
    /**
     * - Callback when search changes
     */
    onSearchChange?: ((query: string) => void) | undefined;
}, {}, "">;
type Props = {
    /**
     * - Current search query
     */
    searchQuery?: string | undefined;
    /**
     * - Callback when search changes
     */
    onSearchChange?: ((query: string) => void) | undefined;
};
