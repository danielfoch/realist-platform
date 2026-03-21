// Deal Analysis Capture API
// Realist.ca Flywheel - Captures every deal analysis

import { sql } from "../lib/db.js";

// POST /api/deals/capture
// Captures a deal analysis for the flywheel
export async function captureDealAnalysis(req, res) {
  try {
    const {
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
      source,
      utm_source,
      utm_campaign,
    } = req.body;

    // Validate required fields
    if (!city || !purchase_price) {
      return res.status(400).json({
        error: "Missing required fields: city and purchase_price are required",
      });
    }

    // Insert the deal analysis
    const result = await sql`
      INSERT INTO analyzed_deals (
        user_id, session_id, address, city, province, property_type,
        purchase_price, down_payment, down_payment_pct, mortgage_rate,
        mortgage_term, amortization_years, rent_monthly, other_income_monthly,
        property_tax_yearly, insurance_yearly, maintenance_monthly,
        condo_fee_monthly, vacancy_rate, management_fee_pct,
        cap_rate, cash_on_cash, irr, dscr, monthly_cash_flow, annual_cash_flow,
        target_cap_rate, target_cash_on_cash, target_dscr,
        source, utm_source, utm_campaign
      ) VALUES (
        ${user_id}, ${session_id}, ${address}, ${city}, ${province}, ${property_type},
        ${purchase_price}, ${down_payment}, ${down_payment_pct}, ${mortgage_rate},
        ${mortgage_term}, ${amortization_years}, ${rent_monthly}, ${other_income_monthly},
        ${property_tax_yearly}, ${insurance_yearly}, ${maintenance_monthly},
        ${condo_fee_monthly}, ${vacancy_rate}, ${management_fee_pct},
        ${cap_rate}, ${cash_on_cash}, ${irr}, ${dscr}, ${monthly_cash_flow}, ${annual_cash_flow},
        ${target_cap_rate}, ${target_cash_on_cash}, ${target_dscr},
        ${source || 'web'}, ${utm_source}, ${utm_campaign}
      )
      RETURNING id, city, province, cap_rate, cash_on_cash, analyzed_at
    `;

    // Update user stats (trigger will handle this)
    // But let's also update the province breakdown manually
    if (user_id) {
      await sql`
        UPDATE user_stats
        SET province_breakdown = 
          COALESCE(province_breakdown, '{}'::jsonb) ||
          jsonb_build_object(${province}, 
            COALESCE((province_breakdown->>${province})::int, 0) + 1
          )
        WHERE user_id = ${user_id}
      `;
    }

    return res.status(201).json({
      success: true,
      deal_id: result[0].id,
      message: "Deal analysis captured for flywheel",
    });
  } catch (error) {
    console.error("Error capturing deal analysis:", error);
    return res.status(500).json({ error: "Failed to capture deal analysis" });
  }
}

