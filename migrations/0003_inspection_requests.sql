CREATE TABLE IF NOT EXISTS inspection_requests (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar REFERENCES users(id),
  session_id varchar,
  property_address text NOT NULL,
  city text,
  province text,
  listing_id text,
  inspection_type text NOT NULL DEFAULT 'standard_home_inspection',
  preferred_times text,
  contact_name text,
  contact_email text,
  contact_phone text,
  notes text,
  amount_cents integer NOT NULL DEFAULT 50000,
  currency varchar(3) NOT NULL DEFAULT 'cad',
  status text NOT NULL DEFAULT 'requested',
  checkout_status text NOT NULL DEFAULT 'not_started',
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inspection_requests_user_created_idx ON inspection_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS inspection_requests_status_created_idx ON inspection_requests(status, created_at DESC);
