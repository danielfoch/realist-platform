# Realist.ca Design Guidelines

## Design Approach

**Selected Approach:** Design System with Modern Fintech Inspiration

Drawing from Linear's refined dark interfaces, Stripe's professional restraint, and modern dashboard patterns. This analyzer must feel sophisticated, credible, and more premium than BiggerPockets while maintaining clarity in complex financial data.

---

## Core Design Elements

### A. Typography

**Font Families:**
- Primary: Inter (Google Fonts) - headlines, UI elements, metrics
- Monospace: JetBrains Mono - financial figures, calculations

**Hierarchy:**
- Hero Headline: text-5xl md:text-6xl font-bold tracking-tight
- Section Headers: text-3xl md:text-4xl font-semibold
- Metric Labels: text-sm font-medium uppercase tracking-wide opacity-70
- Metric Values: text-2xl md:text-4xl font-bold font-mono
- Body Text: text-base leading-relaxed
- Small Text: text-sm opacity-80
- Input Labels: text-sm font-medium

### B. Layout System

**Spacing Primitives:** Use Tailwind units of 2, 4, 6, 8, 12, 16, 24
- Component padding: p-6 md:p-8
- Section spacing: py-12 md:py-16 lg:py-24
- Card gaps: gap-6 md:gap-8
- Form field spacing: space-y-4
- Grid gaps: gap-4 md:gap-6

**Container Strategy:**
- Max width: max-w-7xl mx-auto px-4 md:px-6
- Full-width sections for analyzer interface
- Constrained width (max-w-4xl) for forms and reading content

### C. Component Library

**Cards & Panels:**
- Metric Cards: Elevated panels with gradient borders, p-6, rounded-xl
- Analysis Sections: Contained panels with subtle borders, backdrop-blur effects
- Comparison Panels: Side-by-side split with divider, equal widths on desktop

**Navigation:**
- Top nav: Sticky, backdrop-blur, minimal height (h-16), logo left, CTAs right
- Mobile: Hamburger menu with full-screen overlay

**Forms:**
- Input fields: Large touch targets (h-12), rounded-lg, focus rings with glow effect
- Labels above inputs with clear hierarchy
- Required fields marked with subtle asterisk
- Multi-step forms with progress indicator dots
- Grouped inputs (address, financing) in visual sections with subtle background treatment

**Buttons:**
- Primary CTA: Large (px-8 py-4), rounded-lg, font-semibold
- Secondary: Outlined with border
- Blurred backgrounds when over images/gradients
- Icon + text combinations for actions (Export, Compare, Save)

**Data Visualization:**
- Metric Cards Grid: 2x2 on desktop, single column mobile
- Charts: Full-width containers with min-h-[300px], subtle grid lines, clean axes
- Comparison View: Split-screen with synchronized scroll
- Tables: Striped rows, sticky headers, responsive horizontal scroll

**Strategy Selector:**
- Pill-style radio buttons in horizontal scroll container
- Active state with accent treatment
- Icons paired with strategy names

### D. Page-Specific Layouts

**Landing/Analyzer (/):**
- Hero Section: 70vh, centered content, gradient background treatment
  - Headline + subhead + dual CTAs (stacked on mobile, inline desktop)
  - Social proof bar beneath CTAs (stats with separators)
- Analyzer Interface: Immediately below fold
  - Address input: Prominent, full-width with autocomplete dropdown
  - Strategy selector: Horizontal pills below address
  - Inputs: Two-column grid (desktop), single column (mobile)
  - Results: Grid of metric cards → charts → detailed breakdown
- Lead Capture Modal: Centered overlay, backdrop blur, max-w-md

**About Page:**
- Hero: Brief introduction section
- Team Grid: 2-column on desktop
  - Each bio: Circular headshot (w-32 h-32), name, title, description, business link
  - Links styled as subtle underlined text
- Content: max-w-4xl, generous line-height

**Comparison View:**
- Split screen with vertical divider
- Sticky headers showing strategy names
- Synchronized metric cards and charts
- "Share Comparison" button at top

**Admin Dashboard:**
- Sidebar navigation (fixed, narrow)
- Main content: Tables with search/filter bar
- Data refresh button: Prominent, with last-updated timestamp
- Webhook logs: Expandable rows with status badges

---

## Images

**Hero Section (/):**
- Large gradient background (abstract geometric patterns, not photo)
- OR: Subtle background image of modern multiplex/cityscape with heavy dark overlay (opacity-20)
- No large hero image - focus on tool interface

**About Page:**
- Circular headshot placeholders for Daniel Foch and Nick Hill (use subtle gradient backgrounds if no images)

**Property Analysis:**
- Small map thumbnail (w-full h-48) in export view
- Property image placeholder in PDF exports

---

## Interaction Patterns

**Progressive Disclosure:**
- Show basic inputs first
- "Advanced Options" expandable sections for less common fields
- Tooltips on hover for complex terms (DSCR, IRR definitions)

**Real-time Feedback:**
- Input validation on blur with inline error messages
- Live calculation updates as user types (debounced)
- Loading states for data fetching with skeleton screens

**Mobile Considerations:**
- Bottom sheet modals for mobile
- Collapsible sections in analyzer
- Horizontal scroll for strategy pills and comparison tables
- Sticky CTAs that follow scroll on mobile

---

## Accessibility

- ARIA labels on all interactive elements
- Focus indicators with 2px accent outline
- Sufficient contrast ratios (4.5:1 minimum)
- Form inputs with proper labels and error associations
- Keyboard navigation throughout