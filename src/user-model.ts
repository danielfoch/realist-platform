/**
 * User model and database operations
 */

import bcrypt from 'bcrypt';
import { db } from './db';

export interface User {
  id: number;
  email: string;
  password_hash: string;
  full_name: string | null;
  avatar_url: string | null;
  tier: 'free' | 'premium' | 'enterprise';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'trialing' | 'inactive';
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
  canceled_at: Date | null;
  receive_marketing_emails: boolean;
  agree_to_terms: boolean;
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
}

export interface CreateUserInput {
  email: string;
  password: string;
  full_name?: string;
  agree_to_terms: boolean;
  receive_marketing_emails?: boolean;
}

export interface UpdateUserInput {
  full_name?: string;
  avatar_url?: string;
  tier?: User['tier'];
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: User['subscription_status'];
  current_period_end?: Date | null;
  cancel_at_period_end?: boolean;
  canceled_at?: Date | null;
  receive_marketing_emails?: boolean;
  last_login_at?: Date;
}

const SALT_ROUNDS = 10;

/**
 * Create a new user with hashed password
 */
export async function createUser(input: CreateUserInput): Promise<User> {
  const password_hash = await bcrypt.hash(input.password, SALT_ROUNDS);
  
  const result = await db.query<User>(
    `INSERT INTO users (
      email, password_hash, full_name, agree_to_terms, receive_marketing_emails,
      tier, subscription_status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [
      input.email,
      password_hash,
      input.full_name || null,
      input.agree_to_terms,
      input.receive_marketing_emails ?? true,
      'free', // default tier
      'inactive'
    ]
  );
  
  if (!result.rows[0]) {
    throw new Error('Failed to create user');
  }
  return result.rows[0];
}

/**
 * Get user by ID
 */
export async function getUserById(id: number): Promise<User | null> {
  const result = await db.query<User>('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0] || null;
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const result = await db.query<User>('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0] || null;
}

/**
 * Get user by Stripe customer ID
 */
export async function getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | null> {
  const result = await db.query<User>('SELECT * FROM users WHERE stripe_customer_id = $1', [stripeCustomerId]);
  return result.rows[0] || null;
}

/**
 * Get user by Stripe subscription ID
 */
export async function getUserByStripeSubscriptionId(stripeSubscriptionId: string): Promise<User | null> {
  const result = await db.query<User>('SELECT * FROM users WHERE stripe_subscription_id = $1', [stripeSubscriptionId]);
  return result.rows[0] || null;
}

/**
 * Update user fields
 */
export async function updateUser(id: number, updates: UpdateUserInput): Promise<User | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramCount = 1;
  
  // Build dynamic update query
  if (updates.full_name !== undefined) {
    fields.push(`full_name = $${paramCount++}`);
    values.push(updates.full_name);
  }
  if (updates.avatar_url !== undefined) {
    fields.push(`avatar_url = $${paramCount++}`);
    values.push(updates.avatar_url);
  }
  if (updates.tier !== undefined) {
    fields.push(`tier = $${paramCount++}`);
    values.push(updates.tier);
  }
  if (updates.stripe_customer_id !== undefined) {
    fields.push(`stripe_customer_id = $${paramCount++}`);
    values.push(updates.stripe_customer_id);
  }
  if (updates.stripe_subscription_id !== undefined) {
    fields.push(`stripe_subscription_id = $${paramCount++}`);
    values.push(updates.stripe_subscription_id);
  }
  if (updates.subscription_status !== undefined) {
    fields.push(`subscription_status = $${paramCount++}`);
    values.push(updates.subscription_status);
  }
  if (updates.current_period_end !== undefined) {
    fields.push(`current_period_end = $${paramCount++}`);
    values.push(updates.current_period_end);
  }
  if (updates.cancel_at_period_end !== undefined) {
    fields.push(`cancel_at_period_end = $${paramCount++}`);
    values.push(updates.cancel_at_period_end);
  }
  if (updates.canceled_at !== undefined) {
    fields.push(`canceled_at = $${paramCount++}`);
    values.push(updates.canceled_at);
  }
  if (updates.receive_marketing_emails !== undefined) {
    fields.push(`receive_marketing_emails = $${paramCount++}`);
    values.push(updates.receive_marketing_emails);
  }
  if (updates.last_login_at !== undefined) {
    fields.push(`last_login_at = $${paramCount++}`);
    values.push(updates.last_login_at);
  }
  
  if (fields.length === 0) {
    return getUserById(id);
  }
  
  values.push(id);
  const result = await db.query<User>(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );
  
  return result.rows[0] || null;
}

/**
 * Verify user password
 */
export async function verifyPassword(user: User, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.password_hash);
}

/**
 * Change user password
 */
export async function changePassword(userId: number, newPassword: string): Promise<void> {
  const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await db.query(
    'UPDATE users SET password_hash = $1 WHERE id = $2',
    [password_hash, userId]
  );
}

/**
 * Record subscription history event
 */
export async function recordSubscriptionEvent(
  userId: number,
  eventType: string,
  oldTier?: string,
  newTier?: string,
  oldStatus?: string,
  newStatus?: string,
  stripeEventId?: string,
  metadata?: object
): Promise<void> {
  await db.query(
    `INSERT INTO subscription_history (
      user_id, event_type, old_tier, new_tier, old_status, new_status,
      stripe_event_id, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [userId, eventType, oldTier, newTier, oldStatus, newStatus, stripeEventId, metadata ? JSON.stringify(metadata) : null]
  );
}

/**
 * Check if user has access to a specific feature
 */
export async function hasFeatureAccess(userId: number, feature: string): Promise<boolean> {
  const result = await db.query<{ has_feature_access: boolean }>(
    'SELECT has_feature_access($1, $2) as has_feature_access',
    [userId, feature]
  );
  return result.rows[0]?.has_feature_access ?? false;
}

/**
 * Get user's subscription summary including features
 */
export async function getUserSubscriptionSummary(userId: number) {
  const result = await db.query(
    'SELECT * FROM get_user_subscription_summary($1)',
    [userId]
  );
  return result.rows[0] || null;
}

/**
 * Delete user (admin only)
 */
export async function deleteUser(id: number): Promise<void> {
  await db.query('DELETE FROM users WHERE id = $1', [id]);
}