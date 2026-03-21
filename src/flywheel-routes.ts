/**
 * Flywheel API Routes
 * Realist.ca - Deal Capture & Leaderboard
 */

import { Router, Request, Response } from 'express';
import { db } from './db';

const router = Router();

// POST /api/deals/capture
// Captures a deal analysis for the flywheel
router.post('/deals/capture', async (req: Request, res: Response) => {
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
    const result = await db.query(
      `INSERT INTO analyzed_deals (
        user_id, session_id, address, city, province, property_type,
        purchase_price, down_payment, down_payment_pct, mortgage_rate,
        mortgage_term, amortization_years, rent_monthly, other_income_monthly,
        property_tax_yearly, insurance_yearly, maintenance_monthly,
        condo_fee_monthly, vacancy_rate, management_fee_pct,
        cap_rate, cash_on_cash, irr, dscr, monthly_cash_flow, annual_cash_flow,
        target_cap_rate, target_cash_on_cash, target_dscr,
        source, utm_source, utm_campaign
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33)
      RETURNING id, city, province, cap_rate, cash_on_cash, analyzed_at`,
      [
        user_id, session_id, address, city, province, property_type,
        purchase_price, down_payment, down_payment_pct, mortgage_rate,
        mortgage_term, amortization_years, rent_monthly, other_income_monthly,
        property_tax_yearly, insurance_yearly, maintenance_monthly,
        condo_fee_monthly, vacancy_rate, management_fee_pct,
        cap_rate, cash_on_cash, irr, dscr, monthly_cash_flow, annual_cash_flow,
        target_cap_rate, target_cash_on_cash, target_dscr,
        source || 'web', utm_source, utm_campaign
      ]
    );

    return res.status(201).json({
      success: true,
      deal_id: result.rows[0].id,
      message: "Deal analysis captured for flywheel",
    });
  } catch (error) {
    console.error("Error capturing deal analysis:", error);
    return res.status(500).json({ error: "Failed to capture deal analysis" });
  }
});

