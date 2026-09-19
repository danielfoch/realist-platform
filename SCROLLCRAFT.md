# Multiplex homepage

The `/` landing page opens directly on the multiplex journey, in light grey, charcoal, and Realist red. It is an architectural scroll story connecting eleven short stages: Learn, Education, Connect, Analyze, Find, Design, Offer, Finance, Build, Own, and Operate.

## Implementation

- `client/src/pages/Landing.tsx` keeps the site's SEO schemas, current auth state, and homepage CTA analytics.
- `client/src/components/scrollcraft/ScrollcraftLanding.tsx` contains the responsive page, chapter navigation, document transitions, feature directory, and footer.
- `KnowledgeScene.tsx` draws the podcast phone with the official show cover, wireless earbuds, a graduation cap, the investor network, and a rotating property map with ranked illustrative scenarios. A selected map dot expands into the measured parcel.
- `MultiplexScene.tsx` draws an isometric lot, plans, structural frame, cladding, and finished multiplex.
- `OperatingScene.tsx` turns the finished asset into an illustrative upward performance chart with leasing, maintenance, reporting, and long-term management support.
- `scrollcraft.css` is scoped to the landing page and uses existing Inter / JetBrains Mono fonts plus a system serif.
- `shared/routeMeta.ts` supplies matching server/client homepage metadata.
- The router suppresses its shared footer only on `/`, which now provides its own footer.

The narrative advances one chapter per 37% of the small viewport height. Scrolling stays native and reversible; no wheel or touch gestures are intercepted. Native CSS proximity snapping settles the text and artwork on complete chapter frames, with snap stops at each chapter. Chapter buttons jump directly to a stage; scrolling remains free after the story. Measured stage travel keeps scroll positions consistent as mobile browser controls expand and collapse.

Reduced-motion preferences and the Simplify motion toggle use representative still frames. Screens at or below 540px high use eleven ordinary document-flow chapters so all copy and controls remain reachable. Artwork uses React SVG and CSS without new application dependencies or animation libraries. The official podcast cover is bundled as an optimized local JPG. The text column visibly travels through a clipped vertical rail, while the architectural stage stays pinned; subtle arrows prompt scrolling on arrival.

## Destinations and scope

The current main-branch router uses `/tools/cap-rates` for property discovery and `/tools/multiplex-underwriter` for multiplex underwriting. `/deals` is a watchlist redirect in this revision; `/multiplex` is not registered. Other CTAs use the existing podcast, meetups, co-investing, tools, encyclopedia, professional matching, and booking pages.

The 400+ episode, 150,000+ property, Canada’s #1 podcast, and 100+ education hours claims are supplied in the design brief. Detailed multiplex concepts are described as Toronto-specific. Budget, mortgage, lease and property visuals are illustrative. This page does not issue financing commitments, architectural approvals, leases, or guarantee MLI Select eligibility.

## Verification

- Strict TypeScript check of all new components.
- Production build of the isolated landing entry.
- Complete frontend production build using the repository Vite configuration and locked dependencies: 3,462 modules passed. Existing Browserslist, PostCSS and large-chunk warnings remain.
- Homepage Playwright smoke test passed against the complete built frontend; the existing statistics API test remains for CI.
- Native wheel scrolling and touch swipes checked forward/backward, with chapters snapping to their completed frames and free exit into the feature directory. Reduced-motion touch checks confirmed still frames and no arrow loop.
- All eleven chapters checked at 1440×960, 390×844, and 375×667, including direct chapter jumps.
- Compact desktop checked at 1280×577 and normal-flow landscape at 844×390. Narrow 320×568 phones retain readable copy and clickable CTAs across all eleven stages.
- Mobile menu, Escape dismissal, reduced-motion scenes, console errors and horizontal overflow checked.
- Axe accessibility audit: no detected violations at 1280×577 and 390×844. Decorative text within layered artwork needs visual inspection, which was performed.

This is a homepage change on `codex/multiplex-scrollcraft`; review before merging into the live site. The app's ordinary development and production commands remain unchanged.

## Revision notes

The user requested red accents on the light grey canvas, removal of the hero/preamble, a phone and wireless earbuds instead of the book, a graduation-cap education chapter, instant deal analysis on a phone map before the lot, and a dedicated offer/cashback chapter after design. The existing networking composition is preserved. Ontario cashback is qualified and identifies Keypr; the offer CTA links to the existing `/offer` workflow.

Podcast artwork was obtained from the official show RSS feed’s channel image on 2026-09-19, resized to 720px, and bundled locally. Moving soundbars are decorative; no audio autoplays. Reduced motion and Simplify motion disable the looping bars, arrow animation, and continuous text travel.

## AI and long-term operations

Chapter 11, Operate, follows Own with a scroll-drawn positive performance chart and property/asset management support. Its chart is an illustrative index, not an actual return series or forecast. The team CTA opens the existing `/work-with-realist` intake.

AI copy is grounded in existing product features: Ask Realist in `/tools/analyzer`, the Toronto AI Multiplex Underwriter, and AI-assisted operations through the PropCare partner profile. The feature directory links to `/community/events/partners/propcare`; this is partner technology, not a newly implemented Realist management dashboard. Automated calculations and prototype rankings are not described as trained AI, and podcast/networking remain human-led.
