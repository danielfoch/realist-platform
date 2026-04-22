# Realist.ca — Platform AI Strategy

**Internal technical note. Audience: engineering, product, and data.**

---

## 1. What We're Building Toward

Realist's long-term goal is a **Bloomberg Terminal for Canadian real estate**: every piece of market data, investor intelligence, financing context, and deal analysis in one place — with AI that knows what you care about before you ask.

The infrastructure we build today determines whether that's possible in two years.

This document describes:
- The behavioral event taxonomy (what we capture and why)
- The structured inference data model (investor profiles)
- The labeled dataset strategy (how interactions become training data)
- The path to a specialized small language model for real estate

---

## 2. Event Tracking

Every meaningful user action is captured as a structured event via `POST /api/events/track`.

### Event Taxonomy

| Event | Captures | Future Use |
|---|---|---|
| `search_submitted` | Query text, geography, asset type, budget | NL search model training |
| `nl_query_submitted` | Raw natural language query | Intent classification, query expansion |
| `listing_viewed` | Listing ID, city, type, price, yield | Demand signal, recommendation |
| `analyzer_started` | Address, strategy, source | Funnel analysis, propensity model |
| `analyzer_completed` | Full underwriting output (yield, CoC, IRR) | Underwriting norm dataset |
| `geography_selected` | City, province | Market interest heatmap |
| `asset_type_selected` | Property type | Investor segmentation |
| `saved_listing` | Listing details | Implicit preference signal |
| `saved_search` | Filter set | Persistent criteria model |
| `lead_captured` | Source, strategy | Conversion attribution |
| `consultation_requested` | Type (mortgage/realtor/coaching) | High-intent routing |
| `partner_interest` | Partner type | B2B demand signal |
| `newsletter_signup` | Source, page | Content funnel attribution |
| `content_consumed` | Content type, ID, title | Recommendation training |
| `cta_clicked` | CTA label, location, destination | UX optimization |
| `account_created` | Method (email/google) | Activation funnel |

### Schema (future DB migration)

```sql
CREATE TABLE event_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name  TEXT NOT NULL,
  session_id  TEXT,
  user_id     TEXT REFERENCES users(id),
  page        TEXT,
  referrer    TEXT,
  ip_hash     TEXT,          -- SHA-256 truncated, not reversible
  properties  JSONB,
  server_ts   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON event_log (event_name);
CREATE INDEX ON event_log (user_id);
CREATE INDEX ON event_log (session_id);
CREATE INDEX ON event_log (server_ts);
```

Currently events are logged to structured stdout (JSON) for collection by the hosting platform log aggregator. Migrate to DB table once volume justifies indexing.

---

## 3. Structured Investor Preference Data

Beyond raw events, we infer structured investor profiles from behavior. These are captured via `InvestorPreferenceSignal` in `client/src/lib/analytics.ts` and stored per-session (and optionally per-user when authenticated).

```typescript
interface InvestorPreferenceSignal {
  strategy?: "buy_hold" | "brrr" | "multiplex" | "flip" | "airbnb";
  geography?: string;
  province?: string;
  budget_min?: number;
  budget_max?: number;
  target_gross_yield?: number;
  target_coc?: number;         // cash-on-cash return
  target_irr?: number;
  property_type?: string;      // duplex, triplex, sfh, condo, commercial
  financing_intent?: boolean;
  renovation_intent?: boolean;
  timeline?: string;           // "now" | "6mo" | "1yr" | "2yr+"
}
```

These signals are used to:
- Personalize listing recommendations (future)
- Pre-fill deal analyzer assumptions (near-term)
- Route users to the right expert/partner (near-term)
- Segment newsletter and email content (near-term)

---

## 4. Labeled Dataset Strategy

The platform passively generates labeled datasets from normal usage:

### A. Search Relevance Dataset
- **Inputs:** NL query text, search filters applied
- **Labels:** Listings clicked, time spent, save events, analyzer starts
- **Use:** Train a ranking model that surfaces better deal results over time

### B. Underwriting Norm Dataset
- **Inputs:** `analyses` table — all inputs_json rows (price, rents, expenses, financing assumptions)
- **Labels:** Strategy type, city, property type, user expertise level (leaderboard rank)
- **Use:** Train a model to suggest reasonable underwriting assumptions for any Canadian market

