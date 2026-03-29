// Integration: Capture deal analysis after calculation
// Add this to your existing deal analyzer endpoint

import { captureDealAnalysis } from "./deal-capture.js";

// Call this after your deal analysis completes
async function onDealAnalyzed(analysisResult, userContext) {
  const {
    // From user context
    user_id = null,
    session_id = null,
    utm_source = null,
    utm_campaign = null,
    
    // From analysis inputs
    address,
    city,
    province,
    property_type,
    purchase_price,
    down_payment,
    down_payment_pct,
    mortgage_rate = 6.5,
    mortgage_term = 5,
    amortization_years = 25,
    rent_monthly,
    other_income_monthly = 0,
    property_tax_yearly,
    insurance_yearly,
    maintenance_monthly,
    condo_fee_monthly = 0,
    vacancy_rate = 0.05,
    management_fee_pct = 0,
    
    // From calculated results
    cap_rate,
    cash_on_cash,
    irr,
    dscr,
    monthly_cash_flow,
    annual_cash_flow,
    
    // User targets
    target_cap_rate = null,
    target_cash_on_cash = null,
    target_dscr = null,
  } = analysisResult;

  // Capture for flywheel
  try {
    await captureDealAnalysis({
      body: {
        user_id,
        session_id,
        address,
        city,
        province,
        property_type,
        purchase_price,
        down_payment,
        down_payment_pct,
        mortgage_rate,
        mortgage_term,
        amortization_years,
        rent_monthly,
        other_income_monthly,
        property_tax_yearly,
        insurance_yearly,
        maintenance_monthly,
        condo_fee_monthly,
        vacancy_rate,
        management_fee_pct,
        cap_rate,
        cash_on_cash,
        irr,
        dscr,
        monthly_cash_flow,
        annual_cash_flow,
        target_cap_rate,
        target_cash_on_cash,
        target_dscr,
        source: 'web',
        utm_source,
        utm_campaign,
      }
    }, {
      status: () => ({ json: () => {} }), // mock response
    });
    
    console.log(`[Flywheel] Deal captured: ${city}, ${province} - Cap Rate: ${cap_rate}%`);
  } catch (error) {
    console.error("[Flywheel] Failed to capture deal:", error);
    // Don't fail the analysis if capture fails
  }
}

export { onDealAnalyzed };
