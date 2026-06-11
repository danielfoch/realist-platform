-- Deal Desk Admin Notes v1
-- Adds admin_notes column to opportunities for internal team notes.

ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "admin_notes" text;
