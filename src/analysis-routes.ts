/**
 * Deal Analysis Persistence API Routes
 * Implements Non-Negotiable #4: Analysis Memory
 * Persist underwriting sessions to user profiles so users build investing workflows
 */

import { Router, Request, Response } from 'express';
import { db } from './db';

const router = Router();

interface SaveAnalysisBody {
  listingId?: string;
  address: string;
  propertyType?: string;
  propertySubType?: string;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  yearBuilt?: number;
  city?: string;
  province?: string;
  postalCode?: string;
  inputs: Record<string, unknown>;
  metrics: Record<string, unknown>;
  verdictCheck?: string;
  notes?: string;
  tags?: string[];
  matchedListing?: boolean;
}

interface UserRequest extends Request {
  userId?: string;
}

// Save an analysis (authenticated user or session-based)
router.post('/', async (req: Request<{}, unknown, SaveAnalysisBody>, res: Response) => {
  const {
    listingId,
    address,
    propertyType,
    propertySubType,
    bedrooms,
    bathrooms,
    sqft,
    yearBuilt,
    city,
    province,
    postalCode,
    inputs = {},
    metrics = {},
    verdictCheck,
    notes,
    tags,
    matchedListing,
  } = req.body;

  if (!address || !metrics.listPrice) {
    return res.status(400).json({ error: 'Address and list price are required' });
  }

  try {
    const userId = (req as UserRequest).userId;

    const result = await db.query(
      `INSERT INTO deal_analyses (
        user_id, listing_id, address, property_type, city, province, postal_code,
        bedrooms, bathrooms, sqft,
        list_price, down_payment, down_payment_pct, mortgage_rate, amortization_years,
        monthly_rent, annual_vacancy, annual_appreciation,
        closing_costs, renovation_costs, property_taxes, property_insurance,
        maintenance_pct, management_pct,
        cap_rate, cash_flow, cash_on_cash, monthly_mortgage,
        gross_income, net_income, total_operating_expenses, debt_service,
        annual_cash_flow, appreciation, equity_buildup, total_return, total_roi,
        is_investment_property,
        verdict_check, notes, tags, matched_listing
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24,
                $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37,
                $38, $39, $40, $41, $42)
       RETURNING id, created_at`,
      [
        userId,
        listingId,
        address,
        propertyType,
        city,
        province,
        postalCode,
        bedrooms,
        bathrooms,
        sqft,
        metrics.listPrice,
        inputs.downPayment,
        inputs.downPaymentPct,
        inputs.mortgageRate,
        inputs.amortizationYears,
        inputs.monthlyRent,
        inputs.annualVacancy,
        inputs.annualAppreciation,
        inputs.closingCosts,
        inputs.renovationCosts,
        inputs.propertyTaxes,
        inputs.propertyInsurance,
        inputs.maintenancePct,
        inputs.managementPct,
        metrics.capRate,
        metrics.cashFlow,
        metrics.cashOnCash,
        metrics.monthlyMortgage,
        metrics.grossIncome,
        metrics.netIncome,
        metrics.totalOperatingExpenses,
        metrics.debtService,
        metrics.annualCashFlow,
        metrics.appreciation,
        metrics.equityBuildup,
        metrics.totalReturn,
        metrics.totalROI,
        metrics.isInvestmentProperty,
        verdictCheck,
        notes,
        tags ? JSON.stringify(tags) : null,
        matchedListing || false,
      ]
    );

    res.status(201).json({
      success: true,
      analysisId: result.rows[0].id,
      createdAt: result.rows[0].created_at,
    });
  } catch (err) {
    console.error('[analyses] POST error:', err);
    res.status(500).json({ error: 'Failed to save analysis' });
  }
});

// List user's analyses (latest first)
router.get('/', async (req: Request, res: Response) => {
  const userId = (req as UserRequest).userId;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
  const offset = parseInt(req.query.offset as string) || 0;
  const city = req.query.city as string | undefined;

  try {
    let sql = `SELECT id, address, city, province, property_type, bedrooms, bathrooms, sqft,
                      list_price, cap_rate, cash_flow, cash_on_cash, verdict_check,
                      created_at, matched_listing
               FROM deal_analyses
               WHERE user_id = $1`;
    const params: unknown[] = [userId];
    let paramCount = 1;

    if (city) {
      paramCount++;
      sql += ` AND city ILIKE $${paramCount}`;
      params.push(`%${city}%`);
    }

    paramCount++;
    sql += ` ORDER BY created_at DESC LIMIT $${paramCount}`;
    params.push(limit);

    paramCount++;
    sql += ` OFFSET $${paramCount}`;
    params.push(offset);

    const result = await db.query(sql, params);

    let countSql = 'SELECT COUNT(*) FROM deal_analyses WHERE user_id = $1';
    const countParams: unknown[] = [userId];
    if (city) {
      countSql += ' AND city ILIKE $2';
      countParams.push(`%${city}%`);
    }
    const countResult = await db.query(countSql, countParams);

    res.json({
      analyses: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit,
      offset,
    });
  } catch (err: unknown) {
    console.error('[analyses] GET error:', err);
    res.status(500).json({ error: 'Failed to retrieve analyses' });
  }
});

// Get a single analysis by ID
router.get('/:id', async (req: Request, res: Response) => {
  const userId = (req as UserRequest).userId;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  try {
    const result = await db.query(
      `SELECT * FROM deal_analyses WHERE id = $1 AND user_id = $2`,
      [req.params.id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    const analysis = result.rows[0];
    if (typeof analysis.tags === 'string') {
      try { analysis.tags = JSON.parse(analysis.tags); } catch { analysis.tags = []; }
    }

    res.json({ analysis });
  } catch (err) {
    console.error('[analyses] GET/:id error:', err);
    res.status(500).json({ error: 'Failed to retrieve analysis' });
  }
});

// Delete an analysis
router.delete('/:id', async (req: Request, res: Response) => {
  const userId = (req as UserRequest).userId;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  try {
    const result = await db.query(
      'DELETE FROM deal_analyses WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    res.json({ success: true, deleted: result.rows[0].id });
  } catch (err) {
    console.error('[analyses] DELETE error:', err);
    res.status(500).json({ error: 'Failed to delete analysis' });
  }
});

export default router;
