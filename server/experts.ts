/**
 * Expert contributor network — profiles, field notes, voting, leaderboard.
 *
 * Sits on top of the existing reputation engine: field-note votes are stored
 * in the shared `votes` table (targetType="expert_field_note") and every
 * points-worthy action writes a `contribution_events` row, so experts appear
 * on the existing /api/leaderboard/contributions AND on the category-scoped
 * leaderboard here.
 *
 * Two author tiers write field notes:
 *  - approved industry partners ("expert"): long-form notes, multiple per
 *    listing, full name + company shown (credibility is the point);
 *  - any signed-in member ("investor"): ONE short note (≤500 chars) per
 *    listing, editable, displayed as first name + last initial.
 * Voting is open to any logged-in member. When a note's net score crosses a
 * threshold (first upvote, +5, +10, first downvote) the author gets an email
 * through the notification queue (see queueFieldNoteVoteNotification).
 *
 * Moderation minimum: authors can delete their own note (status="removed"),
 * admins can hide/unhide any note (status="hidden"). No profanity filter yet
 * — deliberate v1 scope.
 */

import type { Express, Request, Response } from "express";
import "express-session";
import { z } from "zod";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "./db";
import { isAdmin, isAuthenticated } from "./auth";
import { logUserActivity } from "./userActivity";
import { queueFieldNoteLeadNotification, queueFieldNoteVoteNotification } from "./notifications";
import {
  contributionEvents,
  crmActivities,
  crmContacts,
  expertFieldNotes,
  industryPartners,
  users,
  votes,
} from "@shared/schema";
import {
  REPUTATION_POINTS,
  EXPERT_CATEGORY_LABELS,
  categoryFromPartnerType,
  computeRank,
  isExpertCategory,
} from "@shared/contributorReputation";
import { anonymizeDisplayName } from "@shared/community";
import { getTradeLeaders } from "./tradeLeaders";
import {
  resolveEndorsement,
  buildFieldNoteLeadCrm,
  type EndorsementStance,
} from "@shared/fieldNoteIncentives";
import type { VerificationStatus } from "@shared/professionalProfiles";
import {
  decideNoteVoteMilestone,
  validateFieldNoteBody,
  type FieldNoteAuthorTier,
} from "@shared/fieldNotes";

const createNoteSchema = z.object({
  listingMlsNumber: z.string().trim().min(1, "Listing is required").max(50),
  body: z.string(),
  category: z.string().optional(),
});

const editNoteSchema = z.object({ body: z.string() });

const hideNoteSchema = z.object({ hidden: z.boolean() });

const voteSchema = z.object({ value: z.number().int().min(-1).max(1) });

const endorseSchema = z.object({ stance: z.enum(["agree", "disagree"]).default("agree") });

const leadSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("A valid email is required").max(200),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().max(1000).optional(),
});

async function getSessionUser(req: Request) {
  const userId = (req as any).session?.userId;
  if (!userId) return null;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user ?? null;
}

/** Total reputation points from the shared ledger for a set of users. */
async function pointsByUser(userIds: string[]): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select({
      userId: contributionEvents.userId,
      total: sql<number>`COALESCE(SUM(${contributionEvents.points}), 0)`,
    })
    .from(contributionEvents)
    .where(inArray(contributionEvents.userId, userIds))
    .groupBy(contributionEvents.userId);
  return new Map(rows.map((r) => [r.userId, Number(r.total)]));
}

function displayName(u: { firstName: string | null; lastName: string | null; email?: string | null }): string {
  return `${u.firstName || ""} ${u.lastName || ""}`.trim() || "Realist expert";
}

