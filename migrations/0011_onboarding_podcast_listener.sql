ALTER TABLE "investor_profiles" ADD COLUMN IF NOT EXISTS "podcast_listener" boolean;--> statement-breakpoint
ALTER TABLE "professional_subscriptions" ADD COLUMN IF NOT EXISTS "podcast_listener" boolean;
