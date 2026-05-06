export default Article;
type Article = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<$$ComponentProps>): void;
};
declare const Article: import("svelte").Component<{
    children: any;
}, {}, "">;
type $$ComponentProps = {
    children: any;
};
