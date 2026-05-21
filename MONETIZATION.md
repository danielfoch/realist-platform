# Realist.ca Monetization Integration

This document describes the monetization features implemented for Realist.ca, including:

1. **User Tier System** (Free, Premium, Enterprise)
2. **Stripe Integration** for subscription payments
3. **Feature Gating** middleware
4. **Lead Capture** with GoHighLevel CRM integration
5. **Database Schema** extensions
6. **API Endpoints** for subscription management

## Installation

### 1. Install Dependencies

Add the following packages to your project:

```bash
npm install bcrypt jsonwebtoken stripe express-validator
npm install --save-dev @types/bcrypt @types/jsonwebtoken
```

### 2. Environment Variables

Copy the required environment variables from `.env.monetization.example` to your `.env` file:

```bash
cat .env.monetization.example >> .env
```

Then update the values with your actual keys:

- **JWT_SECRET**: Generate a strong secret key for JWT signing
- **STRIPE_SECRET_KEY**: Get from Stripe Dashboard
- **STRIPE_WEBHOOK_SECRET**: Configure in Stripe Dashboard → Webhooks
- **STRIPE_PRICE_PREMIUM**: Create a monthly $29 price in Stripe and paste the price ID
- **GHL_API_KEY**: GoHighLevel API key (from your account)
- **GHL_LOCATION_ID**: GoHighLevel location ID
- **ADMIN_API_KEY**: Set a secure key for admin lead management

### 3. Run Database Migrations

Apply the monetization database schema:

```bash
npm run migrate
```

This will create:
- `users` table with subscription fields
- `subscription_history` audit table
- `lead_submissions` table for CRM integration
- `tier_features` table with feature definitions
- Foreign key constraints for existing `saved_searches` and `favorites` tables

### 4. Start the Server

The server has been updated to include new routes:

- `/api/auth/*` - Authentication and subscription management
- `/api/leads/*` - Lead capture and CRM integration
- `/api/webhook/stripe` - Stripe webhook handler

Start the server as usual:

```bash
npm run dev
```

## API Reference

### Authentication Endpoints

#### POST `/api/auth/register`
Register a new user.

```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "full_name": "John Smith",
  "agree_to_terms": true
}
```

#### POST `/api/auth/login`
Login and receive JWT token.

```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

Response includes user data and JWT token for subsequent requests.

#### GET `/api/auth/profile`
Get current user profile (requires authentication header: `Authorization: Bearer <token>`).

#### POST `/api/auth/subscription/checkout`
Create Stripe Checkout session for upgrading tier.

```json
{
  "tier": "premium",
  "success_url": "https://yourdomain.com/success",
  "cancel_url": "https://yourdomain.com/cancel"
}
```

Returns Stripe Checkout URL.

#### POST `/api/auth/subscription/cancel`
Cancel current subscription.

### Lead Capture Endpoints

#### POST `/api/leads/submit`
Submit a realtor partnership inquiry.

```json
{
  "full_name": "Jane Doe",
  "email": "jane@brokerage.com",
  "phone": "+1234567890",
  "company": "Premium Realty",
  "role": "Broker",
  "inquiry_type": "partnership",
  "message": "Interested in partnering..."
}
```

Automatically syncs to GoHighLevel CRM if configured.

#### GET `/api/leads/leads`
Admin endpoint to list leads (requires `X-Admin-Key` header).

### Feature Access Checking

#### GET `/api/auth/feature-access/:feature`
Check if current user has access to a specific feature.

## Frontend Components

We've created React components for easy integration:

### 1. Lead Form Component
Located at `frontend/src/components/monetization/LeadForm.tsx`

```tsx
import { LeadForm } from '@/components/monetization/LeadForm';

// Usage
<LeadForm />
```

### 2. Subscription Tier Cards
Located at `frontend/src/components/monetization/SubscriptionTierCard.tsx`

```tsx
import { SubscriptionTierCard } from '@/components/monetization/SubscriptionTierCard';

// Usage
<SubscriptionTierCard currentTier="free" />
```

### 3. Protected Feature Component
Located at `frontend/src/components/monetization/ProtectedFeature.tsx`

```tsx
import { ProtectedFeature } from '@/components/monetization/ProtectedFeature';

// Usage
<ProtectedFeature
  feature="investment_metrics"
  title="Investment Metrics"
  description="Advanced financial analysis tools"
