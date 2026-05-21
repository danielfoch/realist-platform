/**
 * Realtor Portal API Routes
 * Handles realtor registration, market claims, and dashboard
 */

import { Router, Request, Response } from 'express';
import { body, validationResult, query } from 'express-validator';
import { db } from './db';
import { generateToken, authenticateToken, AuthRequest } from './auth-middleware';
import crypto from 'crypto';

export function createRealtorRouter(): Router {
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

  // ==================== REALTOR REGISTRATION ====================
  router.post(
    '/register',
    [
      body('email').isEmail().normalizeEmail(),
      body('password').isLength({ min: 6 }),
      body('full_name').trim().notEmpty(),
      body('license_number').trim().notEmpty(),
      body('license_province').isLength({ min: 2, max: 2 }),
      body('brokerage_name').trim().notEmpty(),
      body('brokerage_phone').optional().trim(),
      body('agree_to_referral').isBoolean().equals('true'),
    ],
    async (req: Request, res: Response) => {
      if (!validate(req, res)) return;

      const { 
        email, 
        password, 
        full_name, 
        license_number, 
        license_province, 
        brokerage_name, 
        brokerage_phone,
        agree_to_referral 
      } = req.body;

      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

      try {
        // Check if user already exists
        const existingUser = await db.query(
          'SELECT id, email FROM users WHERE email = $1',
          [email]
        );

        let userId: number;
        
        if (existingUser.rows.length > 0) {
          // Check if already a realtor
          const existingRealtor = await db.query(
            'SELECT id FROM realtor_users WHERE user_id = $1',
            [existingUser.rows[0].id]
          );
          
          if (existingRealtor.rows.length > 0) {
            res.status(409).json({ success: false, error: 'Email already registered as realtor' });
            return;
          }
          
          userId = existingUser.rows[0].id;
        } else {
          // Create new user
          // Note: In production, hash the password properly
          const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
          
          const newUser = await db.query(
            `INSERT INTO users (email, password_hash, full_name, tier, agree_to_terms, created_at, updated_at)
             VALUES ($1, $2, $3, 'free', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             RETURNING id`,
            [email, hashedPassword, full_name]
          );
          
          userId = newUser.rows[0].id;
        }

        // Check if license number already exists
        const existingLicense = await db.query(
          'SELECT id FROM realtor_users WHERE license_number = $1',
          [license_number]
        );

        if (existingLicense.rows.length > 0) {
          res.status(409).json({ success: false, error: 'License number already registered' });
          return;
        }

        // Create realtor record
        const realtor = await db.query(
          `INSERT INTO realtor_users (
            user_id, license_number, license_province, brokerage_name, brokerage_phone,
            agreed_to_referral_fee, referral_fee_percentage, agreement_signed_at, agreement_ip,
            verified, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, 25.00, CURRENT_TIMESTAMP, $7, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING *`,
          [userId, license_number, license_province, brokerage_name, brokerage_phone || null, agree_to_referral, clientIp]
        );

        const token = generateToken({
          id: userId,
          email,
          tier: 'free',
          subscription_status: 'active',
        });

        res.status(201).json({
          success: true,
          data: {
            realtor: {
              id: realtor.rows[0].id,
              license_number: realtor.rows[0].license_number,
              license_province: realtor.rows[0].license_province,
              brokerage_name: realtor.rows[0].brokerage_name,
              agreed_to_referral_fee: realtor.rows[0].agreed_to_referral_fee,
              referral_fee_percentage: realtor.rows[0].referral_fee_percentage,
              leads_received: 0,
              leads_claimed: 0,
              referral_earnings: 0,
            },
            token,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ success: false, error: message });
      }
    }
  );

  // ==================== REALTOR LOGIN ====================
  router.post(
    '/login',
    [
      body('email').isEmail().normalizeEmail(),
      body('password').notEmpty(),
    ],
    async (req: Request, res: Response) => {
      if (!validate(req, res)) return;

      const { email, password } = req.body;

      try {
        // Find user
        const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
        
        const userResult = await db.query(
          `SELECT u.id, u.email, u.full_name, u.tier, u.subscription_status,
                  r.id as realtor_id, r.license_number, r.brokerage_name,
                  r.leads_received, r.leads_claimed, r.referral_earnings,
                  r.agreed_to_referral_fee, r.referral_fee_percentage
           FROM users u
           JOIN realtor_users r ON r.user_id = u.id
           WHERE u.email = $1 AND u.password_hash = $2`,
          [email, hashedPassword]
        );

        if (userResult.rows.length === 0) {
          res.status(401).json({ success: false, error: 'Invalid credentials' });
          return;
        }

        const user = userResult.rows[0];

        // Update last login
        await db.query(
          'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
          [user.id]
        );

        const token = generateToken({
          id: user.id,
          email: user.email,
          tier: user.tier,
          subscription_status: user.subscription_status,
        });

        res.json({
          success: true,
          data: {
            realtor: {
              id: user.realtor_id,
              email: user.email,
              full_name: user.full_name,
              license_number: user.license_number,
              brokerage_name: user.brokerage_name,
              leads_received: user.leads_received,
              leads_claimed: user.leads_claimed,
              referral_earnings: user.referral_earnings,
              agreed_to_referral_fee: user.agreed_to_referral_fee,
              referral_fee_percentage: user.referral_fee_percentage,
            },
            token,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ success: false, error: message });
      }
    }
  );

  // ==================== GET REALTOR PROFILE ====================
  router.get(
    '/profile',
    authenticateToken,
    async (req: AuthRequest, res: Response) => {
      try {
        const result = await db.query(
          `SELECT r.*, u.email, u.full_name
           FROM realtor_users r
           JOIN users u ON u.id = r.user_id
           WHERE r.user_id = $1`,
          [req.user!.id]
        );

        if (result.rows.length === 0) {
          res.status(404).json({ success: false, error: 'Realtor not found' });
          return;
        }

        const realtor = result.rows[0];

        res.json({
          success: true,
          data: {
            id: realtor.id,
            email: realtor.email,
            full_name: realtor.full_name,
            license_number: realtor.license_number,
            license_province: realtor.license_province,
            brokerage_name: realtor.brokerage_name,
            brokerage_phone: realtor.brokerage_phone,
            leads_received: realtor.leads_received,
            leads_claimed: realtor.leads_claimed,
            referral_earnings: realtor.referral_earnings,
            agreed_to_referral_fee: realtor.agreed_to_referral_fee,
            referral_fee_percentage: realtor.referral_fee_percentage,
            verified: realtor.verified,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ success: false, error: message });
      }
    }
  );

  // ==================== UPDATE REALTOR PROFILE ====================
  router.patch(
    '/profile',
    authenticateToken,
    [
      body('brokerage_phone').optional().trim(),
      body('email_notifications').optional().isBoolean(),
      body('phone_notifications').optional().isBoolean(),
    ],
    async (req: AuthRequest, res: Response) => {
      if (!validate(req, res)) return;

      const { brokerage_phone, email_notifications, phone_notifications } = req.body;

      try {
        const updates: string[] = [];
        const params: unknown[] = [];
        let paramCount = 1;

        if (brokerage_phone !== undefined) {
          updates.push(`brokerage_phone = $${paramCount++}`);
          params.push(brokerage_phone);
        }

        if (email_notifications !== undefined) {
          updates.push(`email_notifications = $${paramCount++}`);
          params.push(email_notifications);
        }

        if (phone_notifications !== undefined) {
          updates.push(`phone_notifications = $${paramCount++}`);
          params.push(phone_notifications);
        }

        if (updates.length === 0) {
          res.status(400).json({ success: false, error: 'No fields to update' });
          return;
        }

        params.push(req.user!.id);

        const result = await db.query(
          `UPDATE realtor_users 
           SET ${updates.join(', ')}
           WHERE user_id = $${paramCount}
           RETURNING *`,
          params
        );

        if (result.rows.length === 0) {
          res.status(404).json({ success: false, error: 'Realtor not found' });
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

  // ==================== CLAIM MARKET ====================
  router.post(
    '/markets/claim',
    authenticateToken,
    [
      body('market_type').isIn(['postal_code', 'city', 'province']),
      body('market_value').trim().notEmpty(),
    ],
    async (req: AuthRequest, res: Response) => {
      if (!validate(req, res)) return;

      const { market_type, market_value } = req.body;

      try {
        // Get realtor ID
        const realtorResult = await db.query(
          'SELECT id FROM realtor_users WHERE user_id = $1',
          [req.user!.id]
        );

        if (realtorResult.rows.length === 0) {
          res.status(404).json({ success: false, error: 'Realtor profile not found' });
          return;
        }

        const realtorId = realtorResult.rows[0].id;

        // Check if already claimed
        const existing = await db.query(
          'SELECT id FROM market_claims WHERE realtor_id = $1 AND market_type = $2 AND market_value = $3',
          [realtorId, market_type, market_value]
        );

        if (existing.rows.length > 0) {
          res.status(409).json({ success: false, error: 'Market already claimed' });
          return;
        }

        // Create claim
        const result = await db.query(
          `INSERT INTO market_claims (realtor_id, market_type, market_value, status, created_at, updated_at)
           VALUES ($1, $2, $3, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING *`,
          [realtorId, market_type, market_value]
        );

        res.status(201).json({
          success: true,
          data: result.rows[0],
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ success: false, error: message });
      }
    }
  );

  // ==================== GET CLAIMED MARKETS ====================
  router.get(
    '/markets',
    authenticateToken,
    async (req: AuthRequest, res: Response) => {
      try {
        const result = await db.query(
          `SELECT mc.*, 
                  COALESCE(
                    (SELECT COUNT(*) FROM lead_notifications ln 
                     JOIN investor_leads il ON il.id = ln.lead_id 
                     WHERE ln.realtor_id = mc.realtor_id 
                     AND il.status IN ('distributed', 'claimed', 'contacted')), 0
                  ) as leads_count
           FROM market_claims mc
           JOIN realtor_users r ON r.id = mc.realtor_id
           WHERE r.user_id = $1
           ORDER BY mc.created_at DESC`,
          [req.user!.id]
        );

        res.json({
          success: true,
          data: result.rows,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ success: false, error: message });
      }
    }
  );

  // ==================== REMOVE MARKET CLAIM ====================
  router.delete(
    '/markets/:id',
    authenticateToken,
    async (req: AuthRequest, res: Response) => {
      try {
        const { id } = req.params;

        const result = await db.query(
          `DELETE FROM market_claims 
           WHERE id = $1 AND realtor_id = (SELECT id FROM realtor_users WHERE user_id = $2)
           RETURNING *`,
          [id, req.user!.id]
        );

        if (result.rows.length === 0) {
          res.status(404).json({ success: false, error: 'Market claim not found' });
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

  // ==================== GET DASHBOARD STATS ====================
  router.get(
    '/dashboard',
    authenticateToken,
    async (req: AuthRequest, res: Response) => {
      try {
        const realtorResult = await db.query(
          'SELECT id, leads_received, leads_claimed, referral_earnings FROM realtor_users WHERE user_id = $1',
          [req.user!.id]
        );

        if (realtorResult.rows.length === 0) {
          res.status(404).json({ success: false, error: 'Realtor not found' });
          return;
        }

        const realtorId = realtorResult.rows[0].id;

        // Get recent leads
        const recentLeads = await db.query(
          `SELECT il.*, ln.claimed, ln.claimed_at
           FROM lead_notifications ln
           JOIN investor_leads il ON il.id = ln.lead_id
           WHERE ln.realtor_id = $1
           ORDER BY ln.notified_at DESC
           LIMIT 10`,
          [realtorId]
        );

        // Get market stats
        const marketStats = await db.query(
          `SELECT mc.market_type, mc.market_value, COUNT(ln.id) as lead_count
           FROM market_claims mc
           LEFT JOIN lead_notifications ln ON ln.realtor_id = mc.realtor_id
           WHERE mc.realtor_id = $1
           GROUP BY mc.id
           ORDER BY lead_count DESC`,
          [realtorId]
        );

        // Get earnings history
        const earningsHistory = await db.query(
          `SELECT * FROM referral_earnings 
           WHERE realtor_id = $1 
           ORDER BY created_at DESC 
           LIMIT 10`,
          [realtorId]
        );

        res.json({
          success: true,
          data: {
            stats: {
              leads_received: realtorResult.rows[0].leads_received,
              leads_claimed: realtorResult.rows[0].leads_claimed,
              referral_earnings: realtorResult.rows[0].referral_earnings,
            },
            recent_leads: recentLeads.rows,
            market_stats: marketStats.rows,
            earnings_history: earningsHistory.rows,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ success: false, error: message });
      }
    }
  );

  // ==================== GET AVAILABLE LEADS ====================
  router.get(
    '/leads/available',
    authenticateToken,
    async (req: AuthRequest, res: Response) => {
      try {
        const realtorResult = await db.query(
          'SELECT id FROM realtor_users WHERE user_id = $1',
          [req.user!.id]
        );

        if (realtorResult.rows.length === 0) {
          res.status(404).json({ success: false, error: 'Realtor not found' });
          return;
        }

        const realtorId = realtorResult.rows[0].id;

        // Get leads that have been notified to this realtor but not claimed
        const result = await db.query(
          `SELECT il.*, ln.notified_at
           FROM lead_notifications ln
           JOIN investor_leads il ON il.id = ln.lead_id
           WHERE ln.realtor_id = $1 AND ln.claimed = false AND il.status IN ('distributed', 'claimed')
           ORDER BY ln.notified_at DESC`,
          [realtorId]
        );

        res.json({
          success: true,
          data: result.rows,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ success: false, error: message });
      }
    }
  );

  // ==================== CLAIM LEAD ====================
  router.post(
    '/leads/:leadId/claim',
    authenticateToken,
    async (req: AuthRequest, res: Response) => {
      try {
        const { leadId } = req.params;

        const realtorResult = await db.query(
          'SELECT id, brokerage_name, full_name FROM realtor_users WHERE user_id = $1',
          [req.user!.id]
        );

        if (realtorResult.rows.length === 0) {
          res.status(404).json({ success: false, error: 'Realtor not found' });
          return;
        }

        const realtorId = realtorResult.rows[0].id;
        const { brokerage_name } = realtorResult.rows[0];

        // Get user info for email
        const userResult = await db.query(
          'SELECT full_name, email FROM users WHERE id = $1',
          [req.user!.id]
        );

        // Update lead notification as claimed
        const notificationResult = await db.query(
          `UPDATE lead_notifications 
           SET claimed = true, claimed_at = CURRENT_TIMESTAMP
           WHERE lead_id = $1 AND realtor_id = $2
           RETURNING *`,
          [leadId, realtorId]
        );

        if (notificationResult.rows.length === 0) {
          res.status(404).json({ success: false, error: 'Lead notification not found' });
          return;
        }

        // Update lead status
        await db.query(
          `UPDATE investor_leads SET status = 'claimed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [leadId]
        );

        // Update realtor stats
        await db.query(
          `UPDATE realtor_users 
           SET leads_claimed = leads_claimed + 1, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $1`,
          [realtorId]
        );

        // Get lead details for email
        const leadResult = await db.query(
          'SELECT * FROM investor_leads WHERE id = $1',
          [leadId]
        );

        const lead = leadResult.rows[0];

        // Log introduction email (in production, actually send the email)
        await db.query(
          `UPDATE lead_notifications 
           SET introduction_email_sent = true, introduction_email_sent_at = CURRENT_TIMESTAMP
           WHERE lead_id = $1 AND realtor_id = $2`,
          [leadId, realtorId]
        );

        // In production, integrate with email service (SendGrid, AWS SES, etc.)
        // For now, just log it in the database
        
        res.json({
          success: true,
          data: {
            message: 'Lead claimed successfully',
            lead: {
              id: lead.id,
              full_name: lead.full_name,
              email: lead.email,
              phone: lead.phone,
              investment_type: lead.investment_type,
              budget_min: lead.budget_min,
              budget_max: lead.budget_max,
              target_cities: lead.target_cities,
              timeline: lead.timeline,
            },
            realtor: {
              id: realtorId,
              brokerage_name,
              contact_email: userResult.rows[0].email,
            },
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ success: false, error: message });
      }
    }
  );

  return router;
}

const realtorRouter = createRealtorRouter();
export default realtorRouter;