// GET /api/leaderboard
// Returns leaderboard data for a given period
export async function getLeaderboard(req, res) {
  try {
    const { period = "weekly" } = req.query;
    
    let dateFilter;
    switch (period) {
      case "weekly":
        dateFilter = "NOW() - INTERVAL '7 days'";
        break;
      case "monthly":
        dateFilter = "NOW() - INTERVAL '30 days'";
        break;
      case "alltime":
        dateFilter = "NOW() - INTERVAL '10 years'";
        break;
      default:
        dateFilter = "NOW() - INTERVAL '7 days'";
    }

    // Get top users by deal count
    const rankings = await sql`
      SELECT 
        u.id as user_id,
        COALESCE(u.name, 'Anonymous') as name,
        us.total_deals,
        us.avg_cap_rate,
        us.avg_cash_on_cash,
        us.badges,
        us.most_active_city
      FROM users u
      JOIN user_stats us ON u.id = us.user_id
      WHERE us.last_analyzed_at > NOW() - INTERVAL '7 days'
      ORDER BY us.total_deals DESC
      LIMIT 50
    `;

    // Get aggregate stats
    const stats = await sql`
      SELECT 
        COUNT(*) as total_deals_this_period,
        ROUND(AVG(cap_rate)::numeric, 2) as avg_cap_rate,
        ROUND(AVG(cash_on_cash)::numeric, 2) as avg_cash_on_cash,
        MODE() WITHIN GROUP (ORDER BY city) as hottest_city
      FROM analyzed_deals
      WHERE analyzed_at > NOW() - INTERVAL '7 days'
    `;

    return res.json({
      period,
      updatedAt: new Date().toISOString(),
      rankings: rankings.map((r, i) => ({
        rank: i + 1,
        user_id: r.user_id,
        name: r.name,
        deals: r.total_deals,
        avgCapRate: parseFloat(r.avg_cap_rate) || 0,
        avgCashOnCash: parseFloat(r.avg_cash_on_cash) || 0,
        badges: r.badges || [],
        topCity: r.most_active_city,
      })),
      stats: {
        totalDealsThisPeriod: parseInt(stats[0].total_deals_this_period) || 0,
        avgCapRate: parseFloat(stats[0].avg_cap_rate) || 0,
        avgCashOnCash: parseFloat(stats[0].avg_cash_on_cash) || 0,
        hottestCity: stats[0].hottest_city || "N/A",
      },
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
}

// GET /api/stats/weekly
// Returns weekly stats for email digest
export async function getWeeklyStats(req, res) {
  try {
    const thisWeek = await sql`
      SELECT 
        COUNT(*) as deals,
        ROUND(AVG(cap_rate)::numeric, 2) as avg_cap_rate,
        ROUND(AVG(cash_on_cash)::numeric, 2) as avg_cash_on_cash,
        MODE() WITHIN GROUP (ORDER BY city) as hottest_city
      FROM analyzed_deals
      WHERE analyzed_at > NOW() - INTERVAL '7 days'
    `;

    const lastWeek = await sql`
      SELECT COUNT(*) as deals
      FROM analyzed_deals
      WHERE analyzed_at > NOW() - INTERVAL '14 days'
        AND analyzed_at <= NOW() - INTERVAL '7 days'
    `;

    const change = thisWeek[0].deals > 0 
      ? ((thisWeek[0].deals - lastWeek[0].deals) / lastWeek[0].deals * 100).toFixed(0)
      : 0;

    const topAnalysts = await sql`
      SELECT 
        COALESCE(u.name, 'Anonymous') as name,
        COUNT(*) as deals
      FROM analyzed_deals ad
      LEFT JOIN users u ON ad.user_id = u.id
      WHERE ad.analyzed_at > NOW() - INTERVAL '7 days'
      GROUP BY ad.user_id, u.name
      ORDER BY deals DESC
      LIMIT 5
    `;

    return res.json({
      thisWeek: {
        dealsAnalyzed: parseInt(thisWeek[0].deals) || 0,
        changeVsLastWeek: `${change > 0 ? '+' : ''}${change}%`,
        avgCapRate: parseFloat(thisWeek[0].avg_cap_rate) || 0,
        avgCashOnCash: parseFloat(thisWeek[0].avg_cash_on_cash) || 0,
        hottestCity: thisWeek[0].hottest_city || "N/A",
      },
      topAnalysts: topAnalysts.map((a, i) => ({
        rank: i + 1,
        name: a.name,
        deals: parseInt(a.deals),
      })),
    });
  } catch (error) {
    console.error("Error fetching weekly stats:", error);
    return res.status(500).json({ error: "Failed to fetch weekly stats" });
  }
}

// Badge calculation helper
export function calculateBadges(userStats) {
  const badges = [];
  const { total_deals, avg_cap_rate, avg_cash_on_cash } = userStats;

  if (total_deals >= 1) badges.push("🌱 First Deal");
  if (total_deals >= 10) badges.push("📊 Analyst");
  if (total_deals >= 50) badges.push("🏆 Pro Analyst");
  if (total_deals >= 100) badges.push("👑 Deal Machine");
  
  if (total_deals >= 10 && avg_cap_rate >= 7.0) badges.push("🎯 Cap Rate King");
  if (total_deals >= 10 && avg_cash_on_cash >= 15) badges.push("💰 Cash Flow Master");

  return badges;
}
