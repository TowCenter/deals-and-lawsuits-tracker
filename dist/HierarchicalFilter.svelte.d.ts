export default HierarchicalFilter;
type HierarchicalFilter = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<Props>): void;
};
declare const HierarchicalFilter: import("svelte").Component<{
    /**
     * - Dataset to extract interactions and types from
     */
    data?: Object[] | undefined;
    /**
     * - Label for the filter
     */
    label?: string | undefined;
    /**
     * - Selected interactions
     */
    selectedInteraction?: string[] | undefined;
    /**
     * - Selected types
     */
    selectedType?: string[] | undefined;
    /**
     * - Callback when interactions change
     */
    onInteractionChange?: ((values: string[]) => void) | undefined;
    /**
     * - Callback when types change
     */
    onTypeChange?: ((values: string[]) => void) | undefined;
}, {}, "">;
type Props = {
    /**
     * - Dataset to extract interactions and types from
     */
    data?: Object[] | undefined;
    /**
     * - Label for the filter
     */
    label?: string | undefined;
    /**
     * - Selected interactions
     */
    selectedInteraction?: string[] | undefined;
    /**
     * - Selected types
     */
    selectedType?: string[] | undefined;
    /**
     * - Callback when interactions change
     */
    onInteractionChange?: ((values: string[]) => void) | undefined;
    /**
     * - Callback when types change
     */
    onTypeChange?: ((values: string[]) => void) | undefined;
};
