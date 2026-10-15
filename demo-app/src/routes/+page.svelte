<script>
 import {downloadJsonExport} from '../../../src/lib/csvExport.js';
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

        <!-- Card View -->
        <CardView
            showNetworks={false}
            showEntityNetworks={true}
            data={partnerships}
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
