---
title: Join Form Design System
tags: []
keywords: []
importance: 55
recency: 1
maturity: draft
updateCount: 1
createdAt: '2026-04-25T06:03:59.702Z'
updatedAt: '2026-04-25T06:03:59.705Z'
---
## Raw Concept
**Task:**
Document the CSS design system used for realtor join form

**Files:**
- client/pages/JoinForm.css

**Timestamp:** 2026-04-25

## Narrative
### Structure
Dark theme design system with gradient backgrounds and glassmorphism cards. Uses CSS custom properties and responsive breakpoints.

### Highlights
Background uses dark gradient (#1a1a2e → #16213e). Primary accent is indigo/purple gradient (#6366f1 → #8b5cf6). Success uses green gradient (#10b981 → #059669). Error uses red (#ef4444 with #fca5a5 text). Cards use glassmorphism with backdrop-filter: blur(10px). Key components: .step-indicator (horizontal progress), .checkbox-grid (auto-fill, minmax 150px), .agreement-box (purple-tinted with arrow bullets), .routing-preview (green-tinted tier display), .form-actions (flex row). Responsive breakpoint at 640px hides step titles, uses single-column grid, stacks actions vertically.

### Examples
Glassmorphism card style: backdrop-filter: blur(10px). Checkbox grid: grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)). Mobile breakpoint: @media (max-width: 640px)

## Facts
- **background_gradient**: Design system uses dark gradient background [project]
- **primary_accent**: Primary accent color is indigo/purple gradient [project]
- **card_style**: Cards use glassmorphism with 10px blur [project]
- **mobile_breakpoint**: Mobile responsive breakpoint is 640px [project]
