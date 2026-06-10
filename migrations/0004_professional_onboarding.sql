ALTER TABLE professional_subscriptions
  ADD COLUMN IF NOT EXISTS professional_type text,
  ADD COLUMN IF NOT EXISTS certification_number text,
  ADD COLUMN IF NOT EXISTS service_area text,
  ADD COLUMN IF NOT EXISTS onboarding_status text DEFAULT 'started';

CREATE INDEX IF NOT EXISTS professional_subscriptions_type_area_idx
  ON professional_subscriptions(professional_type, brokerage_province, brokerage_city);
