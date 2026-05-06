export default Header;
type Header = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<$$ComponentProps>): void;
};
declare const Header: import("svelte").Component<{
    navItems?: {
        /**
         * - Link anchor
         */
        href: string;
        /**
         * - Link text
         */
        label: string;
    }[];
}, {}, "">;
type $$ComponentProps = {
    navItems?: {
        /**
         * - Link anchor
         */
        href: string;
        /**
         * - Link text
         */
        label: string;
    }[];
};
