/**
 * Stripe integration for subscription management
 */

import Stripe from 'stripe';
import { db } from './db';
import { getUserById, getUserByStripeCustomerId, updateUser, recordSubscriptionEvent, User } from './user-model';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const STRIPE_PRICE_PREMIUM = process.env.STRIPE_PRICE_PREMIUM || 'price_premium_monthly';
const STRIPE_PRICE_ENTERPRISE = process.env.STRIPE_PRICE_ENTERPRISE || 'price_enterprise_custom';

// Initialize Stripe
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2026-02-25.clover', // Use latest stable version
});

// Price configurations (in cents)
const PRICE_CONFIG = {
  premium: {
    monthly: 2900, // $29/month
    annual: 29000, // $290/year (2 months free)
  },
  enterprise: {
    // Custom pricing - contact sales
  },
};

/**
 * Create a Stripe Checkout session for subscription
 */
export async function createCheckoutSession(
  userId: number,
  tier: 'premium' | 'enterprise',
  successUrl: string,
  cancelUrl: string
) {
  // Get user from database
  const user = await getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Determine price ID based on tier
  let priceId = STRIPE_PRICE_PREMIUM;
  let mode: 'subscription' | 'payment' = 'subscription';
  let customPrice = null;

  if (tier === 'premium') {
    priceId = STRIPE_PRICE_PREMIUM;
  } else if (tier === 'enterprise') {
    // For enterprise, we might use a custom price or contact form
    // For simplicity, we'll create a custom price
    // In production, you might want a different flow
    const product = await stripe.products.create({
      name: 'Enterprise Plan - Custom Pricing',
      description: 'Custom enterprise pricing for Realist.ca',
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: 0, // $0 initially, will be set by sales
      currency: 'usd',
      recurring: { interval: 'month' },
    });

    priceId = price.id;
    customPrice = true;
  }

  // Create or retrieve Stripe customer
  let customerId = user.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.full_name || undefined,
      metadata: {
        userId: user.id.toString(),
      },
    });
    customerId = customer.id;
    
    // Save customer ID to user
    await updateUser(user.id, { stripe_customer_id: customerId });
  }

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId: user.id.toString(),
      tier,
      customPrice: customPrice ? 'true' : 'false',
    },
    subscription_data: tier !== 'enterprise' ? {
      metadata: {
        userId: user.id.toString(),
        tier,
      },
    } : undefined,
  });

  return session;
}

/**
 * Handle Stripe webhook events
 */
export async function handleStripeWebhook(
  rawBody: string | Buffer,
  signature: string
) {
  let event: Stripe.Event;

  // Verify webhook signature
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    throw new Error(`Webhook signature verification failed: ${error}`);
  }

  // Process event
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await handleSubscriptionEvent(event.data.object as Stripe.Subscription);
      break;
    
    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    
    case 'invoice.payment_succeeded':
      await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
      break;
    
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
      break;
    
    default:
      console.log(`Unhandled Stripe event type: ${event.type}`);
  }

  return event;
}

/**
 * Handle subscription events (created, updated, deleted)
 */
