# Migration Guide: Integrating an Existing Website into Tow Design System

This guide will help you integrate your existing website to use the Tow Design System components, styles, and structure.

## Quick Start

The easiest approach is to wrap your existing content with the Design System's layout components.

### 1. Install the Design System

If your existing site is a Svelte project:

```bash
npm install github:TowCenter/tow-design-system
```

If your site is not a Svelte project, you'll need to refactor it to use Svelte first.

### 2. Basic Structure

Wrap your existing content with these core components:

```svelte
<script>
  import {
    Head,
    Header,
    Headline,
    Article,
    Body,
    Footer,
    TowPartnerLogo
  } from '@tow/design-system';
  import '@tow/design-system/tow.css';
  import '@tow/design-system/cjr.css';
  
  // Your existing imports and data
  // ...
</script>

<!-- Required: Add all external CSS and scripts -->
<Head />

<!-- Required: Add CJR header with logo -->
<Header />

<!-- Wrap your entire page in Article -->
<Article>
  
  <!-- Optional: Add headline with Tow logo -->
  <Headline
    hed="Your Page Title"
    subhed="Your subtitle or description"
    date="Current Date"
    byline_url="https://example.com/author"
    byline="Author Name"
  >
    <TowPartnerLogo />
  </Headline>

  <!-- Put ALL your existing content here -->
  <Body>
    <!-- Your existing content goes here -->
    <div class="your-existing-content">
      <!-- All your HTML/markup -->
    </div>
    
    <!-- Or if you have custom components -->
    <YourExistingComponent />
    
  </Body>

  <!-- Optional: Add filters and tables if you have data -->
  {#if showFilters}
    <FilterBar 
      {data}
      {columns}
      bind:searchQuery
      bind:filterInteraction
      bind:filterType
      bind:filterPlatform
      bind:filterPublishers
      {filteredRowCount}
      {onDownloadCSV}
    />

    <Table 
      {data}
      {columns}
      {searchQuery}
      {filterInteraction}
      {filterType}
      {filterPlatform}
      {filterPublishers}
      onFilteredDataChange={(data) => { filteredData = data; }}
    />
  {/if}

</Article>

<!-- Required: Add CJR footer -->
<Footer />
```

## 3. Available Components

### Layout Components

| Component | Purpose | Props |
|-----------|---------|-------|
| `<Head />` | Adds all required CSS/JS (Bootstrap, fonts, etc.) | None |
| `<Header />` | CJR header with logo | None |
| `<Footer />` | CJR footer | None |
| `<Article>` | Main page container | `children` (slot) |
| `<Body>` | Content wrapper with layout grid | `children`, `navItems[]` |
| `<Headline>` | Page title/header section | `hed`, `subhed`, `date`, `byline_url`, `byline` |

### Data Components

| Component | Purpose |
|-----------|---------|
| `<FilterBar>` | Filter controls (search, multi-select, hierarchical) |
| `<Table>` | Sortable, filterable data table with mobile cards |
| `<MultiSelect>` | Multi-select dropdown |
| `<HierarchicalFilter>` | Two-level hierarchical filter (e.g., Interaction/Type) |
| `<SearchBar>` | Text search input |

### Utility Components

| Component | Purpose |
|-----------|---------|
| `<BodyText>` | Formatted text content |
| `<TowPartnerLogo>` | Tow Center logo badge |

## 4. Common Migration Patterns

### Pattern 1: Existing Svelte Page

**Before:**
```svelte
<script>
  // Your existing code
</script>

<div class="container">
  <h1>My Page</h1>
  <p>Content</p>
</div>
```

**After:**
```svelte
<script>
  import { Head, Header, Article, Body, Footer } from '@tow/design-system';
  import '@tow/design-system/tow.css';
  import '@tow/design-system/cjr.css';
  
  // Your existing code
</script>

<Head />
<Header />
<Article>
  <Body>
    <h1>My Page</h1>
    <p>Content</p>
  </Body>
</Article>
<Footer />
```

### Pattern 2: Adding Filters to Existing Data

**Before:**
```svelte
<script>
  let data = [...];
  let searchQuery = '';
  let filteredData = data;
  
  $effect(() => {
    filteredData = data.filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });
</script>

<div>
  <input bind:value={searchQuery} placeholder="Search..." />
  {#each filteredData as item}
    <div>{item.name}</div>
  {/each}
</div>
```

**After:**
```svelte
<script>
  import { FilterBar, Table } from '@tow/design-system';
  
  let data = [...];
  let searchQuery = '';
  let filterPlatform = [];
  let filterPublishers = [];
  let filterType = [];
  let filterInteraction = [];
  let filteredData = [];
  let columns = ['Name', 'Platform', 'Date'];
</script>

<FilterBar
  {data}
  {columns}
  bind:searchQuery
  bind:filterPlatform
  bind:filterPublishers
  bind:filterType
  bind:filterInteraction
  filteredRowCount={filteredData.length}
  onFilterChange={(filter, value) => {
    if (filter === 'searchQuery') searchQuery = value;
    if (filter === 'filterPlatform') filterPlatform = value;
    // ... handle other filters
  }}
/>

<Table
  {data}
  {columns}
  {searchQuery}
  {filterPlatform}
  {filterPublishers}
  {filterType}
  {filterInteraction}
  onFilteredDataChange={(data) => { filteredData = data; }}
/>
```

