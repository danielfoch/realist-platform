/**
 * Investor Lead Routes
 * Captures leads from investors and distributes to matching realtors
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { db } from './db';

const GHL_API_BASE = process.env.GHL_API_BASE || 'https://rest.gohighlevel.com/v1';
const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

// Simple email sending (in production, use SendGrid/AWS SES)
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  console.log(`[EMAIL] To: ${to}, Subject: ${subject}`);
  // In production, integrate with email service
  return true;
}

export function createInvestorLeadRouter(): Router {
  const router = Router();

  // Helper to validate request
  const validate = (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return false;
    }
    return true;
  };

  // ==================== SUBMIT INVESTOR LEAD ====================
  router.post(
    '/submit',
    [
      body('full_name').trim().notEmpty(),
      body('email').isEmail().normalizeEmail(),
      body('phone').optional().trim(),
      body('investment_type').optional().isIn(['rental', 'flip', 'hold', 'multi-family', 'not-sure']),
      body('budget_min').optional().isNumeric(),
      body('budget_max').optional().isNumeric(),
      body('target_cities').optional().isArray(),
      body('target_provinces').optional().isArray(),
      body('timeline').optional().isIn(['immediate', '3-months', '6-months', 'exploring']),
      body('investment_experience').optional().isIn(['first-time', '1-5-deals', '5+-deals']),
      body('notes').optional().trim(),
    ],
    async (req: Request, res: Response) => {
      if (!validate(req, res)) return;

      const {
        full_name,
        email,
        phone,
        investment_type,
        budget_min,
        budget_max,
        target_cities,
        target_provinces,
        timeline,
        investment_experience,
        notes,
      } = req.body;

      // Extract UTM params from query string (passed from frontend)
      const utm_source = req.query.utm_source as string || 'website';
      const utm_medium = req.query.utm_medium as string || null;
      const utm_campaign = req.query.utm_campaign as string || null;

      try {
        // Create investor lead
        const leadResult = await db.query(
          `INSERT INTO investor_leads (
            full_name, email, phone, investment_type, 
            budget_min, budget_max, target_cities, target_provinces,
            timeline, investment_experience, notes,
            utm_source, utm_medium, utm_campaign,
            status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'new', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING *`,
          [
            full_name,
            email,
            phone || null,
            investment_type || null,
            budget_min ? Number(budget_min) : null,
            budget_max ? Number(budget_max) : null,
            target_cities || null,
            target_provinces || null,
            timeline || null,
            investment_experience || null,
            notes || null,
            utm_source,
            utm_medium,
            utm_campaign,
          ]
        );

        const lead = leadResult.rows[0]!;

        // Find matching realtors
        const matchingRealtors = await findMatchingRealtors(
          target_cities || [],
          target_provinces || []
        );

        // Notify matching realtors
        let notifiedCount = 0;
        for (const realtor of matchingRealtors) {
          await notifyRealtorOfLead(realtor, lead);
          notifiedCount++;
        }

        // Update lead status if we found matches
        if (notifiedCount > 0) {
          await db.query(
            `UPDATE investor_leads SET status = 'distributed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [lead.id]
          );
        }

        // Update realtor stats
        if (notifiedCount > 0) {
          for (const realtor of matchingRealtors) {
            await db.query(
              `UPDATE realtor_users SET leads_received = leads_received + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
              [realtor.id]
            );
          }
        }

        // Sync to GHL if configured (for lead tracking)
        let ghlContactId = null;
        if (GHL_API_KEY && GHL_LOCATION_ID) {
          try {
            const contactResponse = await fetch(`${GHL_API_BASE}/contacts/`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${GHL_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                locationId: GHL_LOCATION_ID,
                name: full_name,
                email: email,
                phone: phone,
                tags: ['realist.ca', 'investor-lead', investment_type || 'unspecified'],
                customFields: [
                  { id: 'investment_type', value: investment_type || '' },
                  { id: 'budget_min', value: budget_min || '' },
                  { id: 'budget_max', value: budget_max || '' },
                  { id: 'target_cities', value: (target_cities || []).join(', ') },
                  { id: 'timeline', value: timeline || '' },
                  { id: 'lead_source', value: 'Realist Investor Match' },
                ],
                source: 'Realist.ca',
              }),
            });
            
            const contactData = await contactResponse.json() as { contact?: { id: string } };
            ghlContactId = contactData?.contact?.id ?? null;
          } catch (ghlError) {
            console.error('GHL sync error:', ghlError);
          }
        }

        res.status(201).json({
          success: true,
          data: {
            lead: {
              id: lead.id,
              full_name: lead.full_name,
              email: lead.email,
              status: notifiedCount > 0 ? 'distributed' : 'new',
            },
            matched_realtors: notifiedCount,
            message: notifiedCount > 0 
              ? `We've notified ${notifiedCount} realtor${notifiedCount > 1 ? 's' : ''} in your target area. They'll reach out soon!`
              : 'Thanks! We\'ll match you with a realtor as soon as one becomes available in your area.',
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ success: false, error: message });
      }
    }
  );

  // ==================== GET LEAD STATUS (for lead to check) ====================
  router.get(
    '/status',
    async (req: Request, res: Response) => {
      const { email } = req.query;

      if (!email) {
        res.status(400).json({ success: false, error: 'Email is required' });
        return;
      }

      try {
        const result = await db.query(
          `SELECT id, full_name, email, status, investment_type, created_at
           FROM investor_leads 
           WHERE email = $1 
           ORDER BY created_at DESC 
           LIMIT 1`,
          [email]
        );

        if (result.rows.length === 0) {
          res.status(404).json({ success: false, error: 'No lead found with this email' });
          return;
        }

        const lead = result.rows[0];

        // Get which realtor claimed (if any)
        let claimedBy = null;
        if (lead.status === 'claimed') {
          const claimResult = await db.query(
            `SELECT r.brokerage_name, u.full_name as realtor_name
             FROM lead_notifications ln
             JOIN realtor_users r ON r.id = ln.realtor_id
             JOIN users u ON u.id = r.user_id
             WHERE ln.lead_id = $1 AND ln.claimed = true`,
            [lead.id]
          );

          if (claimResult.rows.length > 0) {
            claimedBy = claimResult.rows[0];
          }
        }

        res.json({
          success: true,
          data: {
            status: lead.status,
            investment_type: lead.investment_type,
            submitted_at: lead.created_at,
            claimed_by: claimedBy,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ success: false, error: message });
      }
    }
  );

  // ==================== ADMIN: LIST ALL LEADS ====================
  router.get(
    '/leads',
    async (req: Request, res: Response) => {
      // Simple API key authentication for admin access
      const apiKey = req.headers['x-admin-key'] as string;
      const expectedApiKey = process.env.ADMIN_API_KEY;

      if (expectedApiKey && apiKey !== expectedApiKey) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      try {
        const { status, limit = 50, offset = 0 } = req.query;
        
        let query = 'SELECT * FROM investor_leads';
        const params: unknown[] = [];
        
        if (status) {
          query += ' WHERE status = $1';
          params.push(status);
          query += ' ORDER BY created_at DESC LIMIT $2 OFFSET $3';
          params.push(Number(limit), Number(offset));
        } else {
          query += ' ORDER BY created_at DESC LIMIT $1 OFFSET $2';
          params.push(Number(limit), Number(offset));
        }

        const result = await db.query(query, params);
        
        const countResult = await db.query(
          'SELECT COUNT(*) as total FROM investor_leads'
        );

        res.json({
          success: true,
          data: result.rows,
          pagination: {
            total: Number(countResult.rows[0]?.total || 0),
            limit: Number(limit),
            offset: Number(offset),
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ success: false, error: message });
      }
    }
  );

  // ==================== ADMIN: UPDATE LEAD ====================
  router.patch(
    '/leads/:id',
    async (req: Request, res: Response) => {
      const apiKey = req.headers['x-admin-key'] as string;
      const expectedApiKey = process.env.ADMIN_API_KEY;

      if (expectedApiKey && apiKey !== expectedApiKey) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const { status, notes } = req.body;

      try {
        const updates: string[] = [];
        const params: unknown[] = [];
        let paramCount = 1;

        if (status) {
          updates.push(`status = $${paramCount++}`);
          params.push(status);
        }

        if (notes !== undefined) {
          updates.push(`notes = COALESCE(notes, '') || $${paramCount++}`);
          params.push(`\n\nAdmin note: ${notes}`);
        }

        if (updates.length === 0) {
          res.status(400).json({ success: false, error: 'No fields to update' });
          return;
        }

        params.push(id);

        const result = await db.query(
          `UPDATE investor_leads 
           SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $${paramCount}
           RETURNING *`,
          params
        );

        if (result.rows.length === 0) {
          res.status(404).json({ success: false, error: 'Lead not found' });
          return;
        }

        res.json({
          success: true,
          data: result.rows[0],
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ success: false, error: message });
      }
    }
  );

  return router;
}

// ==================== HELPER FUNCTIONS ====================

interface Realtor {
  id: number;
  user_id: number;
  brokerage_name: string;
  email: string;
  email_notifications: boolean;
}

async function findMatchingRealtors(
  targetCities: string[],
  targetProvinces: string[]
): Promise<Realtor[]> {
  if (targetCities.length === 0 && targetProvinces.length === 0) {
    // No specific location - find any active realtors with notifications enabled
    const result = await db.query(
      `SELECT r.id, r.user_id, r.brokerage_name, u.email, r.email_notifications
       FROM realtor_users r
       JOIN users u ON u.id = r.user_id
       WHERE r.email_notifications = true
       LIMIT 10`
    );
    return result.rows as unknown as Realtor[];
  }

  // Find realtors who claimed matching markets
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramCount = 1;

  if (targetCities.length > 0) {
    conditions.push(`(mc.market_type = 'city' AND LOWER(mc.market_value) = ANY($${paramCount++}))`);
    params.push(targetCities.map(c => c.toLowerCase()));
  }

  if (targetProvinces.length > 0) {
    conditions.push(`(mc.market_type = 'province' AND UPPER(mc.market_value) = ANY($${paramCount++}))`);
    params.push(targetProvinces.map(p => p.toUpperCase()));
  }

  // Also match by postal code prefix if we have cities
  if (targetCities.length > 0) {
    for (const city of targetCities) {
      const postalPrefix = getPostalPrefix(city);
      if (postalPrefix) {
        conditions.push(`(mc.market_type = 'postal_code' AND UPPER(mc.market_value) LIKE $${paramCount++})`);
        params.push(`${postalPrefix}%`);
      }
    }
  }

  const query = `
    SELECT DISTINCT r.id, r.user_id, r.brokerage_name, u.email, r.email_notifications
    FROM realtor_users r
    JOIN users u ON u.id = r.user_id
    JOIN market_claims mc ON mc.realtor_id = r.id
    WHERE mc.status = 'active' 
    AND r.email_notifications = true
    AND (${conditions.join(' OR ')})
    LIMIT 10
  `;

  try {
    const result = await db.query(query, params);
    return result.rows as unknown as Realtor[];
  } catch (error) {
    console.error('Error finding matching realtors:', error);
    return [] as unknown as Realtor[];
  }
}

async function notifyRealtorOfLead(realtor: Realtor, lead: any): Promise<void> {
  // Create notification record
  await db.query(
    `INSERT INTO lead_notifications (lead_id, realtor_id, notified_at, notification_method)
     VALUES ($1, $2, CURRENT_TIMESTAMP, 'email')`,
    [lead.id, realtor.id]
  );

  // Send email to realtor
  const subject = `🔥 New Investor Lead: ${lead.full_name} - ${lead.investment_type || 'Investment'}`;
  const html = `
    <h2>New Lead Match!</h2>
    <p>You have a new investor lead in your claimed market area.</p>
    
    <h3>Lead Details:</h3>
    <ul>
      <li><strong>Name:</strong> ${lead.full_name}</li>
      <li><strong>Email:</strong> ${lead.email}</li>
      <li><strong>Phone:</strong> ${lead.phone || 'Not provided'}</li>
      <li><strong>Investment Type:</strong> ${lead.investment_type || 'Not specified'}</li>
      <li><strong>Budget:</strong> $${lead.budget_min?.toLocaleString() || '0'} - $${lead.budget_max?.toLocaleString() || 'No limit'}</li>
      <li><strong>Target Cities:</strong> ${(lead.target_cities || []).join(', ') || 'Any'}</li>
      <li><strong>Timeline:</strong> ${lead.timeline || 'Not specified'}</li>
      <li><strong>Experience:</strong> ${lead.investment_experience || 'Not specified'}</li>
    </ul>
    
    ${lead.notes ? `<p><strong>Notes:</strong> ${lead.notes}</p>` : ''}
    
    <p><a href="${process.env.FRONTEND_URL || 'https://realist.ca'}/realtor/dashboard">Log in to your dashboard</a> to claim this lead!</p>
    
    <hr>
    <p style="color: #666; font-size: 12px;">
      This lead was matched to you based on your claimed market areas. 
      By claiming this lead, you agree to the 25% referral fee agreement.
    </p>
  `;

  await sendEmail(realtor.email, subject, html);
}

function getPostalPrefix(city: string): string | null {
  // Common Canadian city to postal prefix mapping
  const cityPrefixes: Record<string, string> = {
    'toronto': 'M',
    'vancouver': 'V',
    'montreal': 'H',
    'calgary': 'T',
    'ottawa': 'K',
    'edmonton': 'T',
    'winnipeg': 'R',
    'mississauga': 'L',
    'brampton': 'L',
    'hamilton': 'L',
    'london': 'N',
    'kitchener': 'N',
    'windsor': 'N',
    'surrey': 'V',
    'vaughan': 'L',
    'markham': 'L',
    'richmond hill': 'L',
    'oakville': 'L',
    'burlington': 'L',
    'ajax': 'L',
    'pickering': 'L',
    'whitby': 'L',
    'oshawa': 'L',
    'barrie': 'L',
    'kingston': 'K',
    'waterloo': 'N',
    'guelph': 'N',
    'cambridge': 'N',
  };

  const normalizedCity = city.toLowerCase().trim();
  return cityPrefixes[normalizedCity] || null;
}

const investorLeadRouter = createInvestorLeadRouter();
export default investorLeadRouter;
