/**
 * Authentication middleware for JWT token verification
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getUserById } from './user-model';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    tier: string;
    subscription_status: string;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

/**
 * Generate JWT token for a user
 */
export function generateToken(user: { id: number; email: string; tier: string; subscription_status: string }): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      tier: user.tier,
      subscription_status: user.subscription_status,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY as jwt.SignOptions['expiresIn'] }
  );
}

/**
 * Verify JWT token and attach user to request
 */
export async function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ success: false, error: 'Authentication token required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: number;
      email: string;
      tier: string;
      subscription_status: string;
      iat: number;
      exp: number;
    };
    
    // Fetch fresh user data from database
    const user = await getUserById(decoded.id);
    if (!user) {
      res.status(401).json({ success: false, error: 'User not found' });
      return;
    }
    
    req.user = {
      id: user.id,
      email: user.email,
      tier: user.tier,
      subscription_status: user.subscription_status,
    };
    
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ success: false, error: 'Token expired' });
    } else if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ success: false, error: 'Invalid token' });
    } else {
      res.status(500).json({ success: false, error: 'Authentication failed' });
    }
  }
}

/**
 * Middleware to require certain subscription tier
 */
export function requireTier(allowedTiers: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }
    
    if (!allowedTiers.includes(req.user.tier)) {
      res.status(403).json({ 
        success: false, 
        error: 'Insufficient subscription tier',
        requiredTier: allowedTiers,
        currentTier: req.user.tier
      });
      return;
    }
    
    next();
  };
}

/**
 * Middleware to require specific feature access
 */
export function requireFeature(feature: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }
    
    // Import here to avoid circular dependency
    const { hasFeatureAccess } = await import('./user-model');
    const hasAccess = await hasFeatureAccess(req.user.id, feature);
    
    if (!hasAccess) {
      res.status(403).json({ 
        success: false, 
        error: 'Feature not available with your current subscription',
        feature
      });
      return;
    }
    
    next();
  };
}

/**
 * Middleware to require subscription status active/trialing
 */
export function requireActiveSubscription(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  
  const activeStatuses = ['active', 'trialing'];
  if (!activeStatuses.includes(req.user.subscription_status)) {
    res.status(403).json({ 
      success: false, 
      error: 'Active subscription required',
      current_status: req.user.subscription_status
    });
    return;
  }
  
  next();
}