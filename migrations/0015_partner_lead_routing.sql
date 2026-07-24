-- Partner Network Reactivation Phase 1: mortgage-broker / lender lead routing.
-- Financing-intent leads reuse realtor_lead_notifications with a partner_type
-- discriminator (realtor | mortgage_broker | lender) instead of a parallel
-- mortgage_lead_notifications table, keeping the shared claim → introduction →
-- referral-outcome flow identical for every partner type.
-- Mirrors shared/schema.ts realtorLeadNotifications.partnerType.

ALTER TABLE "realtor_lead_notifications" ADD COLUMN IF NOT EXISTS "partner_type" text DEFAULT 'realtor' NOT NULL;
