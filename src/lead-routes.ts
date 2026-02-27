/**
 * Lead capture routes for realtor partnership inquiries
 * Integrates with GoHighLevel CRM
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import axios from 'axios';
import { db } from './db';

export interface LeadSubmission {
  full_name: string;
  email: string;
  phone?: string;
  company?: string;
  role?: string;
  inquiry_type: 'partnership' | 'advertising' | 'sponsorship' | 'other';
  message?: string;
  source?: string;
}

// GoHighLevel API configuration
const GHL_API_BASE = process.env.GHL_API_BASE || 'https://rest.gohighlevel.com/v1';
const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

export function createLeadRouter(): Router {
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

  // ==================== SUBMIT LEAD ====================
  router.post(
    '/submit',
    [
      body('full_name').trim().notEmpty(),
      body('email').isEmail().normalizeEmail(),
      body('phone').optional().trim(),
      body('company').optional().trim(),
      body('role').optional().trim(),
      body('inquiry_type').isIn(['partnership', 'advertising', 'sponsorship', 'other']),
      body('message').optional().trim(),
      body('source').optional().trim(),
    ],
    async (req: Request, res: Response) => {
      if (!validate(req, res)) return;

      const lead: LeadSubmission = req.body;

      try {
        // Store in database
        const result = await db.query(
          `INSERT INTO lead_submissions (
            full_name, email, phone, company, role,
            inquiry_type, message, source, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *`,
          [
            lead.full_name,
            lead.email,
            lead.phone || null,
            lead.company || null,
            lead.role || null,
            lead.inquiry_type,
            lead.message || null,
            lead.source || 'website',
            'new',
          ]
        );

        const savedLead = result.rows[0];
        if (!savedLead) {
          throw new Error('Failed to save lead');
        }

        // Sync to GoHighLevel CRM if API key is configured
        let ghlContactId = null;
        let ghlOpportunityId = null;
        let crmError = null;

        if (GHL_API_KEY && GHL_LOCATION_ID) {
          try {
            // Create or update contact in GoHighLevel
            const contactResponse = await axios.post(
              `${GHL_API_BASE}/contacts/`,
              {
                locationId: GHL_LOCATION_ID,
                name: lead.full_name,
                email: lead.email,
                phone: lead.phone,
                companyName: lead.company,
                tags: ['realist.ca', 'realtor-partnership', lead.inquiry_type],
                customFields: [
                  { id: 'role', value: lead.role || '' },
                  { id: 'source', value: lead.source || 'website' },
                  { id: 'inquiry_type', value: lead.inquiry_type },
                ],
                source: 'Website Form',
              },
              {
                headers: {
                  'Authorization': `Bearer ${GHL_API_KEY}`,
                  'Content-Type': 'application/json',
                },
              }
            );

            ghlContactId = contactResponse.data?.contact?.id;

            // Create opportunity (pipeline deal) for partnership inquiries
            if (lead.inquiry_type === 'partnership' && ghlContactId) {
              const opportunityResponse = await axios.post(
                `${GHL_API_BASE}/opportunities/`,
                {
                  locationId: GHL_LOCATION_ID,
                  contactId: ghlContactId,
                  name: `Realist.ca Partnership - ${lead.full_name}`,
                  pipelineId: process.env.GHL_PIPELINE_ID || 'default',
                  stageId: process.env.GHL_STAGE_ID || 'new',
                  status: 'open',
                  monetaryValue: 0,
                  assignedTo: process.env.GHL_DEFAULT_USER_ID || '',
                },
                {
                  headers: {
                    'Authorization': `Bearer ${GHL_API_KEY}`,
                    'Content-Type': 'application/json',
                  },
                }
              );

              ghlOpportunityId = opportunityResponse.data?.opportunity?.id;
            }

            // Update lead record with CRM IDs
            await db.query(
              `UPDATE lead_submissions 
               SET ghl_contact_id = $1, ghl_opportunity_id = $2, crm_synced_at = CURRENT_TIMESTAMP
               WHERE id = $3`,
              [ghlContactId, ghlOpportunityId, savedLead.id]
            );

          } catch (ghlError: any) {
            console.error('GoHighLevel sync error:', ghlError.response?.data || ghlError.message);
            crmError = ghlError.message;
            // Don't fail the request - we still stored the lead locally
          }
        }

        // Prepare response
        const response: any = {
          success: true,
          data: {
            lead: {
              id: savedLead.id,
              full_name: savedLead.full_name,
              email: savedLead.email,
              status: savedLead.status,
              created_at: savedLead.created_at,
            },
            crm_synced: !!ghlContactId,
            crm_contact_id: ghlContactId,
            crm_opportunity_id: ghlOpportunityId,
          },
        };

        if (crmError) {
          response.crm_error = crmError;
          response.message = 'Lead saved locally but CRM sync failed';
        } else if (ghlContactId) {
          response.message = 'Lead saved and synced to CRM';
        } else {
          response.message = 'Lead saved locally (CRM not configured)';
        }

        res.status(201).json(response);

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ success: false, error: message });
      }
    }
  );

  // ==================== GET LEADS (ADMIN) ====================
  // Protected route - requires authentication and admin role (simplified)
  router.get('/leads', async (req: Request, res: Response) => {
    // Simple API key authentication for admin access
    const apiKey = req.headers['x-admin-key'] as string;
    const expectedApiKey = process.env.ADMIN_API_KEY;

    if (expectedApiKey && apiKey !== expectedApiKey) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    try {
      const { status, limit = 50, offset = 0 } = req.query;
      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramCount = 1;

      if (status) {
        conditions.push(`status = $${paramCount}`);
        params.push(status);
        paramCount += 1;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const query = `
        SELECT * FROM lead_submissions
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramCount} OFFSET $${paramCount + 1}
      `;

      const result = await db.query(query, [...params, Number(limit), Number(offset)]);
      const countResult = await db.query(
        `SELECT COUNT(*) as total FROM lead_submissions ${whereClause}`,
        params
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
  });

  // ==================== UPDATE LEAD STATUS (ADMIN) ====================
  router.patch(
    '/leads/:id/status',
    [
      body('status').isIn(['new', 'contacted', 'qualified', 'closed', 'lost']),
      body('notes').optional().trim(),
    ],
    async (req: Request, res: Response) => {
      // Admin authentication
      const apiKey = req.headers['x-admin-key'] as string;
      const expectedApiKey = process.env.ADMIN_API_KEY;

      if (expectedApiKey && apiKey !== expectedApiKey) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      if (!validate(req, res)) return;

      const { id } = req.params;
      const { status, notes, assigned_to, follow_up_date } = req.body;

      try {
        const updates: string[] = [];
        const params: unknown[] = [];
        let paramCount = 1;

        updates.push(`status = $${paramCount++}`);
        params.push(status);

        if (notes !== undefined) {
          updates.push(`message = COALESCE(message, '') || $${paramCount++}`);
          params.push(`\n\nAdmin note: ${notes}`);
        }

        if (assigned_to !== undefined) {
          updates.push(`assigned_to = $${paramCount++}`);
          params.push(assigned_to);
        }

        if (follow_up_date !== undefined) {
          updates.push(`follow_up_date = $${paramCount++}`);
          params.push(follow_up_date);
        }

        params.push(id);
        const result = await db.query(
          `UPDATE lead_submissions 
           SET ${updates.join(', ')} 
           WHERE id = $${paramCount} 
           RETURNING *`,
          params
        );

        if (!result.rows[0]) {
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

  // ==================== RESYNC TO CRM (ADMIN) ====================
  router.post('/leads/:id/resync-crm', async (req: Request, res: Response) => {
    // Admin authentication
    const apiKey = req.headers['x-admin-key'] as string;
    const expectedApiKey = process.env.ADMIN_API_KEY;

    if (expectedApiKey && apiKey !== expectedApiKey) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    try {
      const leadResult = await db.query('SELECT * FROM lead_submissions WHERE id = $1', [id]);
      if (!leadResult.rows[0]) {
        res.status(404).json({ success: false, error: 'Lead not found' });
        return;
      }

      const lead = leadResult.rows[0];
      let ghlContactId = lead.ghl_contact_id;
      let ghlOpportunityId = lead.ghl_opportunity_id;
      let error = null;

      if (GHL_API_KEY && GHL_LOCATION_ID) {
        try {
          // Update existing contact or create new
          if (ghlContactId) {
            await axios.put(
              `${GHL_API_BASE}/contacts/${ghlContactId}`,
              {
                locationId: GHL_LOCATION_ID,
                name: lead.full_name,
                email: lead.email,
                phone: lead.phone,
                companyName: lead.company,
                tags: ['realist.ca', 'realtor-partnership', lead.inquiry_type, 'resynced'],
              },
              {
                headers: {
                  'Authorization': `Bearer ${GHL_API_KEY}`,
                  'Content-Type': 'application/json',
                },
              }
            );
          } else {
            const contactResponse = await axios.post(
              `${GHL_API_BASE}/contacts/`,
              {
                locationId: GHL_LOCATION_ID,
                name: lead.full_name,
                email: lead.email,
                phone: lead.phone,
                companyName: lead.company,
                tags: ['realist.ca', 'realtor-partnership', lead.inquiry_type],
              },
              {
                headers: {
                  'Authorization': `Bearer ${GHL_API_KEY}`,
                  'Content-Type': 'application/json',
                },
              }
            );
            ghlContactId = contactResponse.data?.contact?.id;
          }

          // Update opportunity if needed
          if (lead.inquiry_type === 'partnership' && ghlContactId && !ghlOpportunityId) {
            const opportunityResponse = await axios.post(
              `${GHL_API_BASE}/opportunities/`,
              {
                locationId: GHL_LOCATION_ID,
                contactId: ghlContactId,
                name: `Realist.ca Partnership - ${lead.full_name}`,
                pipelineId: process.env.GHL_PIPELINE_ID || 'default',
                stageId: process.env.GHL_STAGE_ID || 'new',
                status: 'open',
              },
              {
                headers: {
                  'Authorization': `Bearer ${GHL_API_KEY}`,
                  'Content-Type': 'application/json',
                },
              }
            );
            ghlOpportunityId = opportunityResponse.data?.opportunity?.id;
          }

          await db.query(
            `UPDATE lead_submissions 
             SET ghl_contact_id = $1, ghl_opportunity_id = $2, crm_synced_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [ghlContactId, ghlOpportunityId, id]
          );

        } catch (ghlError: any) {
          console.error('GoHighLevel resync error:', ghlError.response?.data || ghlError.message);
          error = ghlError.message;
        }
      } else {
        error = 'GoHighLevel API not configured';
      }

      const response: any = {
        success: !error,
        data: {
          crm_contact_id: ghlContactId,
          crm_opportunity_id: ghlOpportunityId,
          crm_synced_at: new Date(),
        },
      };

      if (error) {
        response.error = error;
        response.message = 'CRM sync failed';
      } else {
        response.message = 'Lead resynced to CRM';
      }

      res.json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: message });
    }
  });

  return router;
}

const leadRouter = createLeadRouter();
export default leadRouter;