>
  <YourPremiumComponent />
</ProtectedFeature>
```

### 4. Feature Access Hook
Located at `frontend/src/hooks/useFeatureAccess.ts`

```tsx
import { useFeatureAccess } from '@/hooks/useFeatureAccess';

const { hasAccess, loading } = useFeatureAccess('investment_metrics');
```

## Stripe Integration

### Setup
1. Create a Stripe account at https://stripe.com
2. Create a product "Realist.ca Premium" with monthly pricing of $29
3. Create a product "Realist.ca Enterprise" (custom pricing)
4. Note the price IDs and add to environment variables
5. Configure webhook endpoint in Stripe Dashboard:
   - URL: `https://yourdomain.com/api/webhook/stripe`
   - Select events: `customer.subscription.*`, `invoice.payment_*`, `checkout.session.completed`

### Webhook Testing
Use Stripe CLI for local testing:

```bash
stripe listen --forward-to localhost:3000/api/webhook/stripe
```

## GoHighLevel CRM Integration

### Setup
1. Get API key from GoHighLevel Settings → API
2. Find your Location ID in account settings
3. Create a pipeline for partnership opportunities (optional)
4. Set environment variables

The integration automatically:
- Creates/updates contacts for lead submissions
- Creates opportunities for partnership inquiries
- Tags leads with `realist.ca` and inquiry type

## Feature Gating Middleware

Backend middleware is available to protect routes:

```ts
import { requireTier, requireFeature, requireActiveSubscription } from '@/src/auth-middleware';

// Require premium or enterprise tier
router.get('/premium-feature', requireTier(['premium', 'enterprise']), handler);

// Require specific feature access
router.get('/investment-metrics', requireFeature('investment_metrics'), handler);

// Require active subscription
router.get('/premium-content', requireActiveSubscription, handler);
```

## Database Schema

### Users Table
- `tier`: free, premium, enterprise
- `subscription_status`: Stripe subscription status
- `stripe_customer_id`, `stripe_subscription_id`
- `current_period_end`: When subscription renews
- `cancel_at_period_end`: Whether subscription will cancel at period end

### Tier Features
Pre-defined feature sets for each tier in `tier_features` table. Use `has_feature_access(user_id, feature)` PostgreSQL function to check access.

## Testing

### Unit Tests
Run existing test suite:

```bash
npm test
```

### Manual Testing
1. Register a new user
2. Login and verify JWT token
3. Attempt to access premium feature (should be denied)
4. Create Stripe Checkout session (test mode)
5. Submit a lead inquiry
6. Verify lead appears in database and GoHighLevel (if configured)
7. Upgrade user tier via Stripe webhook simulation
8. Verify feature access after upgrade

### Stripe Test Cards
Use Stripe test cards for payments:
- Success: `4242 4242 4242 4242`
- Requires authentication: `4000 0027 6000 3184`

## Security Considerations

1. **Passwords**: Hashed with bcrypt (10 rounds)
2. **JWT**: Short-lived tokens (7 days default)
3. **Stripe**: Webhook signature verification
4. **API Keys**: Stored in environment variables
5. **SQL Injection**: Parameterized queries via pg driver
6. **Rate Limiting**: Already implemented via express-rate-limit

## Deployment

1. Update environment variables on your production server
2. Run migrations: `npm run migrate`
3. Ensure Stripe webhook URL is correctly set to production domain
4. Update frontend API base URL if different from localhost
5. Consider adding HTTPS and proper CORS configuration

## Troubleshooting

### Webhook Errors
- Verify `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard
- Check that webhook endpoint is accessible
- Use Stripe CLI to test locally

### CRM Sync Failures
- Verify GoHighLevel API key and location ID
- Check network connectivity to GoHighLevel API
- Review error logs for specific API errors

### Feature Access Issues
- Verify user's tier and subscription status
- Check `tier_features` table has correct feature definitions
- Ensure `has_feature_access` function works

## Next Steps

1. **Email Verification**: Add email confirmation flow
2. **Password Reset**: Implement password reset functionality
3. **Admin Dashboard**: Create UI for managing users and subscriptions
4. **Analytics**: Track subscription metrics and lead conversion
5. **Trial Periods**: Add free trials for premium tier
6. **Multiple Payment Methods**: Support PayPal, Apple Pay, etc.

## Support

For questions or issues, contact the development team or refer to the source code documentation.