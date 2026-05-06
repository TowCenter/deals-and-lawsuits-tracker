export default MultiSelect;
type MultiSelect = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<Props>): void;
};
declare const MultiSelect: import("svelte").Component<{
    /**
     * - Label for the multi-select
     */
    label?: string | undefined;
    /**
     * - Available options
     */
    options?: string[] | undefined;
    /**
     * - Currently selected values
     */
    selectedValues?: string[] | undefined;
    /**
     * - Callback when selection changes
     */
    onSelectionChange?: ((values: string[]) => void) | undefined;
}, {}, "">;
type Props = {
    /**
     * - Label for the multi-select
     */
    label?: string | undefined;
    /**
     * - Available options
     */
    options?: string[] | undefined;
    /**
     * - Currently selected values
     */
    selectedValues?: string[] | undefined;
    /**
     * - Callback when selection changes
     */
    onSelectionChange?: ((values: string[]) => void) | undefined;
};
