/**
 * Authentication and user management routes
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import {
  createUser,
  getUserById,
  getUserByEmail,
  verifyPassword,
  updateUser,
  changePassword,
  hasFeatureAccess,
  getUserSubscriptionSummary,
  CreateUserInput,
} from './user-model';
import { generateToken, authenticateToken, AuthRequest } from './auth-middleware';

export function createAuthRouter(): Router {
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

  // ==================== REGISTRATION ====================
  router.post(
    '/register',
    [
      body('email').isEmail().normalizeEmail(),
      body('password').isLength({ min: 6 }),
      body('full_name').optional().trim(),
      body('agree_to_terms').isBoolean().equals('true').withMessage('Must agree to terms'),
    ],
    async (req: Request, res: Response) => {
      if (!validate(req, res)) return;

      const { email, password, full_name, agree_to_terms, receive_marketing_emails } = req.body;

      try {
        // Check if user already exists
        const existingUser = await getUserByEmail(email);
        if (existingUser) {
          res.status(409).json({ success: false, error: 'Email already registered' });
          return;
        }

        const userInput: CreateUserInput = {
          email,
          password,
          full_name,
          agree_to_terms,
          receive_marketing_emails: receive_marketing_emails ?? true,
        };

        const user = await createUser(userInput);
        
        // Generate token
        const token = generateToken({
          id: user.id,
          email: user.email,
          tier: user.tier,
          subscription_status: user.subscription_status,
        });

        // Update last login
        await updateUser(user.id, { last_login_at: new Date() });

        res.status(201).json({
          success: true,
          data: {
            user: {
              id: user.id,
              email: user.email,
              full_name: user.full_name,
              tier: user.tier,
              subscription_status: user.subscription_status,
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

  // ==================== LOGIN ====================
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
        const user = await getUserByEmail(email);
        if (!user) {
          res.status(401).json({ success: false, error: 'Invalid email or password' });
          return;
        }

        const isValid = await verifyPassword(user, password);
        if (!isValid) {
          res.status(401).json({ success: false, error: 'Invalid email or password' });
          return;
        }

        // Update last login
        await updateUser(user.id, { last_login_at: new Date() });

        // Generate token
        const token = generateToken({
          id: user.id,
          email: user.email,
          tier: user.tier,
          subscription_status: user.subscription_status,
        });

        res.json({
          success: true,
          data: {
            user: {
              id: user.id,
              email: user.email,
              full_name: user.full_name,
              tier: user.tier,
              subscription_status: user.subscription_status,
              current_period_end: user.current_period_end,
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

  // ==================== PROFILE ====================
  router.get('/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = await getUserById(req.user!.id);
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }

      // Remove sensitive fields
      const { password_hash, ...userData } = user;

      res.json({
        success: true,
        data: userData,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: message });
    }
  });

  // ==================== UPDATE PROFILE ====================
  router.patch(
    '/profile',
    authenticateToken,
    [
      body('full_name').optional().trim(),
      body('avatar_url').optional().isURL(),
      body('receive_marketing_emails').optional().isBoolean(),
    ],
    async (req: AuthRequest, res: Response) => {
      if (!validate(req, res)) return;

      const updates: any = {};
      if (req.body.full_name !== undefined) updates.full_name = req.body.full_name;
      if (req.body.avatar_url !== undefined) updates.avatar_url = req.body.avatar_url;
      if (req.body.receive_marketing_emails !== undefined) updates.receive_marketing_emails = req.body.receive_marketing_emails;

      if (Object.keys(updates).length === 0) {
        res.status(400).json({ success: false, error: 'No fields to update' });
        return;
      }

      try {
        const updatedUser = await updateUser(req.user!.id, updates);
        if (!updatedUser) {
          res.status(404).json({ success: false, error: 'User not found' });
          return;
        }

        const { password_hash, ...userData } = updatedUser;
        res.json({
          success: true,
          data: userData,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ success: false, error: message });
      }
    }
  );

  // ==================== CHANGE PASSWORD ====================
  router.post(
    '/change-password',
    authenticateToken,
    [
      body('current_password').notEmpty(),
      body('new_password').isLength({ min: 6 }),
    ],
    async (req: AuthRequest, res: Response) => {
      if (!validate(req, res)) return;

      const { current_password, new_password } = req.body;

      try {
        const user = await getUserById(req.user!.id);
        if (!user) {
          res.status(404).json({ success: false, error: 'User not found' });
          return;
        }

        const isValid = await verifyPassword(user, current_password);
        if (!isValid) {
          res.status(401).json({ success: false, error: 'Current password is incorrect' });
          return;
        }

        await changePassword(user.id, new_password);

        res.json({
          success: true,
          message: 'Password updated successfully',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ success: false, error: message });
      }
    }
  );

  // ==================== SUBSCRIPTION SUMMARY ====================
  router.get('/subscription/summary', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const summary = await getUserSubscriptionSummary(req.user!.id);
      if (!summary) {
        res.status(404).json({ success: false, error: 'Subscription summary not found' });
        return;
      }

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: message });
    }
  });

  // ==================== CHECK FEATURE ACCESS ====================
  router.get('/feature-access/:feature', authenticateToken, async (req: AuthRequest, res: Response) => {
    const feature = req.params.feature as string;

    try {
      const hasAccess = await hasFeatureAccess(req.user!.id, feature);
      res.json({
        success: true,
        data: {
          feature,
          has_access: hasAccess,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: message });
    }
  });

  // ==================== TIER UPGRADE CHECKOUT ====================
  // This endpoint returns a Stripe Checkout session URL for upgrading tier
  router.post(
    '/subscription/checkout',
    authenticateToken,
    [
      body('tier').isIn(['premium', 'enterprise']),
      body('success_url').isURL(),
      body('cancel_url').isURL(),
    ],
    async (req: AuthRequest, res: Response) => {
      if (!validate(req, res)) return;

      const { tier, success_url, cancel_url } = req.body;
      const user = req.user!;

      try {
        // Stripe integration will be implemented separately
        // For now, return mock response
        res.json({
          success: true,
          data: {
            session_id: 'mock_stripe_session_id',
            url: `https://checkout.stripe.com/mock?tier=${tier}&user=${user.id}`,
            tier,
            price: tier === 'premium' ? 2900 : 0, // in cents, enterprise custom pricing
            message: 'Stripe integration pending',
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ success: false, error: message });
      }
    }
  );

  // ==================== CANCEL SUBSCRIPTION ====================
  router.post('/subscription/cancel', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      // In a real implementation, this would call Stripe API
      // For now, update user status to canceled
      const updatedUser = await updateUser(req.user!.id, {
        subscription_status: 'canceled',
        canceled_at: new Date(),
        cancel_at_period_end: false,
      });

      if (!updatedUser) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }

      res.json({
        success: true,
        message: 'Subscription canceled',
        data: {
          tier: updatedUser.tier,
          subscription_status: updatedUser.subscription_status,
          canceled_at: updatedUser.canceled_at,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: message });
    }
  });

  // ==================== WEBHOOK ENDPOINT (for Stripe) ====================
  // This endpoint is called by Stripe and does not require authentication
  router.post('/webhook/stripe', async (req: Request, res: Response) => {
    // Stripe webhook handling will be implemented separately
    // For now, log the event
    console.log('Stripe webhook received:', req.body?.type);
    
    // Always respond quickly to Stripe
    res.json({ received: true });
  });

  return router;
}

const authRouter = createAuthRouter();
export default authRouter;