export default Filters;
type Filters = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<$$ComponentProps>): void;
};
declare const Filters: import("svelte").Component<{
    data?: any[];
    columns?: any[];
    searchQuery?: string;
    filterInteraction?: any[];
    filterType?: any[];
    filterPlatform?: any[];
    filterPublishers?: any[];
    filteredRowCount?: number;
    onDownloadCSV?: Function;
}, {}, "searchQuery" | "filterInteraction" | "filterType" | "filterPlatform" | "filterPublishers">;
type $$ComponentProps = {
    data?: any[];
    columns?: any[];
    searchQuery?: string;
    filterInteraction?: any[];
    filterType?: any[];
    filterPlatform?: any[];
    filterPublishers?: any[];
    filteredRowCount?: number;
    onDownloadCSV?: Function;
};
