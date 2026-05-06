export default Credits;
type Credits = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<Record<string, never>>): void;
};
declare const Credits: import("svelte").Component<Record<string, never>, {}, "">;
