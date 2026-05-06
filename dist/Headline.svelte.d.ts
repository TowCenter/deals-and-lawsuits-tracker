export default Headline;
type Headline = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<$$ComponentProps>): void;
};
declare const Headline: import("svelte").Component<{
    children: any;
    hed: any;
    subhed: any;
    date: any;
    byline1: any;
    byline1_url: any;
    byline2: any;
    byline2_url: any;
    brand: any;
    latestDate: any;
}, {}, "">;
type $$ComponentProps = {
    children: any;
    hed: any;
    subhed: any;
    date: any;
    byline1: any;
    byline1_url: any;
    byline2: any;
    byline2_url: any;
    brand: any;
    latestDate: any;
};
