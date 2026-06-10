CREATE TABLE "analyses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" varchar,
	"property_id" varchar,
	"user_id" varchar,
	"country_mode" text NOT NULL,
	"strategy_type" text NOT NULL,
	"address" text,
	"city" text,
	"province" text,
	"rent_inputs" jsonb,
	"vacancy_rate" real,
	"expense_assumptions" jsonb,
	"inputs_json" jsonb NOT NULL,
	"results_json" jsonb,
	"share_token" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "analyses_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "area_scores" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"geography_id" varchar NOT NULL,
	"date" varchar(10) NOT NULL,
	"investor_score" real,
	"livability_score" real,
	"growth_score" real,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"excerpt" text NOT NULL,
	"content" text NOT NULL,
	"cover_image" text,
	"author_id" varchar,
	"author_name" text DEFAULT 'Realist Team' NOT NULL,
	"category" text DEFAULT 'market-analysis' NOT NULL,
	"tags" text[] DEFAULT '{}'::text[],
	"status" text DEFAULT 'draft' NOT NULL,
	"meta_title" text,
	"meta_description" text,
	"read_time_minutes" integer,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blog_posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "branding_assets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"logo_url" text,
	"company_name" text,
	"primary_color" text,
	"secondary_color" text,
	"contact_email" text,
	"contact_phone" text,
	"website" text,
	"disclaimer_text" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "branding_assets_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "buybox_agreements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"agreement_version" varchar DEFAULT '1.0' NOT NULL,
	"agreement_html" text NOT NULL,
	"signed_name" text NOT NULL,
	"signature_data_url" text NOT NULL,
	"term_start_date" timestamp NOT NULL,
	"term_end_date" timestamp NOT NULL,
	"holdover_days" integer DEFAULT 60,
	"commission_percent" real DEFAULT 2.5,
	"ip_address" varchar,
	"user_agent" text,
	"signed_at" timestamp NOT NULL,
	"pdf_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buybox_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "buybox_config_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "buybox_mandates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"agreement_id" varchar NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"polygon_geo_json" jsonb NOT NULL,
	"centroid_lat" real,
	"centroid_lng" real,
	"area_name" text,
	"target_price" integer,
	"max_price" integer,
	"lot_frontage" real,
	"lot_frontage_unit" text DEFAULT 'ft',
	"lot_depth" real,
	"lot_depth_unit" text DEFAULT 'ft',
	"total_lot_area" real,
	"total_lot_area_unit" text DEFAULT 'sqft',
	"zoning_planning_status" text,
	"building_type" text,
	"occupancy" text,
	"target_closing_date" timestamp,
	"possession_date" timestamp,
	"offer_conditions" text[],
	"additional_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buybox_notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"mandate_id" varchar,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buybox_responses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mandate_id" varchar NOT NULL,
	"realtor_id" varchar NOT NULL,
	"message" text NOT NULL,
	"property_address" text,
	"property_link" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "capstone_cost_models" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"monthly_rent" integer,
	"down_payment_percent" real,
	"interest_rate" real,
	"amortization_years" integer,
	"zoning_code" text,
	"lot_coverage_ratio" real,
	"max_stories" integer,
	"max_units" integer,
	"has_garden_suite" boolean DEFAULT false,
	"construction_cost_per_sqft" integer,
	"mli_accessibility_points" integer DEFAULT 0,
	"mli_affordability_points" integer DEFAULT 0,
	"mli_energy_points" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "capstone_proformas" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"buildable_gfa" real,
	"total_construction_cost" integer,
	"total_project_cost" integer,
	"noi" integer,
	"dscr" real,
	"cap_rate" real,
	"cash_on_cash_return" real,
	"yield_on_cost" real,
	"results_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "capstone_projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"title" text,
	"strategy" text,
	"current_step" integer DEFAULT 1,
	"status" text DEFAULT 'draft',
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "capstone_properties" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"source_url" text,
	"listing_id" text,
	"address" text,
	"city" text,
	"province" text,
	"postal_code" text,
	"price" integer,
	"annual_taxes" integer,
	"lot_frontage" real,
	"lot_depth" real,
	"lot_area" real,
	"bedrooms" integer,
	"bathrooms" integer,
	"square_footage" integer,
	"property_type" text,
	"building_type" text,
	"image_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "city_yield_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city" text NOT NULL,
	"province" text NOT NULL,
	"month" varchar(7) NOT NULL,
	"listing_count" integer DEFAULT 0 NOT NULL,
	"avg_gross_yield" real,
	"median_gross_yield" real,
	"avg_net_yield" real,
	"avg_list_price" real,
	"median_list_price" real,
	"avg_rent_per_unit" real,
	"avg_days_on_market" real,
	"avg_price_per_sqft" real,
	"inventory_count" integer DEFAULT 0,
	"avg_beds_per_listing" real,
	"yield_trend" real,
	"computed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coinvest_checklist_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar,
	"user_id" varchar,
	"inputs" jsonb NOT NULL,
	"score" integer NOT NULL,
	"tier" text NOT NULL,
	"flags" text[],
	"recommendations" text[],
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coinvest_compliance_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"event_type" text NOT NULL,
	"metadata" jsonb,
	"ip_address" varchar,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coinvest_groups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'forming' NOT NULL,
	"ownership_structure" text NOT NULL,
	"jurisdiction" text NOT NULL,
	"property_address" text,
	"property_city" text,
	"property_region" text,
	"property_country" text DEFAULT 'canada',
	"property_type" text,
	"units_count" integer,
	"target_strategy" text,
	"target_close_date" timestamp,
	"capital_target_cad" real,
	"min_commitment_cad" real,
	"target_group_size" integer,
	"skills_needed" text[],
	"visibility" text DEFAULT 'public' NOT NULL,
	"requires_accredited" boolean DEFAULT false,
	"checklist_result_id" varchar,
	"analysis_id" varchar,
	"analysis_snapshot" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coinvest_memberships" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"pledged_capital_cad" real,
	"skills_offered" text[],
	"note" text,
	"status" text DEFAULT 'requested' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coinvest_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coinvest_user_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"display_name" text,
	"location" text,
	"city" text,
	"region" text,
	"country" text DEFAULT 'canada',
	"investor_type" text,
	"skills" text[],
	"certifications" text[],
	"capital_min_cad" real,
	"capital_max_cad" real,
	"time_horizon" text,
	"risk_tolerance" text,
	"contact_preference" text DEFAULT 'in_app',
	"disclaimer_accepted_at" timestamp,
	"bra_status" text DEFAULT 'not_started',
	"bra_signed_at" timestamp,
	"bra_document_id" varchar,
	"bra_jurisdiction" varchar,
	"coinvest_ack_status" text DEFAULT 'not_started',
	"coinvest_ack_signed_at" timestamp,
	"coinvest_ack_version" varchar,
	"coinvest_ack_signed_name" text,
	"coinvest_ack_signature_data_url" text,
	"representation_brokerage" text DEFAULT 'Valery Real Estate Inc.',
	"representation_agent" text DEFAULT 'Daniel Foch',
	"selected_jurisdiction" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coinvest_user_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "coaching_waitlist" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"main_problem" text NOT NULL,
	"status" text DEFAULT 'pending',
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contribution_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"points" integer NOT NULL,
	"target_type" text,
	"target_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_cache" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value_json" jsonb NOT NULL,
	"source" text,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "data_cache_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "ddf_listing_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_key" varchar NOT NULL,
	"mls_number" varchar,
	"city" text,
	"province" text,
	"postal_code" varchar,
	"list_price" real,
	"bedrooms_total" integer,
	"bathrooms_total" integer,
	"number_of_units" integer,
	"living_area" real,
	"year_built" integer,
	"property_sub_type" text,
	"structure_type" text,
	"latitude" real,
	"longitude" real,
	"total_actual_rent" real,
	"tax_annual_amount" real,
	"association_fee" real,
	"estimated_monthly_rent" real,
	"gross_yield" real,
	"estimated_expenses" real,
	"estimated_noi" real,
	"net_yield" real,
	"days_on_market" integer,
	"rent_source" text,
	"raw_json" jsonb,
	"snapshot_month" varchar(7) NOT NULL,
	"captured_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_match_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"analysis_id" varchar,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"match_types" text[],
	"city" text,
	"province" text,
	"deal_summary" jsonb,
	"status" text DEFAULT 'pending',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "distress_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"month" varchar(7) NOT NULL,
	"province" text NOT NULL,
	"city" text,
	"total_listings" integer DEFAULT 0 NOT NULL,
	"foreclosure_pos_count" integer DEFAULT 0 NOT NULL,
	"motivated_count" integer DEFAULT 0 NOT NULL,
	"vtb_count" integer DEFAULT 0 NOT NULL,
	"avg_distress_score" real,
	"max_distress_score" real,
	"avg_list_price" real,
	"median_list_price" real,
	"high_confidence_count" integer DEFAULT 0 NOT NULL,
	"medium_confidence_count" integer DEFAULT 0 NOT NULL,
	"low_confidence_count" integer DEFAULT 0 NOT NULL,
	"avg_days_on_market" real,
	"property_types_json" jsonb,
	"top_cities_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiment_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visitor_id" varchar NOT NULL,
	"user_id" varchar,
	"experiment_key" text NOT NULL,
	"variant" text NOT NULL,
	"converted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geographies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"city" text,
	"province" text,
	"geometry" jsonb,
	"centroid_lat" real,
	"centroid_lng" real,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "google_oauth_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_type" text DEFAULT 'Bearer',
	"expires_at" timestamp,
	"scope" text,
	"google_email" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "google_oauth_tokens_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "guides" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"excerpt" text NOT NULL,
	"content" text NOT NULL,
	"cover_image" text,
	"icon" text DEFAULT 'BookOpen',
	"category" text DEFAULT 'getting-started' NOT NULL,
	"difficulty" text DEFAULT 'beginner' NOT NULL,
	"author_name" text DEFAULT 'Realist Team' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"meta_title" text,
	"meta_description" text,
	"read_time_minutes" integer,
	"sort_order" integer DEFAULT 0,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "guides_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "indigenous_features" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"layer_id" varchar NOT NULL,
	"feature_external_id" text,
	"feature_name" text,
	"nation_name" text,
	"treaty_name" text,
	"agreement_name" text,
	"claim_name" text,
	"province" text,
	"category" text,
	"status" text,
	"metadata_json" text,
	"bbox" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"geom" geometry(Geometry,4326),
	"centroid" geometry(Point,4326)
);
--> statement-breakpoint
CREATE TABLE "indigenous_layers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"layer_name" text NOT NULL,
	"layer_group" text DEFAULT 'historic_treaty' NOT NULL,
	"jurisdiction" text DEFAULT 'federal',
	"source_name" text NOT NULL,
	"source_url" text,
	"source_dataset_id" text,
	"licence" text,
	"update_frequency" text,
	"active" boolean DEFAULT true NOT NULL,
	"feature_count" integer DEFAULT 0,
	"last_checked_at" timestamp,
	"last_imported_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "indigenous_layers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "industry_partners" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"partner_type" text NOT NULL,
	"company_name" text,
	"license_number" text,
	"phone" text,
	"public_email" text,
	"bio" text,
	"headshot_url" text,
	"service_areas" text[],
	"social_links" jsonb,
	"is_approved" boolean DEFAULT false,
	"is_public" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "industry_partners_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "investor_kyc" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"is_accredited_investor" boolean DEFAULT false,
	"estimated_net_worth" text,
	"annual_income" text,
	"investment_experience" text,
	"risk_tolerance" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "investor_kyc_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "investor_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"phone" text,
	"city" text,
	"province" text,
	"country" text DEFAULT 'canada',
	"bio" text,
	"investment_goals" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "investor_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"consent" boolean DEFAULT false,
	"lead_source" text DEFAULT 'Deal Analyzer',
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_content" text,
	"utm_term" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lender_applications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"company" text,
	"email" text NOT NULL,
	"phone" text,
	"lending_types" text[],
	"target_markets" text[],
	"loan_size_min" text,
	"loan_size_max" text,
	"preferred_dscr" text,
	"preferred_ltv" text,
	"turnaround_time" text,
	"referral_agreement" boolean DEFAULT false,
	"status" text DEFAULT 'pending',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_analysis_aggregates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_mls_number" text NOT NULL,
	"community_cap_rate" real,
	"rents_used_json" jsonb,
	"analysis_count" integer DEFAULT 0,
	"comment_count" integer DEFAULT 0,
	"last_analysis_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "listing_analysis_aggregates_listing_mls_number_unique" UNIQUE("listing_mls_number")
);
--> statement-breakpoint
CREATE TABLE "listing_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_mls_number" text NOT NULL,
	"user_id" varchar NOT NULL,
	"body" text NOT NULL,
	"score" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_expert_applications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"market_region" text NOT NULL,
	"market_city" text,
	"package_type" text DEFAULT 'featured_expert',
	"include_meetup_host" boolean DEFAULT false,
	"monthly_fee" real DEFAULT 1000,
	"referral_fee_percent" real DEFAULT 20,
	"stripe_subscription_id" text,
	"status" text DEFAULT 'pending',
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city" text NOT NULL,
	"province" text NOT NULL,
	"month" varchar(7) NOT NULL,
	"deal_count" integer DEFAULT 0 NOT NULL,
	"avg_cap_rate" real,
	"avg_cash_on_cash" real,
	"avg_dscr" real,
	"avg_purchase_price" real,
	"avg_rent_per_unit" real,
	"median_cap_rate" real,
	"median_purchase_price" real,
	"avg_vacancy_rate" real,
	"cmhc_one_bed" real,
	"cmhc_two_bed" real,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"geography_id" varchar NOT NULL,
	"metric_type" text NOT NULL,
	"value" real NOT NULL,
	"date" varchar(10) NOT NULL,
	"source" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mortgage_rate_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rate_type" text NOT NULL,
	"term" text NOT NULL,
	"rate" real NOT NULL,
	"provider" text NOT NULL,
	"source" text NOT NULL,
	"category" text DEFAULT 'posted' NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mortgage_rates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rate_type" text NOT NULL,
	"term" text NOT NULL,
	"rate" real NOT NULL,
	"provider" text NOT NULL,
	"source" text NOT NULL,
	"category" text DEFAULT 'posted' NOT NULL,
	"province" text,
	"is_insured" boolean DEFAULT false,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_leads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" varchar NOT NULL,
	"lead_id" varchar NOT NULL,
	"status" text DEFAULT 'new',
	"notes" text,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"contacted_at" timestamp,
	"closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "platform_analytics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" timestamp NOT NULL,
	"region" text,
	"city" text,
	"analysis_count" integer DEFAULT 0,
	"unique_users" integer DEFAULT 0,
	"leads_captured" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "podcast_questions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"question" text NOT NULL,
	"answered" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_properties" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"city" text,
	"province" text,
	"country" text DEFAULT 'canada',
	"purchase_price" real,
	"purchase_date" timestamp,
	"current_value" real,
	"monthly_rent" real,
	"monthly_expenses" real,
	"strategy_type" text,
	"inputs_json" jsonb,
	"results_json" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professional_subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"tier" text DEFAULT 'free' NOT NULL,
	"premium_source" text,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"monthly_pull_limit" integer DEFAULT 5,
	"pulls_used_this_month" integer DEFAULT 0,
	"period_start" timestamp DEFAULT now(),
	"period_end" timestamp,
	"status" text DEFAULT 'active',
	"bra_signed_at" timestamp,
	"bra_expires_at" timestamp,
	"bra_signature_data_url" text,
	"bra_signed_name" text,
	"brokerage_name" text,
	"brokerage_city" text,
	"brokerage_province" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "professional_subscriptions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" varchar,
	"formatted_address" text NOT NULL,
	"street_address" text,
	"city" text,
	"region" text,
	"country" text NOT NULL,
	"postal_code" text,
	"lat" real,
	"lng" real,
	"place_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_managers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"company_name" text NOT NULL,
	"contact_name" text,
	"email" text,
	"phone" text,
	"website" text,
	"calendly_url" text,
	"province" text NOT NULL,
	"province_code" text NOT NULL,
	"city" text,
	"bio" text,
	"is_approved" boolean DEFAULT false,
	"is_featured" boolean DEFAULT false,
	"subscription_tier" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "rate_forecasts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"forecast_type" text DEFAULT 'ca10y_simple' NOT NULL,
	"term_months" integer DEFAULT 300 NOT NULL,
	"path_json" text NOT NULL,
	"assumptions_json" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "realtor_applications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"brokerage" text,
	"markets" text[],
	"asset_types" text[],
	"deal_types" text[],
	"avg_deal_size" text,
	"referral_agreement" boolean DEFAULT false,
	"status" text DEFAULT 'pending',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "realtor_introductions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" varchar NOT NULL,
	"realtor_user_id" varchar NOT NULL,
	"lead_name" text NOT NULL,
	"lead_email" text NOT NULL,
	"realtor_name" text NOT NULL,
	"realtor_email" text NOT NULL,
	"realtor_phone" text,
	"realtor_company" text,
	"intro_email_subject" text NOT NULL,
	"intro_email_html" text NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "realtor_lead_notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"realtor_claim_id" varchar NOT NULL,
	"realtor_user_id" varchar NOT NULL,
	"lead_id" varchar NOT NULL,
	"property_id" varchar,
	"analysis_id" varchar,
	"deal_address" text,
	"deal_city" text,
	"deal_region" text,
	"deal_strategy" text,
	"status" text DEFAULT 'new' NOT NULL,
	"notified_at" timestamp DEFAULT now() NOT NULL,
	"viewed_at" timestamp,
	"claimed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "realtor_market_claims" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"partner_id" varchar,
	"market_city" text NOT NULL,
	"market_region" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"referral_fee_percent" real DEFAULT 25 NOT NULL,
	"referral_agreement_signed_at" timestamp,
	"referral_agreement_signature" text,
	"referral_agreement_signed_name" text,
	"stripe_subscription_id" text,
	"monthly_fee" real DEFAULT 49.99,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reno_quotes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" varchar,
	"persona" text NOT NULL,
	"address" text,
	"city" text,
	"region" text,
	"country" text DEFAULT 'canada',
	"postal_code" text,
	"property_type" text,
	"existing_sqft" real,
	"bedrooms" integer,
	"bathrooms" integer,
	"basement_type" text,
	"basement_height" real,
	"project_intents" text[],
	"line_items_json" jsonb NOT NULL,
	"assumptions_json" jsonb NOT NULL,
	"pricing_result_json" jsonb,
	"lead_name" text,
	"lead_email" text,
	"lead_phone" text,
	"lead_consent" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rent_listings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text,
	"city" text NOT NULL,
	"province" text NOT NULL,
	"address" text,
	"bedrooms" text NOT NULL,
	"bathrooms" text,
	"rent" integer NOT NULL,
	"square_footage" integer,
	"lat" real,
	"lng" real,
	"source_url" text,
	"source_platform" text,
	"listing_date" timestamp,
	"scraped_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rent_pulse" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city" text NOT NULL,
	"province" text NOT NULL,
	"bedrooms" text NOT NULL,
	"median_rent" integer NOT NULL,
	"average_rent" integer,
	"sample_size" integer NOT NULL,
	"min_rent" integer,
	"max_rent" integer,
	"scraped_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_deals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"name" text NOT NULL,
	"address" text,
	"city" text,
	"province" text,
	"country_mode" text NOT NULL,
	"strategy_type" text NOT NULL,
	"mls_number" text,
	"inputs_json" jsonb NOT NULL,
	"results_json" jsonb NOT NULL,
	"share_with_community" boolean DEFAULT true NOT NULL,
	"session_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"title" text NOT NULL,
	"geography_ids" text[],
	"metric_types" text[],
	"start_date" varchar(10),
	"end_date" varchar(10),
	"config_json" jsonb,
	"share_token" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "screening_hits" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"screening_id" varchar NOT NULL,
	"feature_id" varchar NOT NULL,
	"hit_type" text NOT NULL,
	"distance_meters" real,
	"overlap_area" real,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "screenings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"searched_address" text,
	"normalized_address" text,
	"lat" real NOT NULL,
	"lng" real NOT NULL,
	"screening_method" text DEFAULT 'point_plus_buffer' NOT NULL,
	"buffer_meters" integer DEFAULT 0,
	"result_status" text NOT NULL,
	"completeness_status" text DEFAULT 'basic',
	"summary_json" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "true_cost_breakdowns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inquiry_id" varchar NOT NULL,
	"breakdown_json" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "true_cost_inquiries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"home_value" integer NOT NULL,
	"city" text NOT NULL,
	"home_type" text NOT NULL,
	"buyer_type" text NOT NULL,
	"is_new_construction" boolean DEFAULT false,
	"square_footage" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "underwriting_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_mls_number" text NOT NULL,
	"user_id" varchar NOT NULL,
	"unit_count" integer,
	"rents_json" jsonb,
	"vacancy" real,
	"expense_ratio" real,
	"note_text" text,
	"score" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"target_type" text NOT NULL,
	"target_id" varchar NOT NULL,
	"value" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watch_overlays" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"overlay_name" text NOT NULL,
	"overlay_group" text DEFAULT 'high_sensitivity' NOT NULL,
	"jurisdiction" text DEFAULT 'provincial',
	"nation_name" text,
	"legal_context_type" text,
	"source_summary" text,
	"source_url" text,
	"source_date" text,
	"geometry_method" text,
	"geometry_confidence" text,
	"authority_level" text,
	"disclaimer_text" text,
	"status_label" text,
	"active" boolean DEFAULT true NOT NULL,
	"metadata_json" text,
	"created_by" text,
	"digitization_notes" text,
	"reviewed_by" text,
	"review_status" text,
	"geom" geometry(Geometry,4326),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "watch_overlays_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "webhook_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" varchar,
	"endpoint" text NOT NULL,
	"payload_json" jsonb NOT NULL,
	"status" text NOT NULL,
	"response" text,
	"attempts" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"token" varchar NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "phone_verification_codes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"phone" varchar NOT NULL,
	"code" varchar NOT NULL,
	"attempts" varchar DEFAULT '0',
	"expires_at" timestamp NOT NULL,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_oauth_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"provider" varchar NOT NULL,
	"provider_user_id" varchar NOT NULL,
	"provider_email" varchar,
	"access_token" varchar,
	"refresh_token" varchar,
	"token_expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"password_hash" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"phone" varchar,
	"phone_verified" boolean DEFAULT false,
	"profile_image_url" varchar,
	"role" varchar DEFAULT 'investor',
	"email_verified" boolean DEFAULT false,
	"email_verification_token" varchar,
	"email_verification_expires" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "area_scores" ADD CONSTRAINT "area_scores_geography_id_geographies_id_fk" FOREIGN KEY ("geography_id") REFERENCES "public"."geographies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branding_assets" ADD CONSTRAINT "branding_assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buybox_agreements" ADD CONSTRAINT "buybox_agreements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buybox_mandates" ADD CONSTRAINT "buybox_mandates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buybox_mandates" ADD CONSTRAINT "buybox_mandates_agreement_id_buybox_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."buybox_agreements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buybox_notifications" ADD CONSTRAINT "buybox_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buybox_notifications" ADD CONSTRAINT "buybox_notifications_mandate_id_buybox_mandates_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."buybox_mandates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buybox_responses" ADD CONSTRAINT "buybox_responses_mandate_id_buybox_mandates_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."buybox_mandates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buybox_responses" ADD CONSTRAINT "buybox_responses_realtor_id_users_id_fk" FOREIGN KEY ("realtor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capstone_cost_models" ADD CONSTRAINT "capstone_cost_models_project_id_capstone_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."capstone_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capstone_proformas" ADD CONSTRAINT "capstone_proformas_project_id_capstone_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."capstone_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capstone_projects" ADD CONSTRAINT "capstone_projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capstone_properties" ADD CONSTRAINT "capstone_properties_project_id_capstone_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."capstone_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coinvest_checklist_results" ADD CONSTRAINT "coinvest_checklist_results_group_id_coinvest_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."coinvest_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coinvest_checklist_results" ADD CONSTRAINT "coinvest_checklist_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coinvest_compliance_logs" ADD CONSTRAINT "coinvest_compliance_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coinvest_groups" ADD CONSTRAINT "coinvest_groups_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coinvest_groups" ADD CONSTRAINT "coinvest_groups_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coinvest_memberships" ADD CONSTRAINT "coinvest_memberships_group_id_coinvest_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."coinvest_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coinvest_memberships" ADD CONSTRAINT "coinvest_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coinvest_messages" ADD CONSTRAINT "coinvest_messages_group_id_coinvest_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."coinvest_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coinvest_messages" ADD CONSTRAINT "coinvest_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coinvest_user_profiles" ADD CONSTRAINT "coinvest_user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contribution_events" ADD CONSTRAINT "contribution_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_match_requests" ADD CONSTRAINT "deal_match_requests_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_oauth_tokens" ADD CONSTRAINT "google_oauth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "industry_partners" ADD CONSTRAINT "industry_partners_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investor_kyc" ADD CONSTRAINT "investor_kyc_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investor_profiles" ADD CONSTRAINT "investor_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_comments" ADD CONSTRAINT "listing_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_expert_applications" ADD CONSTRAINT "market_expert_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metrics" ADD CONSTRAINT "metrics_geography_id_geographies_id_fk" FOREIGN KEY ("geography_id") REFERENCES "public"."geographies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_leads" ADD CONSTRAINT "partner_leads_partner_id_industry_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."industry_partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_leads" ADD CONSTRAINT "partner_leads_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_properties" ADD CONSTRAINT "portfolio_properties_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_subscriptions" ADD CONSTRAINT "professional_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_managers" ADD CONSTRAINT "property_managers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "realtor_introductions" ADD CONSTRAINT "realtor_introductions_notification_id_realtor_lead_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."realtor_lead_notifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "realtor_introductions" ADD CONSTRAINT "realtor_introductions_realtor_user_id_users_id_fk" FOREIGN KEY ("realtor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "realtor_lead_notifications" ADD CONSTRAINT "realtor_lead_notifications_realtor_claim_id_realtor_market_claims_id_fk" FOREIGN KEY ("realtor_claim_id") REFERENCES "public"."realtor_market_claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "realtor_lead_notifications" ADD CONSTRAINT "realtor_lead_notifications_realtor_user_id_users_id_fk" FOREIGN KEY ("realtor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "realtor_lead_notifications" ADD CONSTRAINT "realtor_lead_notifications_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "realtor_lead_notifications" ADD CONSTRAINT "realtor_lead_notifications_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "realtor_lead_notifications" ADD CONSTRAINT "realtor_lead_notifications_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "realtor_market_claims" ADD CONSTRAINT "realtor_market_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "realtor_market_claims" ADD CONSTRAINT "realtor_market_claims_partner_id_industry_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."industry_partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reno_quotes" ADD CONSTRAINT "reno_quotes_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_deals" ADD CONSTRAINT "saved_deals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "true_cost_breakdowns" ADD CONSTRAINT "true_cost_breakdowns_inquiry_id_true_cost_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."true_cost_inquiries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "true_cost_inquiries" ADD CONSTRAINT "true_cost_inquiries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "underwriting_notes" ADD CONSTRAINT "underwriting_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phone_verification_codes" ADD CONSTRAINT "phone_verification_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_oauth_accounts" ADD CONSTRAINT "user_oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "area_scores_geo_date_idx" ON "area_scores" USING btree ("geography_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "votes_user_target_idx" ON "votes" USING btree ("user_id","target_type","target_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");