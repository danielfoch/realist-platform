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
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { users } from "@shared/schema";
import { isAdmin, isAuthenticated } from "./auth";
import {
  POWER_TEAM_ROLES,
  claimProfileSchema,
  verifyDecisionSchema,
  deriveSubmissionStatus,
  type VerificationStatus,
} from "@shared/professionalProfiles";

export { POWER_TEAM_ROLES };

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
  // FN-1: professional profiles claimed by signed-in pros (one per user).
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS professional_profiles (
      id                  varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id             varchar NOT NULL UNIQUE,
      roles               text[] NOT NULL,
      company             text,
      bio                 text,
      service_areas       text[] NOT NULL DEFAULT '{}',
      licence_body        text,
      licence_number      text,
      verification_status text NOT NULL DEFAULT 'unverified',
      verified_at         timestamp,
      admin_notes         text,
      lead_cta_enabled    boolean NOT NULL DEFAULT true,
      created_at          timestamp NOT NULL DEFAULT now(),
      updated_at          timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS professional_profiles_status_idx
    ON professional_profiles (verification_status)
  `);
}

const pgTextArray = (values: string[]) =>
  sql.raw(`ARRAY[${values.map((v) => `'${v.replace(/'/g, "''")}'`).join(",")}]::text[]`);

function mapProfileRow(r: Record<string, any>) {
  return {
    id: r.id,
    userId: r.user_id,
    roles: (r.roles ?? []) as string[],
    company: r.company ?? null,
    bio: r.bio ?? null,
    serviceAreas: (r.service_areas ?? []) as string[],
    licenceBody: r.licence_body ?? null,
    licenceNumber: r.licence_number ?? null,
    verificationStatus: r.verification_status as VerificationStatus,
    verifiedAt: r.verified_at ?? null,
    leadCtaEnabled: !!r.lead_cta_enabled,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
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

  // ─── FN-1: professional profiles ───────────────────────────────────────────

  // Claim / update your own professional profile. Submitting a licence moves
  // the profile into the verification queue; without one it stays unverified
  // but can still post notes (open-with-badges).
  app.post("/api/power-team/claim", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.session.userId as string;
      const parsed = claimProfileSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid profile", details: parsed.error.issues });
      const d = parsed.data;

      const [existing] = (
        await db.execute(sql`SELECT verification_status FROM professional_profiles WHERE user_id = ${userId} LIMIT 1`)
      ).rows as Array<{ verification_status: VerificationStatus }>;
      const status = deriveSubmissionStatus({
        licenceBody: d.licenceBody,
        licenceNumber: d.licenceNumber,
        currentStatus: existing?.verification_status,
      });

      await db.execute(sql`
        INSERT INTO professional_profiles
          (user_id, roles, company, bio, service_areas, licence_body, licence_number, verification_status, lead_cta_enabled, updated_at)
        VALUES (${userId}, ${pgTextArray(d.roles)}, ${d.company ?? null}, ${d.bio ?? null}, ${pgTextArray(d.serviceAreas)},
                ${d.licenceBody ?? null}, ${d.licenceNumber ?? null}, ${status}, ${d.leadCtaEnabled}, now())
        ON CONFLICT (user_id) DO UPDATE SET
          roles = EXCLUDED.roles,
          company = EXCLUDED.company,
          bio = EXCLUDED.bio,
          service_areas = EXCLUDED.service_areas,
          licence_body = EXCLUDED.licence_body,
          licence_number = EXCLUDED.licence_number,
          verification_status = EXCLUDED.verification_status,
          lead_cta_enabled = EXCLUDED.lead_cta_enabled,
          updated_at = now()
      `);

      // Link any matching waitlist row (FN-0 → FN-1) so it drops out of the "new" queue.
      const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
      if (u?.email) {
        await db.execute(sql`
          UPDATE power_team_waitlist SET status = 'claimed', user_id = ${userId}
          WHERE lower(email) = ${u.email.toLowerCase()} AND status <> 'claimed'
        `);
      }

      const [row] = (await db.execute(sql`SELECT * FROM professional_profiles WHERE user_id = ${userId} LIMIT 1`)).rows;
      res.json({ success: true, profile: mapProfileRow(row as Record<string, any>) });
    } catch (err: any) {
      console.error("[power-team] claim failed:", err.message);
      res.status(500).json({ error: "Could not save your profile — please try again." });
    }
  });

  app.get("/api/power-team/profile", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.session.userId as string;
    const rows = (await db.execute(sql`SELECT * FROM professional_profiles WHERE user_id = ${userId} LIMIT 1`)).rows;
    res.json({ profile: rows.length ? mapProfileRow(rows[0] as Record<string, any>) : null });
  });

  // Public profile view — licence NUMBER is never exposed, only body + tier.
  app.get("/api/power-team/profiles/:userId", async (req: Request, res: Response) => {
    const rows = (
      await db.execute(sql`
        SELECT id, user_id, roles, company, bio, service_areas, licence_body, verification_status, verified_at,
               lead_cta_enabled, created_at, updated_at
        FROM professional_profiles WHERE user_id = ${req.params.userId} LIMIT 1
      `)
    ).rows;
    if (!rows.length) return res.status(404).json({ error: "Profile not found" });
    res.json({ profile: mapProfileRow(rows[0] as Record<string, any>) });
  });

  app.get("/api/admin/power-team/profiles", isAdmin, async (req: Request, res: Response) => {
    const status = typeof req.query.status === "string" ? req.query.status : null;
    const rows = status
      ? await db.execute(sql`SELECT * FROM professional_profiles WHERE verification_status = ${status} ORDER BY updated_at DESC`)
      : await db.execute(sql`SELECT * FROM professional_profiles ORDER BY updated_at DESC`);
    res.json({ profiles: (rows.rows as Array<Record<string, any>>).map(mapProfileRow) });
  });

  app.post("/api/admin/power-team/profiles/:id/verify", isAdmin, async (req: Request, res: Response) => {
    const parsed = verifyDecisionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid decision", details: parsed.error.issues });
    const { decision, adminNotes } = parsed.data;
    const rows = (
      await db.execute(sql`
        UPDATE professional_profiles
        SET verification_status = ${decision},
            verified_at = ${decision === "verified" ? sql`now()` : sql`NULL`},
            admin_notes = ${adminNotes ?? null},
            updated_at = now()
        WHERE id = ${req.params.id}
        RETURNING *
      `)
    ).rows;
    if (!rows.length) return res.status(404).json({ error: "Profile not found" });
    res.json({ success: true, profile: mapProfileRow(rows[0] as Record<string, any>) });
  });
}
