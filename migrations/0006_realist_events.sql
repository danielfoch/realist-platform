CREATE TABLE IF NOT EXISTS "realist_events" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" text NOT NULL UNIQUE,
  "title" text NOT NULL,
  "short_description" text,
  "long_description" text,
  "header_image_url" text,
  "event_type" text NOT NULL DEFAULT 'IN_PERSON',
  "status" text NOT NULL DEFAULT 'DRAFT',
  "starts_at" timestamp NOT NULL,
  "ends_at" timestamp,
  "timezone" text NOT NULL DEFAULT 'America/Toronto',
  "venue_name" text,
  "venue_address" text,
  "online_url" text,
  "agenda_sections" jsonb DEFAULT '[]'::jsonb,
  "capacity" integer,
  "refund_policy" text,
  "seo_title" text,
  "seo_description" text,
  "created_by_email" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "realist_event_speakers" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" varchar NOT NULL REFERENCES "realist_events"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "title" text,
  "company" text,
  "bio" text,
  "image_url" text,
  "sort_order" integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "realist_event_ticket_types" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" varchar NOT NULL REFERENCES "realist_events"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "price_cents" integer NOT NULL,
  "currency" varchar(3) NOT NULL DEFAULT 'cad',
  "quantity_total" integer,
  "quantity_sold" integer NOT NULL DEFAULT 0,
  "sales_start_at" timestamp,
  "sales_end_at" timestamp,
  "is_active" boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS "realist_event_orders" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" varchar NOT NULL REFERENCES "realist_events"("id"),
  "ticket_type_id" varchar NOT NULL REFERENCES "realist_event_ticket_types"("id"),
  "user_id" varchar REFERENCES "users"("id"),
  "email" text NOT NULL,
  "name" text,
  "quantity" integer NOT NULL DEFAULT 1,
  "amount_paid_cents" integer NOT NULL,
  "currency" varchar(3) NOT NULL DEFAULT 'cad',
  "stripe_checkout_session_id" text NOT NULL UNIQUE,
  "stripe_payment_intent_id" text,
  "stripe_customer_id" text,
  "status" text NOT NULL DEFAULT 'PAID',
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "realist_event_attendees" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" varchar NOT NULL REFERENCES "realist_events"("id"),
  "ticket_type_id" varchar NOT NULL REFERENCES "realist_event_ticket_types"("id"),
  "order_id" varchar NOT NULL REFERENCES "realist_event_orders"("id") ON DELETE CASCADE,
  "user_id" varchar REFERENCES "users"("id"),
  "email" text NOT NULL,
  "name" text,
  "checked_in_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "realist_events_status_idx" ON "realist_events" ("status");
CREATE INDEX IF NOT EXISTS "realist_event_speakers_event_id_idx" ON "realist_event_speakers" ("event_id");
CREATE INDEX IF NOT EXISTS "realist_event_ticket_types_event_id_idx" ON "realist_event_ticket_types" ("event_id");
CREATE INDEX IF NOT EXISTS "realist_event_orders_event_id_idx" ON "realist_event_orders" ("event_id");
CREATE INDEX IF NOT EXISTS "realist_event_orders_user_id_idx" ON "realist_event_orders" ("user_id");
CREATE INDEX IF NOT EXISTS "realist_event_attendees_event_id_idx" ON "realist_event_attendees" ("event_id");
CREATE INDEX IF NOT EXISTS "realist_event_attendees_user_id_idx" ON "realist_event_attendees" ("user_id");
