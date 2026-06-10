---
children_hash: a5f66d2181d93822b6dc7c11c9fbb5a04afb024236fc4b6eecbe59604a84f9ae
compression_ratio: 0.6594360086767896
condensation_order: 1
covers: [context.md, join_form_design_system.md]
covers_token_total: 461
summary_level: d1
token_count: 304
type: summary
---
# Frontend Design System

## Overview
Documents the CSS design system and visual styling patterns used across Realist Platform forms, with detailed implementation captured in the **Join Form Design System** entry.

## Visual Architecture
- **Theme**: Dark mode with gradient backgrounds and glassmorphism cards
- **Background**: Dark gradient (`#1a1a2e` → `#16213e`)
- **Primary Accent**: Indigo/purple gradient (`#6366f1` → `#8b5cf6`)
- **Status Colors**: Success green (`#10b981` → `#059669`), Error red (`#ef4444` with `#fca5a5` text)
- **Card Styling**: Glassmorphism via `backdrop-filter: blur(10px)`

## Component Patterns
- `.step-indicator` — Horizontal progress tracker
- `.checkbox-grid` — Auto-fill grid (`minmax(150px, 1fr)`)
- `.agreement-box` — Purple-tinted with arrow bullets
- `.routing-preview` — Green-tinted tier display
- `.form-actions` — Flex row layout

## Responsive Behavior
- **Breakpoint**: `640px` max-width
- Mobile view hides step titles, switches to single-column grid, stacks action buttons vertically

## Implementation
- Source: `client/pages/JoinForm.css`
- Uses CSS custom properties for theming
- See **Join Form Design System** for detailed component specifications and examples