// GET /api/leaderboard
// Returns leaderboard data for a given period
router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const { period = 'weekly' } = req.query;
    
    let dateFilter;
    switch (period) {
      case 'weekly':
        dateFilter = "NOW() - INTERVAL '7 days'";
        break;
      case 'monthly':
        dateFilter = "NOW() - INTERVAL '30 days'";
        break;
      case 'alltime':
        dateFilter = "NOW() - INTERVAL '10 years'";
        break;
      default:
        dateFilter = "NOW() - INTERVAL '7 days'";
    }

    // Get top users by deal count
    const rankings = await db.query(
      `SELECT 
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
      LIMIT 50`
    );

    // Get aggregate stats
    const stats = await db.query(
      `SELECT 
        COUNT(*) as total_deals_this_period,
        ROUND(AVG(cap_rate)::numeric, 2) as avg_cap_rate,
        ROUND(AVG(cash_on_cash)::numeric, 2) as avg_cash_on_cash,
        MODE() WITHIN GROUP (ORDER BY city) as hottest_city
      FROM analyzed_deals
      WHERE analyzed_at > NOW() - INTERVAL '7 days'`
    );

    return res.json({
      period,
      updatedAt: new Date().toISOString(),
      rankings: rankings.rows.map((r, i) => ({
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
        totalDealsThisPeriod: parseInt(stats.rows[0].total_deals_this_period) || 0,
        avgCapRate: parseFloat(stats.rows[0].avg_cap_rate) || 0,
        avgCashOnCash: parseFloat(stats.rows[0].avg_cash_on_cash) || 0,
        hottestCity: stats.rows[0].hottest_city || "N/A",
      },
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// GET /api/stats/weekly
// Returns weekly stats for email digest
router.get('/stats/weekly', async (req: Request, res: Response) => {
  try {
    const thisWeek = await db.query(
      `SELECT 
        COUNT(*) as deals,
        ROUND(AVG(cap_rate)::numeric, 2) as avg_cap_rate,
        ROUND(AVG(cash_on_cash)::numeric, 2) as avg_cash_on_cash,
        MODE() WITHIN GROUP (ORDER BY city) as hottest_city
      FROM analyzed_deals
      WHERE analyzed_at > NOW() - INTERVAL '7 days'`
    );

    const lastWeek = await db.query(
      `SELECT COUNT(*) as deals
      FROM analyzed_deals
      WHERE analyzed_at > NOW() - INTERVAL '14 days'
        AND analyzed_at <= NOW() - INTERVAL '7 days'`
    );

    const change = thisWeek.rows[0].deals > 0 && lastWeek.rows[0].deals > 0
      ? ((thisWeek.rows[0].deals - lastWeek.rows[0].deals) / lastWeek.rows[0].deals * 100).toFixed(0)
      : 0;

    const topAnalysts = await db.query(
      `SELECT 
        COALESCE(u.name, 'Anonymous') as name,
        COUNT(*) as deals
      FROM analyzed_deals ad
      LEFT JOIN users u ON ad.user_id = u.id
      WHERE ad.analyzed_at > NOW() - INTERVAL '7 days'
      GROUP BY ad.user_id, u.name
      ORDER BY deals DESC
      LIMIT 5`
    );

    return res.json({
      thisWeek: {
        dealsAnalyzed: parseInt(thisWeek.rows[0].deals) || 0,
        changeVsLastWeek: `${change > 0 ? '+' : ''}${change}%`,
        avgCapRate: parseFloat(thisWeek.rows[0].avg_cap_rate) || 0,
        avgCashOnCash: parseFloat(thisWeek.rows[0].avg_cash_on_cash) || 0,
        hottestCity: thisWeek.rows[0].hottest_city || "N/A",
      },
      topAnalysts: topAnalysts.rows.map((a, i) => ({
        rank: i + 1,
        name: a.name,
        deals: parseInt(a.deals),
      })),
    });
  } catch (error) {
    console.error("Error fetching weekly stats:", error);
    return res.status(500).json({ error: "Failed to fetch weekly stats" });
  }
});

// GET /api/recommendations
// AI-powered recommendations based on user preferences and market data
router.get('/recommendations', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.query;

    // Get user's average metrics
    let userAvgCapRate = 0;
    let userAvgCoC = 0;
    
    if (user_id) {
      const userStats = await db.query(
        `SELECT avg_cap_rate, avg_cash_on_cash FROM user_stats WHERE user_id = $1`,
        [user_id]
      );
      if (userStats.rows.length > 0) {
        userAvgCapRate = parseFloat(userStats.rows[0].avg_cap_rate) || 0;
        userAvgCoC = parseFloat(userStats.rows[0].avg_cash_on_cash) || 0;
      }
    }

    // Get city benchmarks
    const benchmarks = await db.query(
      `SELECT city, province, avg_cap_rate, avg_cash_on_cash, total_deals
      FROM regional_benchmarks
      ORDER BY total_deals DESC
      LIMIT 10`
    );

    // Build recommendations
    const recommendations = [];

    // Add market alerts based on trends
    if (benchmarks.rows.length > 0) {
      recommendations.push({
        type: "market_benchmark",
        title: "📊 Market Benchmarks",
        body: `Top analyzed cities: ${benchmarks.rows.slice(0, 3).map(b => b.city).join(', ')}`,
        severity: "info"
      });
    }

    return res.json({
      recommendations,
      benchmarks: benchmarks.rows.map(b => ({
        city: b.city,
        province: b.province,
        avgCapRate: parseFloat(b.avg_cap_rate),
        avgCashOnCash: parseFloat(b.avg_cash_on_cash),
        totalDeals: b.total_deals
      })),
      userMetrics: {
        avgCapRate: userAvgCapRate,
        avgCashOnCash: userAvgCoC
      }
    });
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    return res.status(500).json({ error: "Failed to fetch recommendations" });
  }
});

// Helper function to calculate badges
function calculateBadges(totalDeals: number, avgCapRate: number, avgCashOnCash: number): string[] {
  const badges = [];

  if (totalDeals >= 1) badges.push("🌱 First Deal");
  if (totalDeals >= 10) badges.push("📊 Analyst");
  if (totalDeals >= 50) badges.push("🏆 Pro Analyst");
  if (totalDeals >= 100) badges.push("👑 Deal Machine");
  
  if (totalDeals >= 10 && avgCapRate >= 7.0) badges.push("🎯 Cap Rate King");
  if (totalDeals >= 10 && avgCashOnCash >= 15) badges.push("💰 Cash Flow Master");

  return badges;
}

export default router;