async function handleSubscriptionEvent(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const user = await getUserByStripeCustomerId(customerId);
  
  if (!user) {
    console.error(`User not found for Stripe customer ${customerId}`);
    return;
  }

  const oldTier = user.tier;
  const oldStatus = user.subscription_status;
  
  let newTier = user.tier;
  let newStatus: typeof oldStatus = 'inactive';
  
  // Determine status from Stripe subscription
  switch (subscription.status) {
    case 'active':
    case 'trialing':
      newStatus = subscription.status;
      break;
    case 'canceled':
    case 'unpaid':
    case 'past_due':
    case 'incomplete':
    case 'incomplete_expired':
      newStatus = subscription.status;
      break;
  }
  
  // Determine tier from subscription metadata or price
  const tierFromMetadata = subscription.metadata?.tier;
  if (tierFromMetadata && ['premium', 'enterprise'].includes(tierFromMetadata)) {
    newTier = tierFromMetadata as 'premium' | 'enterprise';
  } else {
    // Infer tier from price
    const priceId = subscription.items.data[0]?.price.id;
    if (priceId === STRIPE_PRICE_PREMIUM) {
      newTier = 'premium';
    } else if (priceId === STRIPE_PRICE_ENTERPRISE) {
      newTier = 'enterprise';
    }
  }
  
  // Get current period from subscription item
  const currentPeriodItem = subscription.items.data[0];
  const currentPeriodEnd = currentPeriodItem?.current_period_end;
  const currentPeriodStart = currentPeriodItem?.current_period_start;
  
  // Update user
  const updates: any = {
    stripe_subscription_id: subscription.id,
    subscription_status: newStatus,
    tier: newTier,
    current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
    cancel_at_period_end: subscription.cancel_at_period_end || false,
  };
  
  if (subscription.canceled_at) {
    updates.canceled_at = new Date(subscription.canceled_at * 1000);
  }
  
  if (subscription.status === 'canceled' && subscription.canceled_at) {
    updates.canceled_at = new Date(subscription.canceled_at * 1000);
  }
  
  await updateUser(user.id, updates);
  
  // Record history
  await recordSubscriptionEvent(
    user.id,
    `subscription_${subscription.status}`,
    oldTier,
    newTier,
    oldStatus,
    newStatus,
    subscription.id,
    {
      subscription_id: subscription.id,
      status: subscription.status,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: subscription.cancel_at_period_end,
    }
  );
}

/**
 * Handle completed checkout session
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const tier = session.metadata?.tier;
  
  if (!userId || !tier) {
    console.error('Missing metadata in checkout session', session.id);
    return;
  }
  
  const user = await getUserById(parseInt(userId, 10));
  if (!user) {
    console.error(`User ${userId} not found for checkout session ${session.id}`);
    return;
  }
  
  // If subscription was created, it will be handled by subscription event
  // For one-time payments (enterprise custom), update user tier
  if (tier === 'enterprise' && session.payment_status === 'paid') {
    await updateUser(user.id, {
      tier: 'enterprise',
      subscription_status: 'active',
    });
    
    await recordSubscriptionEvent(
      user.id,
      'checkout_completed',
      user.tier,
      'enterprise',
      user.subscription_status,
      'active',
      session.id,
      { session_id: session.id, tier }
    );
  }
}

/**
 * Handle successful invoice payment
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const user = await getUserByStripeCustomerId(customerId);
  
  if (!user) return;
  
  await recordSubscriptionEvent(
    user.id,
    'payment_succeeded',
    undefined,
    undefined,
    undefined,
    undefined,
    invoice.id,
    {
      amount_paid: invoice.amount_paid,
      invoice_url: invoice.hosted_invoice_url,
    }
  );
}

/**
 * Handle failed invoice payment
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const user = await getUserByStripeCustomerId(customerId);
  
  if (!user) return;
  
  // Update user status to past_due
  await updateUser(user.id, {
    subscription_status: 'past_due',
  });
  
  await recordSubscriptionEvent(
    user.id,
    'payment_failed',
    user.tier,
    user.tier,
    user.subscription_status,
    'past_due',
    invoice.id,
    {
      attempt_count: invoice.attempt_count,
      next_payment_attempt: invoice.next_payment_attempt,
    }
  );
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(userId: number, cancelAtPeriodEnd = false) {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  
  if (!user.stripe_subscription_id) {
    throw new Error('No active subscription');
  }
  
  const subscription = await stripe.subscriptions.update(
    user.stripe_subscription_id,
    {
      cancel_at_period_end: cancelAtPeriodEnd,
    }
  );
  
  // Map Stripe status to our status type
  const statusMap: Record<string, User['subscription_status']> = {
    active: 'active',
    canceled: 'canceled',
    past_due: 'past_due',
    unpaid: 'unpaid',
    incomplete: 'incomplete',
    incomplete_expired: 'incomplete_expired',
    trialing: 'trialing',
    paused: 'inactive',
  };
  
  // Update user record
  await updateUser(user.id, {
    subscription_status: statusMap[subscription.status] || 'inactive',
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
  });
  
  return subscription;
}

/**
 * Get subscription details
 */
export async function getSubscriptionDetails(userId: number) {
  const user = await getUserById(userId);
  if (!user || !user.stripe_subscription_id) {
    return null;
  }
  
  const subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
  return subscription;
}