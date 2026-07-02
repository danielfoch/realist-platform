/**
 * Power Team waitlist (FN-0 of the field-notes program).
 *
 * Pre-event deliverable: the Sept 15 "Unpacking Multiplexes" announcement CTA.
 * Professionals (planner, architect, GC, mortgage, realtor, PM, arborist) join
 * a waitlist for the field-notes program; rows are reviewed in admin and later
 * become professional_profiles (FN-1). See
 * portfolio-os/20-realist/POWER-TEAM-FIELD-NOTES-SPEC.md.
 */

import type { Express, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { isAdmin } from "./auth";

export const POWER_TEAM_ROLES = [
  "planner",
  "architect",
  "gc_builder",
  "mortgage_pro",
  "realtor",
  "property_manager",
  "arborist",
  "other",
] as const;

const waitlistSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(200),
  phone: z.string().max(30).optional(),
  roles: z.array(z.enum(POWER_TEAM_ROLES)).min(1).max(4),
  company: z.string().max(200).optional(),
  serviceAreas: z.string().max(300).optional(),
  note: z.string().max(1000).optional(),
});

async function ensureTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS power_team_waitlist (
      id            varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      name          text NOT NULL,
      email         text NOT NULL,
      phone         text,
      roles         text[] NOT NULL,
      company       text,
      service_areas text,
      note          text,
      source        text,
      user_id       varchar,
      status        text NOT NULL DEFAULT 'new',
      created_at    timestamp NOT NULL DEFAULT now(),
      UNIQUE (email)
    )
  `);
}

// Simple per-IP limiter so the open endpoint can't be spammed.
const hits = new Map<string, { day: string; count: number }>();

export function registerPowerTeamRoutes(app: Express): void {
  ensureTable().catch((err) => console.error("[power-team] ensure table failed:", err.message));

  app.post("/api/power-team/waitlist", async (req: any, res: Response) => {
    try {
      const key = req.ip || "anon";
      const day = new Date().toISOString().slice(0, 10);
      const entry = hits.get(key);
      if (entry && entry.day === day && entry.count >= 5) {
        return res.status(429).json({ error: "Too many submissions — try again tomorrow." });
      }
      hits.set(key, { day, count: entry && entry.day === day ? entry.count + 1 : 1 });

      const parsed = waitlistSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid submission", details: parsed.error.issues });
      }
      const d = parsed.data;

      await db.execute(sql`
        INSERT INTO power_team_waitlist (name, email, phone, roles, company, service_areas, note, source, user_id)
        VALUES (
          ${d.name}, ${d.email.toLowerCase()}, ${d.phone ?? null},
          ${sql.raw(`ARRAY[${d.roles.map((r) => `'${r}'`).join(",")}]::text[]`)},
          ${d.company ?? null}, ${d.serviceAreas ?? null}, ${d.note ?? null},
          ${String(req.query.source || req.body?.source || "web")},
          ${req.session?.userId ?? null}
        )
        ON CONFLICT (email) DO UPDATE SET
          name = EXCLUDED.name,
          phone = COALESCE(EXCLUDED.phone, power_team_waitlist.phone),
          roles = EXCLUDED.roles,
          company = COALESCE(EXCLUDED.company, power_team_waitlist.company),
          service_areas = COALESCE(EXCLUDED.service_areas, power_team_waitlist.service_areas),
          note = COALESCE(EXCLUDED.note, power_team_waitlist.note)
      `);

      res.json({ success: true });
    } catch (err: any) {
      console.error("[power-team] waitlist submit failed:", err.message);
      res.status(500).json({ error: "Submission failed — please try again." });
    }
  });

  app.get("/api/admin/power-team/waitlist", isAdmin, async (_req: Request, res: Response) => {
    try {
      const rows = await db.execute(sql`
        SELECT id, name, email, phone, roles, company, service_areas, note, source, status, created_at
        FROM power_team_waitlist ORDER BY created_at DESC
      `);
      res.json({ waitlist: rows.rows });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