// Simple per-IP daily cap for the (unauthenticated) lead CTA to blunt CRM spam.
const leadHits = new Map<string, { day: string; count: number }>();
function leadRateLimited(ip: string): boolean {
  const day = new Date().toISOString().slice(0, 10);
  const entry = leadHits.get(ip);
  if (!entry || entry.day !== day) {
    leadHits.set(ip, { day, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > 10;
}

/** FN-3 incentive tables (self-migrating; same pattern as professional_profiles). */
async function ensureFieldNoteIncentiveTables(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS field_note_endorsements (
      id                varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      note_id           varchar NOT NULL,
      endorser_user_id  varchar NOT NULL,
      stance            text NOT NULL DEFAULT 'agree',
      created_at        timestamp NOT NULL DEFAULT now(),
      UNIQUE (note_id, endorser_user_id)
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS field_note_endorsements_note_idx ON field_note_endorsements (note_id)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS field_note_leads (
      id                 varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      note_id            varchar NOT NULL,
      author_user_id     varchar NOT NULL,
      requester_user_id  varchar,
      crm_contact_id     varchar,
      listing_mls_number text,
      name               text NOT NULL,
      email              text NOT NULL,
      phone              text,
      message            text,
      created_at         timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS field_note_leads_author_idx ON field_note_leads (author_user_id)
  `);
}

/** Is this user a Power Team professional (has a claimed profile)? Endorsements are pro-only. */
async function isProfessional(userId: string): Promise<{ isPro: boolean; leadCtaEnabled: boolean }> {
  const rows = await db.execute(sql`
    SELECT lead_cta_enabled FROM professional_profiles WHERE user_id = ${userId} LIMIT 1
  `);
  const row = rows.rows[0] as { lead_cta_enabled: boolean } | undefined;
  return { isPro: !!row, leadCtaEnabled: row?.lead_cta_enabled ?? false };
}

export function registerExpertRoutes(app: Express): void {
  ensureFieldNoteIncentiveTables().catch((err) =>
    console.error("[experts] ensure FN-3 tables failed:", err?.message ?? err),
  );

  // Public directory of experts (approved + public industry partners) with
  // reputation + rank. Optional ?category= and ?market= filters.
  app.get("/api/experts", async (req: Request, res: Response) => {
    try {
      const category = typeof req.query.category === "string" ? req.query.category : null;
      const market = typeof req.query.market === "string" ? req.query.market.trim() : null;

      const rows = await db
        .select({
          userId: industryPartners.userId,
          partnerType: industryPartners.partnerType,
          companyName: industryPartners.companyName,
          bio: industryPartners.bio,
          headshotUrl: industryPartners.headshotUrl,
          serviceAreas: industryPartners.serviceAreas,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
        })
        .from(industryPartners)
        .innerJoin(users, eq(industryPartners.userId, users.id))
        .where(and(eq(industryPartners.isApproved, true), eq(industryPartners.isPublic, true)));

      const points = await pointsByUser(rows.map((r) => r.userId));

      let experts = rows.map((r) => {
        const cat = categoryFromPartnerType(r.partnerType);
        const total = points.get(r.userId) ?? 0;
        return {
          userId: r.userId,
          name: displayName(r),
          category: cat,
          partnerType: r.partnerType,
          companyName: r.companyName,
          bio: r.bio,
          headshotUrl: r.headshotUrl || r.profileImageUrl || null,
          serviceAreas: r.serviceAreas || [],
          points: total,
          rank: computeRank(total).tier,
        };
      });

      if (category && isExpertCategory(category)) experts = experts.filter((e) => e.category === category);
      if (market) {
        const m = market.toLowerCase();
        experts = experts.filter((e) => (e.serviceAreas || []).some((area) => area.toLowerCase().includes(m)));
      }
      experts.sort((a, b) => b.points - a.points);
      res.json(experts);
    } catch (error) {
      console.error("[experts] directory failed:", error);
      res.status(500).json({ error: "Failed to load experts" });
    }
  });

  // Category leaderboard: experts ranked by reputation within a category.
  app.get("/api/experts/leaderboard", async (req: Request, res: Response) => {
    try {
      const category = typeof req.query.category === "string" ? req.query.category : null;
      const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

      const rows = await db
        .select({
          userId: industryPartners.userId,
          partnerType: industryPartners.partnerType,
          companyName: industryPartners.companyName,
          headshotUrl: industryPartners.headshotUrl,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
        })
        .from(industryPartners)
        .innerJoin(users, eq(industryPartners.userId, users.id))
        .where(and(eq(industryPartners.isApproved, true), eq(industryPartners.isPublic, true)));

      const points = await pointsByUser(rows.map((r) => r.userId));
      let ranked = rows
        .map((r) => ({
          userId: r.userId,
          name: displayName(r),
          category: categoryFromPartnerType(r.partnerType),
          companyName: r.companyName,
          headshotUrl: r.headshotUrl || r.profileImageUrl || null,
          points: points.get(r.userId) ?? 0,
          rank: computeRank(points.get(r.userId) ?? 0).tier,
        }))
        .filter((r) => (category && isExpertCategory(category) ? r.category === category : true))
        .sort((a, b) => b.points - a.points)
        .slice(0, limit);

      res.json(ranked.map((r, i) => ({ ...r, position: i + 1 })));
    } catch (error) {
      console.error("[experts] leaderboard failed:", error);
      res.status(500).json({ error: "Failed to load leaderboard" });
    }
  });

  // Per-trade leaderboard: top contributors PER category over a 30-day window,
  // ranked by notes + endorsements, badged with FN-1 verification tier. One call
  // powers the "Power Team leaders" surface (complements the all-time
  // /api/experts/leaderboard?category=).
  app.get("/api/leaderboard/by-trade", async (_req: Request, res: Response) => {
    try {
      res.json({ windowDays: 30, byTrade: await getTradeLeaders(5) });
    } catch (error) {
      console.error("[experts] by-trade leaderboard failed:", error);
      res.status(500).json({ error: "Failed to load per-trade leaderboard" });
    }
  });

  // Public expert profile: partner info + reputation + their field notes.
  app.get("/api/experts/:userId", async (req: Request, res: Response) => {
    try {
      const [partner] = await db
        .select({
          userId: industryPartners.userId,
          partnerType: industryPartners.partnerType,
          companyName: industryPartners.companyName,
          licenseNumber: industryPartners.licenseNumber,
          bio: industryPartners.bio,
          headshotUrl: industryPartners.headshotUrl,
          serviceAreas: industryPartners.serviceAreas,
          socialLinks: industryPartners.socialLinks,
          publicEmail: industryPartners.publicEmail,
          phone: industryPartners.phone,
          isPublic: industryPartners.isPublic,
          isApproved: industryPartners.isApproved,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
        })
        .from(industryPartners)
        .innerJoin(users, eq(industryPartners.userId, users.id))
        .where(eq(industryPartners.userId, req.params.userId))
        .limit(1);

      if (!partner || !partner.isPublic || !partner.isApproved) {
        return res.status(404).json({ error: "Expert not found" });
      }

      const notes = await db
        .select()
        .from(expertFieldNotes)
        .where(and(eq(expertFieldNotes.userId, partner.userId), eq(expertFieldNotes.status, "visible")))
        .orderBy(desc(expertFieldNotes.score), desc(expertFieldNotes.createdAt))
        .limit(100);

      const total = (await pointsByUser([partner.userId])).get(partner.userId) ?? 0;
      const dealsContributed = new Set(notes.map((n) => n.listingMlsNumber)).size;

      res.json({
        userId: partner.userId,
        name: displayName(partner),
        category: categoryFromPartnerType(partner.partnerType),
        partnerType: partner.partnerType,
        companyName: partner.companyName,
        bio: partner.bio,
        headshotUrl: partner.headshotUrl || partner.profileImageUrl || null,
        serviceAreas: partner.serviceAreas || [],
        socialLinks: partner.socialLinks || null,
        publicEmail: partner.publicEmail || null,
        phone: partner.phone || null,
        licenseNumber: partner.licenseNumber || null,
        points: total,
        rank: computeRank(total),
        stats: { fieldNotes: notes.length, dealsContributed },
        fieldNotes: notes.map((n) => ({
          id: n.id,
          listingMlsNumber: n.listingMlsNumber,
          category: n.category,
          body: n.body,
          score: n.score,
          createdAt: n.createdAt,
        })),
      });
    } catch (error) {
      console.error("[experts] profile failed:", error);
      res.status(500).json({ error: "Failed to load expert" });
    }
  });

  // Field notes for a listing, with author + rank + the caller's own vote.
  app.get("/api/listings/:mlsNumber/field-notes", async (req: Request, res: Response) => {
    try {
      const rows = await db
        .select({
          note: expertFieldNotes,
          partnerType: industryPartners.partnerType,
          companyName: industryPartners.companyName,
          headshotUrl: industryPartners.headshotUrl,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
        })
        .from(expertFieldNotes)
        .innerJoin(users, eq(expertFieldNotes.userId, users.id))
        .leftJoin(industryPartners, eq(industryPartners.userId, expertFieldNotes.userId))
        .where(and(eq(expertFieldNotes.listingMlsNumber, req.params.mlsNumber), eq(expertFieldNotes.status, "visible")))
        .orderBy(desc(expertFieldNotes.score), desc(expertFieldNotes.createdAt));

      const sessionUser = await getSessionUser(req);
      const myVotes = new Map<string, number>();
      if (sessionUser && rows.length) {
        const voteRows = await db
          .select({ targetId: votes.targetId, value: votes.value })
          .from(votes)
          .where(
            and(
              eq(votes.userId, sessionUser.id),
              eq(votes.targetType, "expert_field_note"),
              inArray(votes.targetId, rows.map((r) => r.note.id)),
            ),
          );
        for (const v of voteRows) myVotes.set(v.targetId, v.value);
      }

      // FN-2: badge each author with their professional-profile verification tier
      // (professional_profiles is self-migrating / not a Drizzle table — raw lookup,
      // same pattern as /api/leaderboard/by-trade).
      const authorIds = [...new Set(rows.map((r) => r.note.userId))];
      const verifiedById = new Map<string, VerificationStatus>();
      const leadCtaById = new Map<string, boolean>();
      if (authorIds.length) {
        const profs = await db.execute(sql`
          SELECT user_id, verification_status, lead_cta_enabled
          FROM professional_profiles WHERE user_id = ANY(${authorIds})
        `);
        for (const p of profs.rows as Array<{ user_id: string; verification_status: string; lead_cta_enabled: boolean }>) {
          verifiedById.set(p.user_id, p.verification_status as VerificationStatus);
          leadCtaById.set(p.user_id, p.lead_cta_enabled);
        }
      }

      // FN-3: per-note professional endorsement tallies (+ the viewer's own stance).
      const noteIds = rows.map((r) => r.note.id);
      const agreeById = new Map<string, number>();
      const disagreeById = new Map<string, number>();
      const myEndorsementById = new Map<string, EndorsementStance>();
      if (noteIds.length) {
        const tallies = await db.execute(sql`
          SELECT note_id,
                 COUNT(*) FILTER (WHERE stance = 'agree')::int AS agree,
                 COUNT(*) FILTER (WHERE stance = 'disagree')::int AS disagree
          FROM field_note_endorsements WHERE note_id = ANY(${noteIds}) GROUP BY note_id
        `);
        for (const t of tallies.rows as Array<{ note_id: string; agree: number; disagree: number }>) {
          agreeById.set(t.note_id, Number(t.agree));
          disagreeById.set(t.note_id, Number(t.disagree));
        }
        if (sessionUser) {
          const mine = await db.execute(sql`
            SELECT note_id, stance FROM field_note_endorsements
            WHERE endorser_user_id = ${sessionUser.id} AND note_id = ANY(${noteIds})
          `);
          for (const m of mine.rows as Array<{ note_id: string; stance: string }>) {
            myEndorsementById.set(m.note_id, m.stance as EndorsementStance);
          }
        }
      }

      const notes = rows.map((r) => {
        // Partner-authored notes show the expert's full name + company;
        // member notes show first name + last initial only.
        const isExpertNote = Boolean(r.partnerType);
        return {
          id: r.note.id,
          userId: r.note.userId,
          authorName: isExpertNote ? displayName(r) : anonymizeDisplayName(r.firstName, r.lastName, "Realist investor"),
          authorCompany: isExpertNote ? r.companyName : null,
          authorHeadshot: r.headshotUrl || r.profileImageUrl || null,
          category: r.note.category,
          isExpert: isExpertNote,
          verificationStatus: verifiedById.get(r.note.userId) ?? null,
          rank: computeRank(0).tier, // per-note rank badge filled client-side from profile if needed
          body: r.note.body,
          score: r.note.score,
          myVote: myVotes.get(r.note.id) ?? 0,
          endorsements: { agree: agreeById.get(r.note.id) ?? 0, disagree: disagreeById.get(r.note.id) ?? 0 },
          myEndorsement: myEndorsementById.get(r.note.id) ?? null,
          // Only expert-authored notes with the CTA left on can be lead sources.
          leadCtaEnabled: isExpertNote && (leadCtaById.get(r.note.userId) ?? false),
          createdAt: r.note.createdAt,
          updatedAt: r.note.updatedAt,
        };
      });
      // Rank verified-pro notes above the rest; the DB already ordered by score,
      // and this stable sort preserves that within each tier.
      const verifiedRank = (s: string | null) => (s === "verified" ? 0 : 1);
      notes.sort((a, b) => verifiedRank(a.verificationStatus) - verifiedRank(b.verificationStatus));
      res.json(notes);
    } catch (error) {
      console.error("[experts] list field notes failed:", error);
      res.status(500).json({ error: "Failed to load field notes" });
    }
  });

  // Add a field note. Approved industry partners write long-form expert notes
  // (multiple per listing); any other signed-in member gets ONE short note per
  // listing (editable via PATCH below).
  app.post("/api/listings/:mlsNumber/field-notes", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.session.userId as string;
      const [partner] = await db
        .select()
        .from(industryPartners)
        .where(eq(industryPartners.userId, userId))
        .limit(1);
      const isExpert = Boolean(partner?.isApproved);
      const tier: FieldNoteAuthorTier = isExpert ? "expert" : "member";

      const parsed = createNoteSchema.safeParse({ ...req.body, listingMlsNumber: req.params.mlsNumber });
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid note" });
      }
      const validated = validateFieldNoteBody(parsed.data.body, tier);
      if (!validated.ok) {
        return res.status(400).json({ error: validated.error });
      }

      if (!isExpert) {
        const [existing] = await db
          .select({ id: expertFieldNotes.id })
          .from(expertFieldNotes)
          .where(
            and(
              eq(expertFieldNotes.userId, userId),
              eq(expertFieldNotes.listingMlsNumber, parsed.data.listingMlsNumber),
              // "removed" notes free the slot; hidden notes keep it occupied
              // so moderation can't be sidestepped by re-posting.
              ne(expertFieldNotes.status, "removed"),
            ),
          )
          .limit(1);
        if (existing) {
          return res.status(409).json({
            error: "You already have a field note on this listing — edit it instead",
            noteId: existing.id,
          });
        }
      }

      const category = isExpert
        ? (parsed.data.category && isExpertCategory(parsed.data.category)
            ? parsed.data.category
            : categoryFromPartnerType(partner!.partnerType))
        : "investor";

      const [note] = await db
        .insert(expertFieldNotes)
        .values({
          userId,
          listingMlsNumber: parsed.data.listingMlsNumber,
          category,
          body: validated.body,
        })
        .returning();

      await db.insert(contributionEvents).values({
        userId,
        type: "field_note_added",
        points: REPUTATION_POINTS.fieldNoteAdded,
        targetType: "expert_field_note",
        targetId: note.id,
      });

      logUserActivity(req, {
        userId,
        eventName: "expert.field_note_added",
        source: "experts",
        listingKey: parsed.data.listingMlsNumber,
        metadata: { noteId: note.id, category },
      }).catch((err) => console.error("field note activity log failed:", err));

      res.status(201).json(note);
    } catch (error) {
      console.error("[experts] create field note failed:", error);
      res.status(500).json({ error: "Failed to add field note" });
    }
  });

  // Vote on a field note (any logged-in member; one vote per user per note).
  app.post("/api/field-notes/:id/vote", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.session.userId as string;
      const parsed = voteSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid vote" });

      const [note] = await db.select().from(expertFieldNotes).where(eq(expertFieldNotes.id, req.params.id)).limit(1);
      if (!note || note.status !== "visible") return res.status(404).json({ error: "Field note not found" });
      if (note.userId === userId) return res.status(400).json({ error: "You can't vote on your own note" });

      const [existing] = await db
        .select()
        .from(votes)
        .where(and(eq(votes.userId, userId), eq(votes.targetType, "expert_field_note"), eq(votes.targetId, note.id)))
        .limit(1);
      const oldValue = existing?.value ?? 0;
      const newValue = parsed.data.value;
      const delta = newValue - oldValue;

      if (delta !== 0) {
        if (existing) {
          await db.update(votes).set({ value: newValue }).where(eq(votes.id, existing.id));
        } else {
          await db.insert(votes).values({ userId, targetType: "expert_field_note", targetId: note.id, value: newValue });
        }
        const [updated] = await db
          .update(expertFieldNotes)
          .set({ score: sql`${expertFieldNotes.score} + ${delta}`, updatedAt: new Date() })
          .where(eq(expertFieldNotes.id, note.id))
          .returning();

        // Reward the author through the shared ledger so they climb the
        // leaderboard. Points scale with the vote delta so toggling a vote
        // on/off nets to zero over time (upvote=+2 each, downvote=-1 each).
        const authorPoints =
          delta > 0
            ? REPUTATION_POINTS.fieldNoteUpvoteReceived * delta
            : REPUTATION_POINTS.fieldNoteDownvoteReceived * Math.abs(delta);
        await db.insert(contributionEvents).values({
          userId: note.userId,
          type: delta > 0 ? "field_note_upvote_received" : "field_note_downvote_received",
          points: authorPoints,
          targetType: "expert_field_note",
          targetId: note.id,
        });

        // Notify the author when the net score crosses a threshold (first
        // upvote, +5, +10, first downvote). Fire-and-forget: the queue layer
        // handles consent + one-email-per-note-per-day batching.
        const milestone = decideNoteVoteMilestone(note.score, updated.score);
        if (milestone) {
          queueFieldNoteVoteNotification({ note: updated, milestone, newScore: updated.score })
            .catch((err) => console.error("[experts] note vote notification failed:", err));
        }

        return res.json({ score: updated.score, myVote: newValue });
      }
      return res.json({ score: note.score, myVote: newValue });
    } catch (error) {
      console.error("[experts] vote failed:", error);
      res.status(500).json({ error: "Failed to record vote" });
    }
  });

  // FN-3: professional peer endorsement (agree/disagree). Pro-only — a Power
  // Team professional vouching for another's note. Distinct from member votes:
  // it doesn't touch `score`, it rewards the author through the shared ledger
  // and is surfaced as its own trust signal (and ML label).
  app.post("/api/field-notes/:id/endorse", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.session.userId as string;
      const parsed = endorseSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid endorsement" });
      const incoming = parsed.data.stance as EndorsementStance;

      const [note] = await db.select().from(expertFieldNotes).where(eq(expertFieldNotes.id, req.params.id)).limit(1);
      if (!note || note.status !== "visible") return res.status(404).json({ error: "Field note not found" });
      if (note.userId === userId) return res.status(400).json({ error: "You can't endorse your own note" });

      const { isPro } = await isProfessional(userId);
      if (!isPro) return res.status(403).json({ error: "Only Power Team professionals can endorse notes" });

      const existingRows = await db.execute(sql`
        SELECT stance FROM field_note_endorsements WHERE note_id = ${note.id} AND endorser_user_id = ${userId} LIMIT 1
      `);
      const existing = (existingRows.rows[0] as { stance: string } | undefined)?.stance as EndorsementStance | undefined;
      const resolution = resolveEndorsement(existing ?? null, incoming);

      if (resolution.action === "removed") {
        await db.execute(sql`DELETE FROM field_note_endorsements WHERE note_id = ${note.id} AND endorser_user_id = ${userId}`);
      } else {
        await db.execute(sql`
          INSERT INTO field_note_endorsements (note_id, endorser_user_id, stance)
          VALUES (${note.id}, ${userId}, ${incoming})
          ON CONFLICT (note_id, endorser_user_id) DO UPDATE SET stance = EXCLUDED.stance, created_at = now()
        `);
      }

      // Reward the author through the same ledger the votes use (agree only).
      if (resolution.authorPointsDelta !== 0) {
        await db.insert(contributionEvents).values({
          userId: note.userId,
          type: "field_note_endorsement_received",
          points: resolution.authorPointsDelta,
          targetType: "expert_field_note",
          targetId: note.id,
        });
      }

      const tally = await db.execute(sql`
        SELECT COUNT(*) FILTER (WHERE stance = 'agree')::int AS agree,
               COUNT(*) FILTER (WHERE stance = 'disagree')::int AS disagree
        FROM field_note_endorsements WHERE note_id = ${note.id}
      `);
      const counts = tally.rows[0] as { agree: number; disagree: number };
      return res.json({
        endorsements: { agree: Number(counts.agree), disagree: Number(counts.disagree) },
        myEndorsement: resolution.newStance,
      });
    } catch (error) {
      console.error("[experts] endorse failed:", error);
      res.status(500).json({ error: "Failed to record endorsement" });
    }
  });

  // FN-3: lead CTA — "work with this pro" turns into a crm_contacts lead owned
  // by the note's author (a Power Team pro), attributed to the exact note +
  // listing. Same handoff shape as the partner-network lead capture (PR #43).
  app.post("/api/field-notes/:id/lead", async (req: any, res: Response) => {
    try {
      if (leadRateLimited(req.ip || "anon")) {
        return res.status(429).json({ error: "Too many requests — try again tomorrow." });
      }
      const parsed = leadSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
      const { name, email, phone, message } = parsed.data;

      const [note] = await db.select().from(expertFieldNotes).where(eq(expertFieldNotes.id, req.params.id)).limit(1);
      if (!note || note.status !== "visible") return res.status(404).json({ error: "Field note not found" });

      const author = await isProfessional(note.userId);
      if (!author.isPro || !author.leadCtaEnabled) {
        return res.status(403).json({ error: "This author isn't accepting leads" });
      }
      const requesterUserId = (req.session?.userId as string | undefined) ?? null;
      if (requesterUserId && requesterUserId === note.userId) {
        return res.status(400).json({ error: "You can't request to work with yourself" });
      }

      const categoryLabel = isExpertCategory(note.category) ? EXPERT_CATEGORY_LABELS[note.category] : "professional";
      const mapping = buildFieldNoteLeadCrm(
        { noteId: note.id, listingMlsNumber: note.listingMlsNumber, category: note.category, message },
        categoryLabel,
      );

      // Upsert the contact under the author's CRM (dedupe by owner + email).
      let [contact] = await db
        .select()
        .from(crmContacts)
        .where(and(eq(crmContacts.ownerUserId, note.userId), eq(crmContacts.email, email)))
        .limit(1);
      if (!contact) {
        [contact] = await db
          .insert(crmContacts)
          .values({
            ownerUserId: note.userId,
            linkedUserId: requesterUserId,
            name,
            email,
            phone: phone ?? null,
            contactType: "investor",
            stage: "new",
            source: mapping.source,
            sourceDetail: mapping.sourceDetail,
            tags: mapping.tags,
            consentEmail: true, // the requester is asking to be contacted
            data: mapping.data,
          })
          .returning();
      }

      await db.insert(crmActivities).values({
        contactId: contact.id,
        userId: note.userId,
        kind: "system",
        body: mapping.activityBody,
        metadata: mapping.data,
      });

      await db.execute(sql`
        INSERT INTO field_note_leads
          (note_id, author_user_id, requester_user_id, crm_contact_id, listing_mls_number, name, email, phone, message)
        VALUES (${note.id}, ${note.userId}, ${requesterUserId}, ${contact.id}, ${note.listingMlsNumber},
                ${name}, ${email}, ${phone ?? null}, ${message ?? null})
      `);

      logUserActivity(req, {
        userId: requesterUserId ?? note.userId,
        eventName: "field_note_lead_submitted",
        source: "field_note",
        metadata: { noteId: note.id, authorUserId: note.userId, crmContactId: contact.id, listingMlsNumber: note.listingMlsNumber },
      });

      // Tell the pro a lead landed (email + in-app inbox). Fire-and-forget:
      // the lead is already captured in the CRM; a notification hiccup must
      // not fail the request.
      queueFieldNoteLeadNotification({
        note,
        leadName: name,
        leadEmail: email,
        message,
        crmContactId: contact.id,
      }).catch((err) => console.error("[experts] field-note lead notification failed:", err));

      return res.json({ ok: true });
    } catch (error) {
      console.error("[experts] field-note lead failed:", error);
      res.status(500).json({ error: "Failed to submit request" });
    }
  });

  // Edit a field note (author only). Members keep their single editable note
  // current; experts can fix theirs too. Tier limits re-apply on edit.
  app.patch("/api/field-notes/:id", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.session.userId as string;
      const parsed = editNoteSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid note" });

      const [note] = await db.select().from(expertFieldNotes).where(eq(expertFieldNotes.id, req.params.id)).limit(1);
      if (!note || note.status !== "visible") return res.status(404).json({ error: "Field note not found" });
      if (note.userId !== userId) return res.status(403).json({ error: "You can only edit your own note" });

      const [partner] = await db
        .select({ isApproved: industryPartners.isApproved })
        .from(industryPartners)
        .where(eq(industryPartners.userId, userId))
        .limit(1);
      const tier: FieldNoteAuthorTier = partner?.isApproved ? "expert" : "member";
      const validated = validateFieldNoteBody(parsed.data.body, tier);
      if (!validated.ok) return res.status(400).json({ error: validated.error });

      const [updated] = await db
        .update(expertFieldNotes)
        .set({ body: validated.body, updatedAt: new Date() })
        .where(eq(expertFieldNotes.id, note.id))
        .returning();
      res.json(updated);
    } catch (error) {
      console.error("[experts] edit field note failed:", error);
      res.status(500).json({ error: "Failed to update field note" });
    }
  });

  // Admin moderation: hide/unhide a note without deleting it. (Deliberately
  // no profanity filter in v1 — hide + author delete is the moderation
  // minimum.)
  app.post("/api/field-notes/:id/hide", isAdmin, async (req: any, res: Response) => {
    try {
      const parsed = hideNoteSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Expected { hidden: boolean }" });

      const [note] = await db.select().from(expertFieldNotes).where(eq(expertFieldNotes.id, req.params.id)).limit(1);
      if (!note || note.status === "removed") return res.status(404).json({ error: "Field note not found" });

      const [updated] = await db
        .update(expertFieldNotes)
        .set({ status: parsed.data.hidden ? "hidden" : "visible", updatedAt: new Date() })
        .where(eq(expertFieldNotes.id, note.id))
        .returning();
      res.json({ id: updated.id, status: updated.status });
    } catch (error) {
      console.error("[experts] hide field note failed:", error);
      res.status(500).json({ error: "Failed to moderate field note" });
    }
  });

  // Remove a field note (author or admin).
  app.delete("/api/field-notes/:id", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.session.userId as string;
      const [note] = await db.select().from(expertFieldNotes).where(eq(expertFieldNotes.id, req.params.id)).limit(1);
      if (!note) return res.status(404).json({ error: "Field note not found" });
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (note.userId !== userId && user?.role !== "admin") return res.status(403).json({ error: "Not allowed" });

      await db
        .update(expertFieldNotes)
        .set({ status: "removed", updatedAt: new Date() })
        .where(eq(expertFieldNotes.id, note.id));
      res.json({ success: true });
    } catch (error) {
      console.error("[experts] delete field note failed:", error);
      res.status(500).json({ error: "Failed to remove field note" });
    }
  });
}
