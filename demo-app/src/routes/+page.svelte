<script>
 import {downloadJsonExport} from '../../../src/lib/csvExport.js';
    import LocationMatrix from '../../../src/lib/LocationMatrix.svelte';
    let activityView = $state('charts');
    import NetworkTimeline from '../../../src/lib/NetworkTimeline.svelte';
    import { buildOwnershipGraph } from '../../../src/lib/publisherNetwork.js';
    import { isMdlConsolidation } from '../../../src/lib/mdl.js';
    let homeCutoff = $state(null);
    let chartMetric = $state('cards');
    let chartSmooth = $state(false);
    let chartRecords = $state.raw([]);
    const homeRecords = $derived(chartRecords.filter(record => !isMdlConsolidation(record) && (record.interaction || []).some(kind => /^(deal|grant|lawsuit)$/i.test(kind))));
    const homeOwnership = $derived(buildOwnershipGraph(partnerships));
    import { onMount } from 'svelte';
    import { normalizeData } from '../../../src/lib/trackerData.js';
    import Head from "../../../src/lib/Head.svelte";
    import Article from "../../../src/lib/Article.svelte";
    import Header from "../../../src/lib/Header.svelte";
    import Headline from "../../../src/lib/Headline.svelte";
    import Credits from "../../../src/lib/Credits.svelte";
    import Footer from "../../../src/lib/Footer.svelte";
    import BodyText from "../../../src/lib/BodyText.svelte";
    import Body from "../../../src/lib/Body.svelte";
    import Filters from "../../../src/lib/Filters.svelte";
    import CardView from "../../../src/lib/CardView.svelte";
    
    // Client-side data fetching
    let rawData = $state.raw([]);
    let dataError = $state(null);
    let isLoading = $state(true);

    // S3 configuration
    const S3_BUCKET_NAME = 'ai-deals-lawsuit';
    const S3_FILE_KEY = 'deals_lawsuits_data.json';
    const AWS_REGION = 'us-east-2';
    
    // Construct S3 public URL
    const S3_URL = `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${S3_FILE_KEY}`;
    
    // Fetch data directly from S3 on mount
    onMount(async () => {
        try {
            isLoading = true;
            // Revalidate through normal HTTP caching instead of downloading a unique URL every visit.
            const response = await fetch(S3_URL, { cache:'no-cache' });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                // Check if we got HTML (likely a permissions error)
                const text = await response.text();
                if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
                    throw new Error('S3 bucket is not public or CORS is not configured. Please make the bucket public and enable CORS.');
                }
                throw new Error('Response is not JSON');
            }
            
            const data = await response.json();
            rawData = Array.isArray(data) ? data : [];
            dataError = null;
            console.log(`✓ Loaded ${rawData.length} records from S3 at ${new Date().toLocaleTimeString()}`);
        } catch (error) {
            console.error('Error fetching data from S3:', error);
            dataError = error.message || 'Failed to load data from S3';
            rawData = [];
        } finally {
            isLoading = false;
        }
    });

    // Reactive partnerships - updates when rawData changes
    const partnerships = $derived(normalizeData(rawData));

    // Filter state
    let searchQuery = $state('');
    let filterInteraction = $state([]);
    let filterType = $state([]);
    let filterPlatform = $state([]);
    let filterPublishers = $state([]);
    let filterLocation = $state([]);
    let showCountries = $state(false);
    let availableValues = $state(null);
    let filteredData = $state([]);

    // Sync filter state with URL query params so views are shareable.
    let urlSyncReady = $state(false);

    onMount(() => {
        const params = new URLSearchParams(window.location.search);
        searchQuery = params.get('q') || '';
        filterInteraction = params.getAll('interaction');
        filterType = params.getAll('type');
        filterPlatform = params.getAll('platform');
        filterPublishers = params.getAll('publishers');
        filterLocation = params.getAll('location');
        urlSyncReady = true;
    });

    $effect(() => {
        if (!urlSyncReady) return;
        const params = new URLSearchParams();
        if (searchQuery) params.set('q', searchQuery);
        for (const v of filterInteraction) params.append('interaction', v);
        for (const v of filterType) params.append('type', v);
        for (const v of filterPlatform) params.append('platform', v);
        for (const v of filterPublishers) params.append('publishers', v);
        for (const v of filterLocation) params.append('location', v);
        const qs = params.toString();
        const newUrl = `${window.location.pathname}${qs ? '?' + qs : ''}${window.location.hash}`;
        window.history.replaceState(null, '', newUrl);
    });

    function downloadToCSV() {
        downloadJsonExport(filteredData, partnerships);
    }

    // import content from '$locales/en/content.json';

    // Function to get the latest "Last Modified" date and format it
    function getLatestDate(data) {
        if (!Array.isArray(data) || data.length === 0) {
            return 'Date unavailable'; // fallback
        }
        
        const dates = data
            .map(row => row['Last Modified'])
            .filter(Boolean)
            .sort()
            .reverse();
        
        if (dates.length === 0) {
            return 'Date unavailable'; // fallback
        }
        
        const latestDate = new Date(dates[0]);
        
        // Check if date is valid
        if (isNaN(latestDate.getTime())) {
            return 'Date unavailable'; // fallback
        }
        
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
        
        const month = months[latestDate.getMonth()];
        const day = String(latestDate.getDate()).padStart(2, '0');
        const year = latestDate.getFullYear();
        
        return `${month} ${day}, ${year}`;
    }

    const latestDate = $derived(getLatestDate(rawData));
    
    // Show loading state
    const showLoading = $derived(isLoading);
    
    import { base } from '$app/paths';

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
        {latestDate}
    />

    <Body {navItems}>
        {#if showLoading}
            <div style="padding: 2rem; text-align: center;">
                <p>Loading data...</p>
            </div>
        {:else if dataError}
            <div style="padding: 1rem; background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; margin-bottom: 1rem;">
                <strong>Warning:</strong> Could not load data from S3: {dataError}. Please check your S3 configuration.
            </div>
        {/if}
        <!-- 
        {#each content.blocks as block}
        {#if block.type === 'text'}
            <BodyText text={block.text} />
        {/if}
        {/each} -->
        <BodyText
            text={`This tracker monitors developments between news publishers and AI companies—including <span class='interaction-tag-inline lawsuit'>Lawsuits</span>, <span class='interaction-tag-inline deal'>Deals</span>, and <span class='interaction-tag-inline grant'>Grants</span>—based on publicly available information.

<br><br>It is compiled by Tow Center as part of the <a href='https://towcenter.columbia.edu/news/platforms-and-publishers'>Platforms and Publishers project</a>.
Please contact <a href='mailto:kj2664@columbia.edu'>Klaudia Jaźwińska </a> with any feedback or suggestions about developments we may have missed.
<br><br>Read our <a href='${base}/methodology/'>methodology</a> to learn more about how we collect and categorize this data.`}
        />
        <div class="update-date-divider">
            <div class="divider-line"></div>
            <Credits />
        </div>
    </Body>


    
    {#if !showLoading}
        <Filters 
            data={partnerships}
            bind:searchQuery
            bind:filterInteraction
            bind:filterType
            bind:filterPlatform
            bind:filterPublishers
            bind:filterLocation
            bind:showCountries
            {availableValues}
            filteredRowCount={filteredData.length}
            onDownloadCSV={downloadToCSV}
        />

        <div class="home-activity charts-container">
        <div class="view-tabs" role="group" aria-label="Activity view">
            <button type="button" aria-pressed={activityView === 'charts'} onclick={() => activityView='charts'}>Time charts</button>
            <button type="button" aria-pressed={activityView === 'locations'} onclick={() => activityView='locations'}>Location matrix</button>
        </div>
        {#if activityView === 'charts'}
        <div class="chart-controls" role="group" aria-label="Shared chart controls">
            <select aria-label="Chart counts" bind:value={chartMetric}>
                <option value="cards">Cards</option>
                <option value="direct">Publishers — direct</option>
                <option value="descendants">Publishers + children</option>
                <option value="reported">Reported publisher counts</option>
            </select>
            <label><input type="checkbox" bind:checked={chartSmooth} />3-mo avg (monthly chart)</label>
            <button type="button" onclick={() => homeCutoff = null} disabled={homeCutoff == null}>All dates</button>
        </div>
        <section class="chart-panel" aria-label="Activity matching filters">
            <NetworkTimeline records={homeRecords} ownership={homeOwnership} bind:metric={chartMetric} bind:smooth={chartSmooth} showControls={false} bind:cutoff={homeCutoff} />
        </section>
        <section class="chart-panel cumulative-activity" aria-label="Cumulative lawsuits and deals">
            <h2>Cumulative <strong>lawsuits</strong> and <strong>deals</strong> between AI and media companies</h2>
            <NetworkTimeline records={homeRecords.filter(record => record.interaction.some(kind => /^(deal|lawsuit)$/i.test(kind)))} ownership={homeOwnership} cumulative bind:metric={chartMetric} showControls={false} bind:cutoff={homeCutoff} />
        </section>
        {:else}
            <LocationMatrix records={homeRecords} data={partnerships} bind:metric={chartMetric} bind:cutoff={homeCutoff} />
        {/if}
        </div>
        <!-- Card View -->
        <CardView
            {latestDate}
            showNetworks={false}
            showEntityNetworks={true}
            data={partnerships}
            dateCutoff={homeCutoff}
            onTimelineDataChange={(records) => { chartRecords = records; }}
            {searchQuery}
            {filterInteraction}
            {filterType}
            {filterPlatform}
            {filterPublishers}
            {filterLocation}
            {showCountries}
            onFilteredDataChange={(data) => { filteredData = data; }}
            onAvailableValuesChange={(values) => { availableValues = values; }}
        />
    {/if}
</Article>
<Footer />

<style>
 .home-activity { margin:1rem auto 2rem; max-width:900px; }

 .view-tabs { display:flex; gap:1rem; padding:.7rem 1rem; border-bottom:1px solid #e0e0e0; }
 .view-tabs button { border:0; border-bottom:2px solid transparent; padding:.2rem 0; background:transparent; font:inherit; font-size:.75rem; color:#666; cursor:pointer; }
 .view-tabs button[aria-pressed="true"] { color:#254c6f; border-color:#DE5A35; }
 .charts-container { border:1px solid #e0e0e0; background:#fafafa; }
 .chart-panel + .chart-panel { border-top:1px solid #e0e0e0; }
 .chart-panel :global(.timeline) { border:0; }
 .chart-controls { display:flex; align-items:center; flex-wrap:wrap; gap:.5rem; padding:.6rem 1rem; box-sizing:border-box; border-bottom:1px solid #e0e0e0; background:#fafafa; font-size:.75rem; }
 .chart-controls select,.chart-controls button { font:inherit; padding:.35rem .55rem; border:1px solid #ccc; border-radius:0; background:#fff; color:#333; cursor:pointer; }
 .chart-controls button { color:#254c6f; } .chart-controls button:disabled { opacity:.5; cursor:default; }
 .chart-controls label { display:flex; align-items:center; gap:.4rem; } .chart-controls input { accent-color:#DE5A35; }
 .chart-controls :focus-visible { outline:2px solid #DE5A35; outline-offset:2px; }
 .cumulative-activity h2 { font-family:inherit; font-size:1rem; font-weight:400; line-height:1.4; color:#333; margin:0; padding:.75rem 1rem .25rem; }
 @media (max-width:932px) { .home-activity { margin:1rem 1rem 2rem; } }
</style>
