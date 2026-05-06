export default BodyText;
type BodyText = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<$$ComponentProps>): void;
};
declare const BodyText: import("svelte").Component<{
    text: any;
}, {}, "">;
type $$ComponentProps = {
    text: any;
};
