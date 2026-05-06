export default FilterBar;
type FilterBar = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<$$ComponentProps>): void;
};
declare const FilterBar: import("svelte").Component<{
    data?: any[];
    filterType?: any[];
    filterInteraction?: any[];
    filterPlatform?: any[];
    filterPublishers?: any[];
    searchQuery?: string;
    filteredRowCount?: number;
    onDownloadCSV?: Function;
    onFilterChange?: Function;
}, {}, "">;
type $$ComponentProps = {
    data?: any[];
    filterType?: any[];
    filterInteraction?: any[];
    filterPlatform?: any[];
    filterPublishers?: any[];
    searchQuery?: string;
    filteredRowCount?: number;
    onDownloadCSV?: Function;
    onFilterChange?: Function;
};
