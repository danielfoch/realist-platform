---
children_hash: 3875c439243906d6401980230282a276f6ac916ef2e9fd129b7e5119309f7506
compression_ratio: 0.5937904269081501
condensation_order: 1
covers: [context.md, realtor_join_flow.md]
covers_token_total: 773
summary_level: d1
token_count: 459
type: summary
---
# Realtor Join Flow - Structural Summary

## Overview
Multi-step wizard for realtor onboarding that captures contact information, business preferences, and referral fee commitments to determine lead routing priority.

## Architecture
- **Primary Component**: `client/pages/JoinRealtors.tsx` with styling in `client/pages/JoinForm.css`
- **API Endpoint**: `POST /api/realtors/join`
- **Flow**: Contact Info → Business Info → Preferences → Referral Fee → Agreement → Submission

## 5-Step Wizard Structure

| Step | Focus | Required Fields |
|------|-------|-----------------|
| 1 | Contact Info | name, email, phone |
| 2 | Business Info | brokerage, marketsServed, assetTypes, dealTypes (non-empty arrays) |
| 3 | Preferences | avgDealSize |
| 4 | Referral Fee | referralFee (or customReferralFeePct if "Custom") |
| 5 | Agreement | referralAgreement (must be true) |

## Referral Fee System

**Standard Options**: 20%, 25%, 30%, 35%, 40%

**Custom Range**: 10%-50% with 0.5% step increments

### Lead Routing Tiers
- **Preferred** (≥30%): Highest priority routing
- **Standard** (≥25%): Standard routing
- **Introductory** (<25%): Lower priority routing

## Key Functions
- `getCommittedReferralFee()`: Normalizes fee display (returns standard percentage or custom value with "%" suffix)
- `getReferralRoutingTier()`: Determines tier messaging based on fee percentage

## Data Scope
- **Markets**: 15 Canadian cities
- **Asset Types**: 9 categories (Single Family through Land)
- **Deal Types**: 7 strategies (Buy & Hold through Rent-to-Own)

## Agreement Terms
Realtors must commit to: receiving referral leads, providing competitive pricing, participating in market feedback, and honoring selected referral fee percentage.

---
*For detailed implementation specifics, validation logic, and code examples, see `realtor_join_flow.md`*