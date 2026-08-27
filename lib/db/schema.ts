/**
 * Single drizzle schema for the platform, assembled from per-domain partials.
 * Add tables in the domain file, re-export here — nothing else imports the
 * partials directly.
 */

export * from "./schema/podcast";
export * from "./schema/listings";
export * from "./schema/distress";
export * from "./schema/multiplex";
export * from "./schema/community";
