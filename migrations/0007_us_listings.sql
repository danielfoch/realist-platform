CREATE TABLE IF NOT EXISTS "us_listings" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "source" text NOT NULL,
  "source_id" text NOT NULL,
  "source_url" text,
  "formatted_address" text NOT NULL,
  "street_address" text,
  "city" text,
  "state" text,
  "postal_code" text,
  "county" text,
  "lat" real,
  "lng" real,
  "property_type" text,
  "beds" real,
  "baths" real,
  "sqft" integer,
  "lot_sqft" integer,
  "year_built" integer,
  "list_price" integer,
  "est_rent" integer,
  "est_taxes" integer,
  "est_hoa" integer,
  "days_on_market" integer,
  "list_date" timestamp,
  "status" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "status_confidence" text,
  "motivated_seller_signals" text[],
  "raw" jsonb,
  "scraped_at" timestamp NOT NULL,
  "first_seen_at" timestamp NOT NULL DEFAULT now(),
  "last_seen_at" timestamp NOT NULL DEFAULT now(),
  "last_checked_at" timestamp,
  "sold_detected_at" timestamp,
  "off_market_detected_at" timestamp,
  "delisted_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "us_listings_source_source_id_idx"
  ON "us_listings" ("source", "source_id");

CREATE INDEX IF NOT EXISTS "us_listings_market_filter_idx"
  ON "us_listings" ("state", "city", "status", "property_type");

CREATE INDEX IF NOT EXISTS "us_listings_price_idx"
  ON "us_listings" ("list_price");

CREATE INDEX IF NOT EXISTS "us_listings_scraped_at_idx"
  ON "us_listings" ("scraped_at" DESC);

CREATE INDEX IF NOT EXISTS "us_listings_active_idx"
  ON "us_listings" ("is_active", "status");
