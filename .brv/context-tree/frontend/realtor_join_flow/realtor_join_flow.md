---
title: Realtor Join Flow
tags: []
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: '2026-04-25T06:03:59.701Z'
updatedAt: '2026-04-25T06:03:59.701Z'
---
## Raw Concept
**Task:**
Document realtor onboarding multi-step wizard with referral fee capture and lead routing

**Files:**
- client/pages/JoinRealtors.tsx
- client/pages/JoinForm.css

**Flow:**
Contact Info → Business Info → Preferences → Referral Fee → Agreement → POST /api/realtors/join

**Timestamp:** 2026-04-25

**Author:** Realist Platform

## Narrative
### Structure
5-step wizard form in client/pages/JoinRealtors.tsx. FormData interface captures name, email, phone, brokerage, marketsServed, assetTypes, dealTypes, avgDealSize, referralFee, customReferralFeePct, and referralAgreement. Form POSTs to /api/realtors/join with normalized referralFee.

### Dependencies
Requires backend endpoint /api/realtors/join. Referral fee routing tiers visible to matched investors.

### Highlights
Referral fee is captured as structured percentage (20%-40% or Custom 10%-50%) and determines lead routing priority. Custom fees validated between 10-50% with 0.5 step increments. Three routing tiers: Preferred (>=30%), Standard (>=25%), Introductory (<25%). Step validation enforces required fields per step. Agreement terms require realtor to receive referral leads, provide competitive pricing, participate in market feedback, and honor selected referral fee.

### Rules
Step 1: name, email, phone required. Step 2: brokerage, marketsServed, assetTypes, dealTypes required (non-empty arrays). Step 3: avgDealSize required. Step 4: referralFee required; if Custom, must be 10-50%. Step 5: referralAgreement must be true.

### Examples
getCommittedReferralFee() normalizes custom fees: if referralFee !== "Custom" returns formData.referralFee, else returns formData.customReferralFeePct + "%". getReferralRoutingTier() returns tier message based on fee percentage: >=30 is Preferred, >=25 is Standard, <25 is Introductory.

## Facts
- **form_steps**: Realtor join form is a 5-step wizard [project]
- **referral_fee_options**: Standard referral fees are 20%, 25%, 30%, 35%, 40% [project]
- **custom_fee_range**: Custom referral fee range is 10-50% with 0.5 step [project]
- **preferred_tier_threshold**: Preferred routing tier requires >=30% referral fee [project]
- **standard_tier_threshold**: Standard routing tier requires >=25% referral fee [project]
- **api_endpoint**: Form POSTs to /api/realtors/join endpoint [project]
- **markets_count**: Markets served includes 15 Canadian cities [project]
- **asset_types_count**: Asset types include 9 categories from Single Family to Land [project]
- **deal_types_count**: Deal types include 7 strategies from Buy & Hold to Rent-to-Own [project]
