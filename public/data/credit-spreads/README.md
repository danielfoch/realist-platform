# Credit Spreads Report Data

Generated from: `data/canada_us_credit_spreads/`
Generated at: 2026-04-24T02:36:45.128Z

## Files

- `report-data.json` — normalized datasets and source metadata for the interactive Realist insight page.
- `source-registry.json` — source registry rows preserved from the supplied data pack.

## Datasets in report-data.json

- `datasets.officialCreditSpreadSeries` — monthly Bank of Canada aggregate spread series using insured 5-year residential mortgages vs total business loans.
- `datasets.entrepreneurProxySeries` — borrower-facing proxy points from the supplied seed file. This is not a true time series.
- `datasets.businessDynamism` — annual business entry, exit, and net entry rates for Canada.
- `datasets.gdpPerCapita` — annual real GDP per capita in 2017 CAD.
- `datasets.housingEconomicAccount` — 2024 housing economic account headline values from Statistics Canada.
- `sourceRegistry` — source metadata, URLs, statuses, and caveats from the pack.

## Input Pack README

# Canada vs U.S. Residential vs Business Credit Spread Dataset Pack

Created: 2026-04-24

This pack contains seed datasets for the Realist/OpenClaw whitepaper on whether Canada’s credit architecture has redirected capital toward residential housing rather than productive business investment.

## What is inside

- `source_registry.csv` — official data sources, series IDs, and fetch URLs.
- `ca_mortgage_5y_historical_monthly.csv` — Bank of Canada historical 5-year conventional mortgage posted rate, monthly, 1973-2010.
- `ca_posted_rates_recent.csv` — Bank of Canada latest weekly posted rates from the public table.
- `ca_lending_rates_recent.csv` — Bank of Canada latest monthly mortgage and corporate lending rates from the public table.
- `credit_spread_seed_recent.csv` — derived recent spread examples and proxy spread flags.
- `ca_business_entry_exit_2002_2023.csv` — Statistics Canada business entry/exit rates.
- `ca_business_entry_exit_1983_2012.csv` — archived long-run entry/exit rates.
- `us_small_business_rates_q4_2024_q4_2025.csv` — Kansas City Fed small-business loan rate chart data.
- `us_mortgage30us_recent.csv` — recent FRED/Freddie Mac 30-year mortgage observations.
- `ca_gdp_per_capita_annual.csv` — recent StatCan real GDP per capita annual values.
- `us_residential_investment_share_gdp_annual_recent.csv` — recent U.S. residential fixed investment share of GDP.
- `ca_housing_economic_account_2024.csv` — StatCan Housing Economic Account 2024 summary metrics.
- `openclaw_fetch_credit_spreads.py` — script to pull the full official datasets from BoC/FRED/StatCan.

## Important caveats

1. The official Bank of Canada aggregate business lending spread is not the same as entrepreneur-facing SME credit friction. The whitepaper should distinguish:
   - official aggregate lending-rate spreads; and
   - all-in access-to-capital spreads including leverage, collateral, underwriting, guarantees, and borrower eligibility.

2. BDC simulator values are included only as a point-in-time retail proxy, not as a time series.

3. The U.S. small-business lending rate seed should be matched to a quarterly average of MORTGAGE30US after the full FRED pull.

4. The Canada historical 5-year mortgage seed stops at 2010 because it is sourced from the exposed Bank of Canada historical PDF table. Use the fetch script to extend current series via StatCan/BoC.

## Core derived spread formulas

- Official Canada aggregate spread:
  `business_loan_rate_pct - residential_mortgage_rate_pct`

- Spread in basis points:
  `(business_loan_rate_pct - residential_mortgage_rate_pct) * 100`

- Entrepreneur-facing proxy:
  `BDC implied rate - BoC posted 5-year mortgage rate`
