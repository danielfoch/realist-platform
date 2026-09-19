# Multiplex homepage

The `/` landing page is an architectural scroll story connecting seven stages: Learn, Connect, Find, Design, Finance, Build, and Own.

## Implementation

- `client/src/pages/Landing.tsx` keeps the site's SEO schemas, current auth state, and homepage CTA analytics.
- `client/src/components/scrollcraft/ScrollcraftLanding.tsx` contains the responsive page, chapter navigation, document transitions, feature directory, and footer.
- `KnowledgeScene.tsx` draws the opening podcast book and investor network.
- `MultiplexScene.tsx` draws an isometric lot, plans, structural frame, cladding, and finished multiplex.
- `scrollcraft.css` is scoped to the landing page and uses existing Inter / JetBrains Mono fonts plus a system serif.
- `shared/routeMeta.ts` supplies matching server/client homepage metadata.
- The router suppresses its shared footer only on `/`, which now provides its own footer.

The narrative advances one chapter per 56% of the small viewport height. Scrolling stays native and reversible; no wheel or touch gestures are intercepted. Chapter buttons jump directly to a stage. Measured stage travel keeps scroll positions consistent as mobile browser controls expand and collapse.

Reduced-motion preferences and the Simplify motion toggle use representative still frames. Screens at or below 540px high use seven ordinary document-flow chapters so all copy and controls remain reachable. Artwork uses React SVG and CSS without new application dependencies, external image assets, or animation libraries.

## Destinations and scope

The current main-branch router uses `/tools/cap-rates` for property discovery and `/tools/multiplex-underwriter` for multiplex underwriting. `/deals` is a watchlist redirect in this revision; `/multiplex` is not registered. Other CTAs use the existing podcast, meetups, co-investing, tools, encyclopedia, professional matching, and booking pages.

The 400+ episode and 150,000+ property figures are supplied in the design brief. Detailed multiplex concepts are described as Toronto-specific. Budget, mortgage, lease and property visuals are illustrative. This page does not issue financing commitments, architectural approvals, leases, or guarantee MLI Select eligibility.

## Verification

- Strict TypeScript check of all new components.
- Production build of the isolated landing entry.
- Complete frontend production build using the repository Vite configuration and locked dependencies: 3,460 modules passed. Existing Browserslist, PostCSS and large-chunk warnings remain.
- All seven chapters checked at 1440×960, 390×844, and 375×667, including direct chapter jumps.
- Compact desktop checked at 1280×577 and normal-flow landscape at 844×390.
- Mobile menu, Escape dismissal, reduced-motion scenes, console errors and horizontal overflow checked.
- Axe accessibility audit: no detected violations at 1280×577 and 390×844. Decorative text within layered artwork needs visual inspection, which was performed.

This is a homepage change on `codex/multiplex-scrollcraft`; review before merging into the live site. The app's ordinary development and production commands remain unchanged.
