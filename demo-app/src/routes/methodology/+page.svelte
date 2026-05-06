<script>
    import { base } from '$app/paths';
    import Head from "../../../../src/lib/Head.svelte";
    import Article from "../../../../src/lib/Article.svelte";
    import Header from "../../../../src/lib/Header.svelte";
    import Headline from "../../../../src/lib/Headline.svelte";
    import Footer from "../../../../src/lib/Footer.svelte";
    import BodyText from "../../../../src/lib/BodyText.svelte";
    import Body from "../../../../src/lib/Body.svelte";
    
    // Navigation items for the left sidebar
    const navItems = [
        { href: 'https://towcenter.columbia.edu/news/platforms-and-publishers', label: 'Platforms and Publishers Project' },
        { href: 'https://tow.cjr.org/platform-timeline/', label: 'P&P Timeline' },
        { href: `${base}/`, label: 'AI Deals and Disputes Tracker' },
        { href: 'https://www.cjr.org/tow-center', label: 'Other Tow Center Reports' }
    ];
</script>

<Head />
<Header />
<Article>
    <Headline
        brand="Platforms and Publishers"
        hed="AI Deals and Disputes Tracker"
    />

    <Body {navItems}>
        <BodyText
            text="<strong>Methodology & Disclaimer</strong><br><br>
            The purpose of this tracker is to centralize information about deals, grantmaking and lawsuits between AI companies and news publishers by standardizing unstructured, publicly available data. Sources include primary materials such as press releases and company announcements, as well as secondary news coverage. This tracker focuses exclusively on the journalism industry and does not collect information about related entities outside this sector, such as authors or other creative industries. It also excludes commercial agreements or enterprise deals in which publishers purchase or license products from AI companies for newsroom use.<br><br>
            While every effort is made to populate the tracker using publicly available information, the dataset is not exhaustive, as not all relationships between AI companies and news publishers are publicly disclosed. Any publisher or outlet listed as being involved in a deal, grant or lawsuit has either been explicitly named in public documentation or confirmed directly by the company. However, this does not constitute a complete accounting of all entities participating in or affected by these interactions.<br><br>
            As a result, definitive conclusions about the total number, full scope, or financial value of interactions between AI companies and news publishers cannot be drawn from this tracker alone. Instead, this tool is intended to provide insights into broad patterns, emerging trends, and the pace at which these interactions are occuring."
        />
        
        <BodyText
            text="If you have any additional questions about the data or how we collected it, please contact <a href='mailto:kj2664@columbia.edu'>Klaudia Jaźwińska</a>."
        />
        <div class="back-link">
            <a href="/deals-and-lawsuits-tracker/">← Back to Tracker</a>
        </div>
    </Body>
</Article>
<Footer />

<style>
    .back-link {
        margin-bottom: 1rem;
    }
    
    .back-link a {
        color: #254c6f;
        text-decoration: none;
        font-size: 0.9rem;
        font-weight: 500;
        transition: color 0.2s ease;
    }
    
    .back-link a:hover {
        color: #1a3a52;
        text-decoration: underline;
    }

    @media screen and (max-width: 768px) {
        .back-link {
            margin-top: 2rem;
            padding-top: 2rem;
        }

        .back-link a {
            display: inline-block;
            padding: 0.75rem 1.5rem;
            background-color: #254c6f;
            color: #fff;
            border-radius: 4px;
            font-size: 0.95rem;
            font-weight: 600;
            text-decoration: none;
            transition: background-color 0.2s ease;
        }

        .back-link a:hover {
            background-color: #1a3a52;
            color: #fff;
            text-decoration: none;
        }
    }
</style>