### Pattern 3: Custom Navigation Sidebar

```svelte
<Body navItems={[
  { href: '#section-1', label: 'Section 1' },
  { href: '#section-2', label: 'Section 2' },
  { href: '#section-3', label: 'Section 3' }
]}>
  <div id="section-1">
    <h2>Section 1</h2>
    <!-- content -->
  </div>
  
  <div id="section-2">
    <h2>Section 2</h2>
    <!-- content -->
  </div>
  
  <div id="section-3">
    <h2>Section 3</h2>
    <!-- content -->
  </div>
</Body>
```

### Pattern 4: Without Nav Sidebar

```svelte
<Body navItems={[]}>
  <!-- Your full-width content -->
  <div class="your-content">
    <!-- Everything here takes full width -->
  </div>
</Body>
```

## 5. Styling Considerations

### CSS Imports

The design system automatically provides:
- Bootstrap 5.2.2 grid system
- CJR styling (`cjr.css`)
- Tow styling (`tow.css`)
- Google Fonts (loaded via external CSS)

**Important:** Always import both CSS files:
```javascript
import '@tow/design-system/tow.css';
import '@tow/design-system/cjr.css';
```

### Custom Styling

You can still add your own styles:

```svelte
<style>
  /* Your custom styles */
  .my-custom-class {
    /* styles */
  }
</style>
```

### Grid System

The Body component uses Bootstrap's grid system:
- `.container-lg`: Max width 1140px
- `.row`: Flex container for columns
- `.col-sm-2`: 16.67% width (used for nav sidebar)
- `.col-sm-10`: 83.33% width (used for main content)

Your existing Bootstrap grid classes will work automatically.

### Responsive Behavior

The design system is fully responsive:
- Mobile (< 768px): Nav sidebar hidden, full-width content
- Tablet/Desktop: Shows nav sidebar and 2-column layout

## 6. Data Structure

If using the FilterBar and Table components, ensure your data matches these expected fields:

```javascript
{
  date: "YYYY-MM-DD",
  interaction: "Deal" | "Lawsuit" | Array of these,
  platform: "AI Company Name" | Array of these,
  organization_publisher_named_in_deal_suit: "Publisher Name" | Array of these,
  type: "Type Name" | Array of these,
  reported_details: "Text description",
  read_more: "URL" | ["URL1", "URL2"], // Parsed automatically
  known_titles_involved: "Title" | ["Title1", "Title2"] // Optional
}
```

## 7. Troubleshooting

### "Layout shifts on page load"
✅ **Fixed!** The Body component now includes Bootstrap grid fallback styles to prevent FOUC.

### "Styles not applying"
- Make sure you've imported both CSS files
- Check that `<Head />` is included (loads external CSS)
- Clear browser cache

### "Filters not working"
- Check that your data structure matches expected format
- Ensure all filter props are initialized as arrays: `[]`
- Use `bind:` syntax for two-way binding

### "Mobile layout issues"
- All components are responsive by default
- Check your own CSS for conflicting media queries
- Test in browser dev tools responsive mode

## 8. Best Practices

1. **Always wrap in Article**: All page content should be inside `<Article>` for proper styling
2. **Include required components**: `Head`, `Header`, `Footer` should be on every page
3. **Use slots**: The design system uses Svelte 5 snippets (slots) for flexibility
4. **Follow data structure**: If using filters/tables, use the standardized data format
5. **Test responsive**: Always test mobile/tablet/desktop views
6. **Keep custom CSS minimal**: Let the design system handle layout and typography

## 9. Example: Complete Migration

Here's a full example of migrating a typical page:

```svelte
<script>
  import {
    Head,
    Header,
    Headline,
    Article,
    Body,
    Footer,
    TowPartnerLogo
  } from '@tow/design-system';
  import '@tow/design-system/tow.css';
  import '@tow/design-system/cjr.css';
  
  // Your existing logic here
  let pageData = { /* ... */ };
</script>

<Head />
<Header />

<Article>
  <Headline
    hed={pageData.title}
    subhed={pageData.subtitle}
    date={pageData.date}
    byline_url={pageData.author.url}
    byline={pageData.author.name}
  >
    <TowPartnerLogo />
  </Headline>

  <Body navItems={[
    { href: '#overview', label: 'Overview' },
    { href: '#details', label: 'Details' },
    { href: '#contact', label: 'Contact' }
  ]}>
    
    <!-- Your existing content -->
    <section id="overview">
      <h2>Overview</h2>
      <p>Your content here...</p>
    </section>

    <section id="details">
      <h2>Details</h2>
      <p>Your content here...</p>
    </section>

    <section id="contact">
      <h2>Contact</h2>
      <p>Your content here...</p>
    </section>
    
  </Body>
</Article>

<Footer />
```

## Need Help?

If you have questions or issues:
1. Check this guide
2. Look at `demo-app/src/routes/+page.svelte` for a working example
3. Review component source code in `src/lib/`