### C. Investor Preference Dataset
- **Inputs:** InvestorPreferenceSignal per user + session events
- **Labels:** Deals saved, consultations booked, accounts created, deals closed (future)
- **Use:** Personalized deal recommendations, expert matching

### D. Market Signal Dataset
- **Inputs:** Listing views, geographic clicks, save events by city/asset class
- **Labels:** Market demand vs. supply indicators (inferred)
- **Use:** Market heat index, early trend detection

### E. Expert Match Dataset
- **Inputs:** consultation_requested events + partner_interest events
- **Labels:** Match accepted, response rate, conversion (future CRM data)
- **Use:** Better routing of investors to realtors/lenders by fit

---

## 5. Path to a Specialized Small Language Model

Realist's long-term goal is a **Realist AI** — a specialized small model for Canadian real estate investing. This is not AGI hype. It's a domain-specific, retrieval-augmented model that knows things no general-purpose LLM knows well:

- Current Canadian cap rates by neighbourhood and asset class
- CMHC rental data and vacancy trends by city
- Ontario/BC/AB zoning and fourplex policy specifics
- Realistic renovation cost ranges by market
- BRRR refinance math for current mortgage conditions
- Power of sale / foreclosure timelines by province
- MLI Select underwriting criteria
- Stress test implications for investor financing

### Model Architecture (Target)

```
[User Query]
     │
     ▼
[Query Classifier] — intent: underwriting | market_data | zoning | financing
     │
     ▼
[Retriever]
  ├── Vector search over Realist proprietary data
  │     (cap rates, rent data, deal analyses, market reports)
  └── Structured query over analyses + event_log tables
     │
     ▼
[Small LM with domain fine-tuning]
  Base: Llama 3.x / Mistral / Phi-4 (7B–14B range)
  Fine-tuned on: labeled Q&A from investor interactions
     │
     ▼
[Structured Output]
  ├── Underwriting suggestions
  ├── Market comparables
  ├── Zoning/policy interpretation
  └── Recommended next action (analyze deal / contact expert / view listing)
```

### What We Need to Build First

| Capability | Data Source | Timeline |
|---|---|---|
| Cap rate retrieval | Realist market reports + community underwriting | Now |
| Rent comp lookup | CMHC data + community estimates | Now |
| Underwriting suggestions | `analyses` table (10k+ records) | Near-term |
| Zoning Q&A | Curated municipal policy docs | Near-term |
| Investor Q&A | Podcast transcripts + blog + community posts | Near-term |
| Financing guidance | Mortgage rate data + CMHC guidelines | Near-term |
| Deal classification | `analyses` table + event labels | Mid-term |
| Fine-tuned SLM | All of the above (labeled pairs) | Long-term |

### Why This Matters

A Realist-trained model knows things Claude and GPT-4 don't:
- What's a realistic cap rate in Hamilton, ON for a triplex right now?
- Is this BRRR deal viable at current rates given the STR market in Collingwood?
- What's the fourplex zoning path for this address in Ottawa?
- Should this investor use insured or conventional financing for this deal?

General-purpose LLMs hallucinate on specific Canadian real estate questions. A model trained on Realist's proprietary data won't.

---

## 6. Data Ethics & Privacy

All behavioral data collection follows these principles:

- **Disclosed:** Platform privacy policy will be updated to describe AI model training use of anonymized data
- **Anonymized:** IP addresses are SHA-256 hashed and truncated (not reversible)
- **Opt-out ready:** User preference to exclude their data from model training (future settings flag)
- **Aggregated for training:** Individual deal data is never exposed — only aggregate patterns and anonymized vectors
- **Proportional:** We collect what we need to improve the product, not everything possible

---

## 7. Near-Term Implementation Priorities

1. **[Done]** Event tracking client (`client/src/lib/analytics.ts`)
2. **[Done]** Event tracking endpoint (`POST /api/events/track`)
3. **[Next]** Migrate event logging from stdout to `event_log` table
4. **[Next]** Attach investor preference signals to user profile (when authenticated)
5. **[Next]** Build first recommendation feature: "Deals matching your criteria"
6. **[Next]** Add NL query intent parsing (simple regex → strategy/geography/budget extraction)
7. **[Later]** Retrieval-augmented Q&A over Realist market data
8. **[Later]** SLM fine-tuning on underwriting dataset

---

*Last updated: April 2026. Owner: Engineering/Product.*
