/**
 * Partner signup API routes (realtors & lenders)
 */

import { Router, Request, Response } from 'express';
import { db } from './db';

const partnerRouter = Router();

// Validation helpers
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[\d\s\-+()]{10,}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

// POST /api/realtors/join - Realtor signup
partnerRouter.post('/realtors/join', async (req: Request, res: Response) => {
  try {
    const {
      name,
      email,
      phone,
      brokerage,
      markets_served,
      asset_types,
      deal_types,
      avg_deal_size,
      referral_agreement
    } = req.body;

    // Validation
    const errors: string[] = [];

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      errors.push('Name is required (min 2 characters)');
    }

    if (!email || !isValidEmail(email)) {
      errors.push('Valid email is required');
    }

    if (!phone || !isValidPhone(phone)) {
      errors.push('Valid phone number is required');
    }

    if (!brokerage || typeof brokerage !== 'string' || brokerage.trim().length < 2) {
      errors.push('Brokerage name is required');
    }

    if (!markets_served || !Array.isArray(markets_served) || markets_served.length === 0) {
      errors.push('At least one market is required');
    }

    if (!asset_types || !Array.isArray(asset_types) || asset_types.length === 0) {
      errors.push('At least one asset type is required');
    }

    if (!deal_types || !Array.isArray(deal_types) || deal_types.length === 0) {
      errors.push('At least one deal type is required');
    }

    if (referral_agreement !== true) {
      errors.push('Referral agreement must be accepted');
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    // Check if email already exists
    const existingRealtor = await db.query(
      'SELECT id FROM realtors WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (existingRealtor.rows.length > 0) {
      return res.status(409).json({ 
        success: false, 
        error: 'An account with this email already exists' 
      });
    }

    // Insert the realtor
    const result = await db.query(
      `INSERT INTO realtors (name, email, phone, brokerage, markets_served, asset_types, deal_types, avg_deal_size, referral_agreement)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name, email, created_at`,
      [
        name.trim(),
        email.toLowerCase().trim(),
        phone.trim(),
        brokerage.trim(),
        JSON.stringify(markets_served),
        JSON.stringify(asset_types),
        JSON.stringify(deal_types),
        avg_deal_size || null,
        true
      ]
    );

    const realtor = result.rows[0];

    res.status(201).json({
      success: true,
      message: 'Realtor signup successful',
      data: {
        id: realtor.id,
        name: realtor.name,
        email: realtor.email,
        created_at: realtor.created_at
      }
    });

  } catch (error) {
    console.error('Realtor join error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'An error occurred during signup. Please try again.' 
    });
  }
});

// POST /api/lenders/join - Lender signup
partnerRouter.post('/lenders/join', async (req: Request, res: Response) => {
  try {
    const {
      contact_name,
      company_name,
      email,
      phone,
      lending_types,
      target_markets,
      loan_size_min,
      loan_size_max,
      preferred_dscr_min,
      preferred_ltv_max,
      turnaround_time,
      referral_agreement
    } = req.body;

    // Validation
    const errors: string[] = [];

    if (!contact_name || typeof contact_name !== 'string' || contact_name.trim().length < 2) {
      errors.push('Contact name is required (min 2 characters)');
    }

    if (!company_name || typeof company_name !== 'string' || company_name.trim().length < 2) {
      errors.push('Company name is required');
    }

    if (!email || !isValidEmail(email)) {
      errors.push('Valid email is required');
    }

    if (!phone || !isValidPhone(phone)) {
      errors.push('Valid phone number is required');
    }

    if (!lending_types || !Array.isArray(lending_types) || lending_types.length === 0) {
      errors.push('At least one lending type is required');
    }

    if (!target_markets || !Array.isArray(target_markets) || target_markets.length === 0) {
      errors.push('At least one target market is required');
    }

    if (typeof loan_size_min !== 'number' || loan_size_min < 0) {
      errors.push('Minimum loan size is required');
    }

    if (typeof loan_size_max !== 'number' || loan_size_max < loan_size_min) {
      errors.push('Maximum loan size must be greater than minimum');
    }

    if (!turnaround_time || typeof turnaround_time !== 'string') {
      errors.push('Turnaround time is required');
    }

    if (referral_agreement !== true) {
      errors.push('Referral agreement must be accepted');
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    // Check if email already exists
    const existingLender = await db.query(
      'SELECT id FROM lenders WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (existingLender.rows.length > 0) {
      return res.status(409).json({ 
        success: false, 
        error: 'An account with this email already exists' 
      });
    }

    // Insert the lender
    const result = await db.query(
      `INSERT INTO lenders (contact_name, company_name, email, phone, lending_types, target_markets, loan_size_min, loan_size_max, preferred_dscr_min, preferred_ltv_max, turnaround_time, referral_agreement)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, contact_name, company_name, email, created_at`,
      [
        contact_name.trim(),
        company_name.trim(),
        email.toLowerCase().trim(),
        phone.trim(),
        JSON.stringify(lending_types),
        JSON.stringify(target_markets),
        loan_size_min,
        loan_size_max,
        preferred_dscr_min || null,
        preferred_ltv_max || null,
        turnaround_time,
        true
      ]
    );

    const lender = result.rows[0];

    res.status(201).json({
      success: true,
      message: 'Lender signup successful',
      data: {
        id: lender.id,
        contact_name: lender.contact_name,
        company_name: lender.company_name,
        email: lender.email,
        created_at: lender.created_at
      }
    });

  } catch (error) {
    console.error('Lender join error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'An error occurred during signup. Please try again.' 
    });
  }
});

// GET /api/realtors - List all realtors (admin)
partnerRouter.get('/realtors', async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT id, name, email, phone, brokerage, markets_served, asset_types, deal_types, avg_deal_size, status, created_at, updated_at
       FROM realtors
       ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Get realtors error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch realtors' 
    });
  }
});

// GET /api/lenders - List all lenders (admin)
partnerRouter.get('/lenders', async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT id, contact_name, company_name, email, phone, lending_types, target_markets, loan_size_min, loan_size_max, preferred_dscr_min, preferred_ltv_max, turnaround_time, status, created_at, updated_at
       FROM lenders
       ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Get lenders error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch lenders' 
    });
  }
});

export default partnerRouter;