# Toronto Multiplex Financial Model

All numeric examples are **ILLUSTRATIVE — VERIFY CURRENT CMHC MLI SELECT RULES, LENDER QUOTES, TORONTO FEES/TAXES AND MARKET INPUTS BEFORE PUBLISHING**.

## Common development cost

Variables: land `L`; gross floor area `GFA`; hard cost/sf `HC`; soft-cost ratio `s`; charges/fees `F`; construction interest/carry `C`; contingency `K`; selling/legal/other `O`.

`Hard = GFA × HC`; `Soft = Hard × s`; `TDC = L + Hard + Soft + F + C + K + O`.

Construction carry uses monthly draws: `C = Σ(balance_m × rate_m / 12) + lender fees`. A simplified validation model may use average balance = 50% of construction costs, but publication must identify that approximation.

Density: `units/site = U`; `units/acre = U / lot_acres`; `FSI = GFA / lot_area`; net efficiency `e = net_rentable_or_saleable / GFA`.

## MLI Select rental hold

- Gross potential rent `GPR = Σ(monthly_rent_i × units_i × 12)`.
- Effective gross income `EGI = GPR × (1-vacancy) + other_income`.
- Operating expenses `OpEx = EGI × expense_ratio` or itemized expenses.
- `NOI = EGI - OpEx`.
- Stabilized value `V = NOI / cap_rate`.
- Annual mortgage constant `MC(r,n) = 12 × [i(1+i)^N / ((1+i)^N-1)]`, where `i=r/12`, `N=12n`.
- DSCR debt cap `D_dscr = NOI / (target_DSCR × MC)`.
- LTC debt cap `D_ltc = eligible_cost × max_LTC`.
- Loan `D = min(D_dscr, D_ltc, V × max_LTV)`.
- Include insurance premium in debt/cash per verified lender treatment.
- `Return on cost = NOI / TDC`; `cash-on-cash = (NOI - annual_debt_service) / initial_cash`.
- Levered IRR is `IRR([-initial_cash, annual_cash_flow_1...annual_cash_flow_h + net_sale_proceeds_h])`.
- `initial_cash = TDC - funded_debt + premium_paid_in_cash + initial_reserves`; `annual_cash_flow_t = NOI_t - annual_debt_service_t - capital_reserves_t`; `net_sale_proceeds_h = sale_value_h - selling_costs_h - debt_balance_h`.
- Residual land value at target profit/return is solved for `L` where target IRR or target return-on-cost is met.

MLI affordability/energy/accessibility points may alter amortization, LTC/LTV and premium. Exact thresholds/terms belong in the assumption registry and remain illustrative until verified from current CMHC documents and lender quote.

## Condo exit

- `SellableGFA = GFA × sale_efficiency`.
- `GrossSellout = SellableGFA × price_per_sf + parking/other revenue`.
- `NetRevenue = GrossSellout - commissions - marketing - closing/legal - applicable HST/rebates`.
- `Profit = NetRevenue - TDC`; `margin_on_cost = Profit/TDC`; `margin_on_revenue = Profit/NetRevenue`.
- Deal IRR uses monthly land/predevelopment/construction draws and net sellout receipts.
- Residual land value is the maximum `L` that satisfies target margin and target IRR; use the lower result.

## Assumption registry

`(key, value, unit, effective_date, source_link, source_retrieved_at, scenario[base|bull|bear], geography, archetype, model_version, verified_by, verification_status)`.

Required exhaustive key families:

- Site/density: `land_cost`, `lot_area_sf`, `lot_acres`, `units`, `gfa_sf`, `fsi`, `net_efficiency`, `sale_efficiency`, `unit_mix`, `unit_size_sf`.
- Cost/timing: `hard_cost_per_sf`, `hard_cost_per_unit`, `soft_cost_ratio`, `contingency`, `other_cost`, `development_charges_per_unit`, `municipal_fees`, `tax_treatment`, `predevelopment_months`, `construction_months`, `leaseup_months`, `sellout_months`, `draw_curve`.
- Construction debt: `construction_rate`, `construction_lender_fee`, `average_balance_factor`.
- Rental/NOI: `rent_per_unit_monthly`, `vacancy_rate`, `expense_ratio`, `other_income`, `capital_reserve`, `rent_growth`.
- MLI/takeout: `takeout_rate`, `amortization_years`, `target_dscr`, `max_ltc`, `max_ltv`, `eligible_cost_definition`, `insurance_premium_pct`, `premium_cash_or_financed`, `takeout_lender_fee`.
- Hold valuation: `cap_rate`, `hold_years`, `exit_cap_rate`, `sale_cost_ratio`, `discount_rate`, `target_roc`, `target_irr`, `initial_reserves`.
- Condo: `condo_price_per_sf`, `parking_other_revenue`, `commission_ratio`, `marketing_ratio`, `closing_legal_cost`, `hst_rebate_treatment`, `target_margin`, `condo_discount_rate`.

Published output stores the sorted-assumption SHA-256. Fixture `otherCost` maps to `other_cost`; every matrix axis, hurdle and cash-flow component must resolve to one listed key before computation.

## NPV and decision-value convention

At monthly period `t`, `NPV = Σ(CF_t / (1 + annual_discount_rate/12)^t)`. `NPV_hold` includes initial equity, operating cash flow, reserves, refinance/takeout fees and terminal net sale proceeds. `NPV_condo` includes land/predevelopment/construction draws and after-tax/fee unit closing receipts. Both are measured at the same valuation date in nominal CAD, with timing and discount rates from the registry. The decision frontier compares these two NPVs; IRR remains a separate hurdle.

## Delta from existing Multiplex Underwriter

| Existing page | Study addition |
|---|---|
| Site-specific configurations and provenance badges | Portfolio/report-grade effective-dated assumption registry |
| MLI max loan, premium, DSCR, amortization | Rate × density matrix, explicit debt-sizing formula and verified-current rule version |
| Condo profit/margin and MLI horizon profit | Monthly cash-flow IRR, residual-land-value surface and decision frontier |
| User-tuned takeout inputs | Base/bull/bear governed inputs with assumption hash |
| One site/config result | Reproducible archetype and neighbourhood study cohorts |

## Worked fixture cells

Base fixture assumptions use $3,000 monthly rent/unit, 3% vacancy, 30% expense ratio, 1.10 DSCR and 40-year amortization.

- Five units at 4.0%: `NOI = 5 × 3,000 × 12 × 0.97 × 0.70 = $122,220`. Annual mortgage constant is `5.013%`; `DSCR debt = 122,220 / (1.10 × 0.05013) = $2,215,420` (rounded).
- Six units at 5.0%: `NOI = 6 × 3,000 × 12 × 0.97 × 0.70 = $146,664`. Annual mortgage constant is `5.787%`; `DSCR debt = 146,664 / (1.10 × 0.05787) = $2,304,228` (rounded).

The offline validator recomputes these values; they are arithmetic fixtures, not lender quotes.
