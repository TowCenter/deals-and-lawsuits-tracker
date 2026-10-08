# Tow Design System

A collection of Svelte components for journalism projects, developed by the Tow Center for Digital Journalism.

## Installation

### From GitHub

```bash
npm install github:TowCenter/tow-design-system
```

## Usage

### Import Components

```javascript
import {
  Article,
  Body,
  BodyText,
  Footer,
  Head,
  Header,
  Headline,
  TowPartnerLogo
} from '@tow/design-system';
```

### Import Styles

```javascript
// Import CSS files directly
import '@tow/design-system/tow.css';
import '@tow/design-system/cjr.css';

// Or import CSS URLs programmatically
import { towCSS, cjrCSS } from '@tow/design-system';
```

### Example

```svelte
<script>
  import {
    Head,
    Article,
    Header,
    Headline,
    Body,
    BodyText,
    Footer,
    TowPartnerLogo
  } from '@tow/design-system';
  import '@tow/design-system/tow.css';
</script>

<Head />
<Header />
<Article>
  <Headline
    hed="Your Headline Here"
    subhed="Your subheadline here"
    date="September 23, 2025"
    byline_url="https://example.com/author"
    byline="Author Name"
  >
    <TowPartnerLogo />
  </Headline>

  <Body>
    <BodyText
      text="Your article content goes here..."
    />
  </Body>
</Article>
<Footer />
```

## Components

- **Article**: Main article container
- **Body**: Article body container
- **BodyText**: Text content component
- **Footer**: Site footer
- **Head**: Document head with metadata
- **Header**: Site header
- **Headline**: Article headline with byline and date
- **TowPartnerLogo**: Tow Center partner logo

## Development

This package is built with SvelteKit. To contribute:

1. Clone the repository
2. Install dependencies: `npm install`
3. Run the demo app: `cd demo-app && npm run dev`
4. Build the package: `npm run build`

## License

MIT

### Network component responsibilities

- `CardView.svelte` owns card state and opens entity networks.
- `EntityNetworkIcon.svelte` owns icon visibility, hover/focus tooltips and positioning.
- `NetworkRelationshipPreview.svelte` renders the small tooltip graph.
- `PublisherNetwork.svelte` owns the interactive full graph and related cards.
- `publisherRelationships.js` indexes named-party relationships and applies downward inheritance: children inherit parent relationships, while parents and siblings do not inherit child relationships. The current card is included in previews but excluded when deciding whether there are other relationships.
- `publisherNetwork.js` and its worker handle ownership, layout and routing.
- `trackerData.js` normalizes the dataset before it reaches UI components.

Dataset arrays are treated as immutable snapshots; replace the array when data changes so cached indexes and layouts are refreshed. Run `npm test`, `npm run check` and `npm run build` after changes.
