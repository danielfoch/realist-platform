/**
 * Property question forum.
 *
 * V1 uses the existing listing_comments table instead of inventing a second
 * forum model: top-level rows with thread_type="question" are public property
 * questions, and child rows with thread_type="answer" are expert/community
 * replies. That keeps comments, moderation, reputation, and listing context in
 * one place.
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { and, desc, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { db } from "./db";
import { isAuthenticated } from "./auth";
import { sendNotificationEmail } from "./resend";
import {
  contributionEvents,
  industryPartners,
  listingComments,
  notificationPreferences,
  propertyQuestionEvents,
  propertyQuestionSignals,
  users,
} from "@shared/schema";
import { logUserActivity } from "./userActivity";
import { anonymizeDisplayName, sanitizeUserText, truncateText } from "@shared/community";
import {
  categoryFromPartnerType,
  EXPERT_CATEGORY_LABELS,
  isExpertCategory,
  type ExpertCategory,
} from "@shared/contributorReputation";

const ASKABLE_EXPERT_CATEGORIES = [
  "architecture",
  "urban_planning",
  "mortgage",
  "legal",
  "accounting_tax",
  "property_management",
  "construction",
  "appraisal",
  "inspection",
  "realtor",
] as const satisfies readonly ExpertCategory[];

const askQuestionSchema = z.object({
  listingMlsNumber: z.string().trim().min(1).max(80),
  body: z.string().trim().min(8).max(1000),
  requestedExpertCategories: z.array(z.string()).max(6).default([]),
  listingSnapshot: z.record(z.unknown()).optional(),
});

const answerQuestionSchema = z.object({
  body: z.string().trim().min(3).max(2000),
  expertCategory: z.string().optional(),
});

const updateStatusSchema = z.object({
  questionStatus: z.enum(["open", "answered", "resolved"]),
});

type QuestionRow = typeof listingComments.$inferSelect & {
  userFirstName?: string | null;
  userLastName?: string | null;
  answerCount?: number | string | null;
};

type ListingSnapshot = Record<string, unknown> | null | undefined;

function getSessionUserId(req: Request): string | null {
  return (req as any).session?.userId ?? null;
}

function normalizeCategories(input: string[]): ExpertCategory[] {
  const seen = new Set<string>();
  const categories: ExpertCategory[] = [];
  for (const raw of input) {
    if (!isExpertCategory(raw)) continue;
    if (!ASKABLE_EXPERT_CATEGORIES.includes(raw as (typeof ASKABLE_EXPERT_CATEGORIES)[number])) continue;
    if (seen.has(raw)) continue;
    seen.add(raw);
    categories.push(raw);
  }
  return categories.slice(0, 6);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,\s]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function priceToCents(value: unknown): number | null {
  const dollars = asNumber(value);
  return dollars === null ? null : Math.round(dollars * 100);
}

function getSnapshotValue(snapshot: ListingSnapshot, keys: string[]): unknown {
  if (!snapshot) return null;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(snapshot, key)) return snapshot[key];
  }
  return null;
}

function normalizeQuestionText(body: string): string {
  return body.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 500);
}

function inferQuestionIntent(body: string, categories: ExpertCategory[]): string {
  const text = body.toLowerCase();
  if (categories.includes("urban_planning") || /\b(zoning|by-?law|planning|variance|severance|permit|density|setback)\b/.test(text)) return "zoning_planning";
  if (categories.includes("architecture") || /\b(layout|design|addition|floor plan|convert|suite|garden suite|laneway)\b/.test(text)) return "design_feasibility";
  if (categories.includes("mortgage") || /\b(mortgage|financing|rate|loan|dscr|mli|cmhc|debt)\b/.test(text)) return "financing";
  if (categories.includes("legal") || /\b(legal|title|easement|contract|clause|liability|tenant right)\b/.test(text)) return "legal";
  if (categories.includes("accounting_tax") || /\b(tax|hst|capital gain|deduct|expense|corporation|incorporate)\b/.test(text)) return "tax";
  if (categories.includes("construction") || /\b(build|renovation|repair|cost|contractor|foundation|structural)\b/.test(text)) return "construction";
  if (categories.includes("inspection") || /\b(inspect|condition|roof|foundation|mould|electrical|plumbing)\b/.test(text)) return "condition";
  if (categories.includes("property_management") || /\b(rent|tenant|vacancy|turnover|management)\b/.test(text)) return "operations";
  if (categories.includes("realtor") || /\b(offer|comps|price|sold|neighbourhood|market|showing)\b/.test(text)) return "market_execution";
  return "general";
}

function structuredListingSnapshot(snapshot: ListingSnapshot) {
  return {
    address: asString(getSnapshotValue(snapshot, ["address", "streetAddress", "unparsedAddress"])),
    city: asString(getSnapshotValue(snapshot, ["city", "City"])),
    province: asString(getSnapshotValue(snapshot, ["province", "stateOrProvince", "StateOrProvince"])),
    postalCode: asString(getSnapshotValue(snapshot, ["postalCode", "PostalCode"])),
    propertyType: asString(getSnapshotValue(snapshot, ["propertyType", "PropertyType", "type"])),
    priceCents: priceToCents(getSnapshotValue(snapshot, ["price", "listPrice", "ListPrice", "purchasePrice"])),
    bedrooms: asNumber(getSnapshotValue(snapshot, ["beds", "bedrooms", "BedroomsTotal"])),
    bathrooms: asNumber(getSnapshotValue(snapshot, ["baths", "bathrooms", "BathroomsTotalInteger"])),
    latitude: asNumber(getSnapshotValue(snapshot, ["latitude", "Latitude", "lat"])),
    longitude: asNumber(getSnapshotValue(snapshot, ["longitude", "Longitude", "lng", "lon"])),
    listingKey: asString(getSnapshotValue(snapshot, ["listingKey", "ListingKey", "listingId", "id"])),
  };
}

function eventLatencySeconds(createdAt: Date | string | null | undefined): number | null {
  if (!createdAt) return null;
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return null;
  return Math.max(0, Math.round((Date.now() - created) / 1000));
}

function displayName(row: { userFirstName?: string | null; userLastName?: string | null }): string {
  return anonymizeDisplayName(row.userFirstName, row.userLastName, "Realist member");
}

function shapeQuestion(row: QuestionRow, answers: Array<QuestionRow> = []) {
  const categories = Array.isArray(row.requestedExpertCategories)
    ? row.requestedExpertCategories.filter(isExpertCategory)
    : [];
  return {
    id: row.id,
    listingMlsNumber: row.listingMlsNumber,
    body: row.body,
    questionStatus: row.questionStatus,
    requestedExpertCategories: categories,
    requestedExpertLabels: categories.map((category) => EXPERT_CATEGORY_LABELS[category]),
    listingSnapshot: row.listingSnapshot ?? null,
    answerCount: Number(row.answerCount ?? row.replyCount ?? answers.length ?? 0),
    authorName: displayName(row),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    answers: answers.map((answer) => ({
      id: answer.id,
      body: answer.body,
      authorName: displayName(answer),
      expertCategory: (answer.metadataJson as any)?.expertCategory ?? null,
      expertCategoryLabel: isExpertCategory((answer.metadataJson as any)?.expertCategory)
        ? EXPERT_CATEGORY_LABELS[(answer.metadataJson as any).expertCategory as ExpertCategory]
        : null,
      isExpertAnswer: Boolean((answer.metadataJson as any)?.isExpertAnswer),
      createdAt: answer.createdAt,
    })),
  };
}

async function ensurePropertyQuestionColumns(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE listing_comments
      ADD COLUMN IF NOT EXISTS thread_type text NOT NULL DEFAULT 'comment',
      ADD COLUMN IF NOT EXISTS question_status text NOT NULL DEFAULT 'none',
      ADD COLUMN IF NOT EXISTS requested_expert_categories jsonb,
      ADD COLUMN IF NOT EXISTS listing_snapshot jsonb
  `);
  await db.execute(sql`
    ALTER TABLE notification_preferences
      ADD COLUMN IF NOT EXISTS expert_question_digest_enabled boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS expert_question_live_alerts_enabled boolean NOT NULL DEFAULT false
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_listing_comments_thread_status
      ON listing_comments(thread_type, question_status, created_at)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_listing_comments_listing_thread
      ON listing_comments(listing_mls_number, thread_type, created_at)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS property_question_signals (
      question_id varchar PRIMARY KEY REFERENCES listing_comments(id) ON DELETE CASCADE,
      listing_mls_number text NOT NULL,
      listing_key text,
      user_id varchar REFERENCES users(id) ON DELETE SET NULL,
      referenced_analysis_id varchar,
      question_text text NOT NULL,
      normalized_question text,
      question_intent text NOT NULL DEFAULT 'general',
      question_length integer NOT NULL DEFAULT 0,
      requested_expert_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
      requested_expert_category_count integer NOT NULL DEFAULT 0,
      listing_snapshot jsonb,
      address text,
      city text,
      province text,
      postal_code text,
      property_type text,
      price_cents bigint,
      bedrooms real,
      bathrooms real,
      latitude real,
      longitude real,
      answer_count integer NOT NULL DEFAULT 0,
      expert_answer_count integer NOT NULL DEFAULT 0,
      first_answer_at timestamp,
      first_expert_answer_at timestamp,
      answered_at timestamp,
      resolved_at timestamp,
      status text NOT NULL DEFAULT 'open',
      source text NOT NULL DEFAULT 'web',
      source_page text,
      channel text NOT NULL DEFAULT 'web',
      metadata jsonb,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS property_question_events (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      question_id varchar NOT NULL REFERENCES listing_comments(id) ON DELETE CASCADE,
      answer_id varchar REFERENCES listing_comments(id) ON DELETE SET NULL,
      event_name text NOT NULL,
      user_id varchar REFERENCES users(id) ON DELETE SET NULL,
      expert_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
      expert_category text,
      is_expert_answer boolean NOT NULL DEFAULT false,
      listing_mls_number text NOT NULL,
      latency_seconds integer,
      source text NOT NULL DEFAULT 'web',
      channel text NOT NULL DEFAULT 'web',
      metadata jsonb,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS property_question_signals_listing_idx ON property_question_signals(listing_mls_number, created_at)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS property_question_signals_status_idx ON property_question_signals(status, created_at)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS property_question_signals_intent_idx ON property_question_signals(question_intent, created_at)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS property_question_signals_city_idx ON property_question_signals(province, city, created_at)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS property_question_events_question_idx ON property_question_events(question_id, created_at)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS property_question_events_name_idx ON property_question_events(event_name, created_at)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS property_question_events_expert_idx ON property_question_events(expert_category, created_at)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS property_question_events_listing_idx ON property_question_events(listing_mls_number, created_at)`);
}

async function upsertQuestionSignal(params: {
  question: typeof listingComments.$inferSelect;
  body: string;
  categories: ExpertCategory[];
  userId: string;
  listingSnapshot: ListingSnapshot;
  sourcePage?: string | null;
}) {
  const listing = structuredListingSnapshot(params.listingSnapshot);
  await db.insert(propertyQuestionSignals).values({
    questionId: params.question.id,
    listingMlsNumber: params.question.listingMlsNumber,
    listingKey: listing.listingKey,
    userId: params.userId,
    referencedAnalysisId: params.question.referencedAnalysisId,
    questionText: params.body,
    normalizedQuestion: normalizeQuestionText(params.body),
    questionIntent: inferQuestionIntent(params.body, params.categories),
    questionLength: params.body.length,
    requestedExpertCategories: params.categories,
    requestedExpertCategoryCount: params.categories.length,
    listingSnapshot: (params.listingSnapshot as Record<string, unknown> | null) ?? null,
    address: listing.address,
    city: listing.city,
    province: listing.province,
    postalCode: listing.postalCode,
    propertyType: listing.propertyType,
    priceCents: listing.priceCents,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    latitude: listing.latitude,
    longitude: listing.longitude,
    status: params.question.questionStatus || "open",
    source: "web",
    sourcePage: params.sourcePage || null,
    channel: "web",
    metadata: {
      source: "property_question",
      categoryLabels: params.categories.map((category) => EXPERT_CATEGORY_LABELS[category]),
    },
  }).onConflictDoUpdate({
    target: propertyQuestionSignals.questionId,
    set: {
      questionText: params.body,
      normalizedQuestion: normalizeQuestionText(params.body),
      questionIntent: inferQuestionIntent(params.body, params.categories),
      questionLength: params.body.length,
      requestedExpertCategories: params.categories,
      requestedExpertCategoryCount: params.categories.length,
      listingSnapshot: (params.listingSnapshot as Record<string, unknown> | null) ?? null,
      address: listing.address,
      city: listing.city,
      province: listing.province,
      postalCode: listing.postalCode,
      propertyType: listing.propertyType,
      priceCents: listing.priceCents,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      latitude: listing.latitude,
      longitude: listing.longitude,
      status: params.question.questionStatus || "open",
      updatedAt: new Date(),
    },
  });
}

async function appendQuestionEvent(params: {
  questionId: string;
  answerId?: string | null;
  eventName: string;
  userId?: string | null;
  expertUserId?: string | null;
  expertCategory?: ExpertCategory | string | null;
  isExpertAnswer?: boolean;
  listingMlsNumber: string;
  latencySeconds?: number | null;
  source?: string;
  channel?: string;
  metadata?: Record<string, unknown> | null;
}) {
  await db.insert(propertyQuestionEvents).values({
    questionId: params.questionId,
    answerId: params.answerId || null,
    eventName: params.eventName,
    userId: params.userId || null,
    expertUserId: params.expertUserId || null,
    expertCategory: params.expertCategory || null,
    isExpertAnswer: Boolean(params.isExpertAnswer),
    listingMlsNumber: params.listingMlsNumber,
    latencySeconds: params.latencySeconds ?? null,
    source: params.source || "web",
    channel: params.channel || "web",
    metadata: params.metadata || null,
  });
}

async function getApprovedExpertCategory(userId: string, requested?: string | null): Promise<{ category: ExpertCategory; isExpert: boolean }> {
  const [partner] = await db
    .select({ partnerType: industryPartners.partnerType })
    .from(industryPartners)
    .where(and(eq(industryPartners.userId, userId), eq(industryPartners.isApproved, true), eq(industryPartners.isPublic, true)))
    .limit(1);
  if (!partner) return { category: "investor", isExpert: false };
  const partnerCategory = categoryFromPartnerType(partner.partnerType);
  if (requested && isExpertCategory(requested) && requested === partnerCategory) {
    return { category: requested, isExpert: true };
  }
  return { category: partnerCategory, isExpert: true };
}

function questionUrl(questionId: string): string {
  return `https://realist.ca/community/questions#question-${encodeURIComponent(questionId)}`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function notifyLiveExperts(question: typeof listingComments.$inferSelect): Promise<void> {
  const categories = Array.isArray(question.requestedExpertCategories)
    ? question.requestedExpertCategories.filter(isExpertCategory)
    : [];
  if (!categories.length) return;

  const expertRows = await db
    .select({
      userId: users.id,
      email: users.email,
      firstName: users.firstName,
      partnerType: industryPartners.partnerType,
      liveAlerts: notificationPreferences.expertQuestionLiveAlertsEnabled,
      communityAlerts: notificationPreferences.communityAlertsEnabled,
      marketingEmail: notificationPreferences.marketingEmailEnabled,
      digestOptIn: users.emailDigestOptIn,
    })
    .from(industryPartners)
    .innerJoin(users, eq(users.id, industryPartners.userId))
    .leftJoin(notificationPreferences, eq(notificationPreferences.userId, users.id))
    .where(
      and(
        eq(industryPartners.isApproved, true),
        eq(industryPartners.isPublic, true),
        isNotNull(users.email),
        ne(users.email, ""),
      ),
    );

  const recipients = expertRows.filter((row) => {
    if (!row.email) return false;
    if (row.digestOptIn === false || row.marketingEmail === false || row.communityAlerts === false || row.liveAlerts !== true) return false;
    return categories.includes(categoryFromPartnerType(row.partnerType));
  });

  await Promise.allSettled(recipients.map((recipient) => {
    const category = categoryFromPartnerType(recipient.partnerType);
    const categoryLabel = EXPERT_CATEGORY_LABELS[category];
    return sendNotificationEmail({
      to: recipient.email,
      subject: `New Realist question for ${categoryLabel}s`,
      html: `
        <p>Hi ${escapeHtml(recipient.firstName || "there")},</p>
        <p>A Realist member asked a property question and tagged ${escapeHtml(categoryLabel)}s.</p>
        <blockquote>${escapeHtml(truncateText(question.body, 240) || question.body)}</blockquote>
        <p><a href="${questionUrl(question.id)}">Answer the question on Realist</a></p>
      `,
    });
  }));
  await Promise.allSettled(recipients.map((recipient) => appendQuestionEvent({
    questionId: question.id,
    eventName: "live_expert_alert_sent",
    expertUserId: recipient.userId,
    expertCategory: categoryFromPartnerType(recipient.partnerType),
    listingMlsNumber: question.listingMlsNumber,
    source: "email",
    channel: "email",
    metadata: {
      trigger: "expert_question_live_alert",
      requestedExpertCategories: categories,
    },
  })));
}

export function registerPropertyQuestionRoutes(app: Express) {
  const ensure = ensurePropertyQuestionColumns();

  app.get("/api/community/questions", async (req: Request, res: Response) => {
    try {
      await ensure;
      const listingMlsNumber = typeof req.query.listingMlsNumber === "string" ? req.query.listingMlsNumber : null;
      const category = typeof req.query.category === "string" && isExpertCategory(req.query.category) ? req.query.category : null;
      const status = typeof req.query.status === "string" ? req.query.status : "outstanding";
      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);

      const conditions = [
        eq(listingComments.threadType, "question"),
        eq(listingComments.visibility, "public"),
        eq(listingComments.status, "active"),
        isNull(listingComments.parentCommentId),
      ];
      if (listingMlsNumber) conditions.push(eq(listingComments.listingMlsNumber, listingMlsNumber));
      if (status === "outstanding") conditions.push(ne(listingComments.questionStatus, "resolved"));
      if (category) conditions.push(sql`${listingComments.requestedExpertCategories} ? ${category}`);

      const questions = await db
        .select({
          id: listingComments.id,
          listingMlsNumber: listingComments.listingMlsNumber,
          userId: listingComments.userId,
          parentCommentId: listingComments.parentCommentId,
          referencedAnalysisId: listingComments.referencedAnalysisId,
          body: listingComments.body,
          threadType: listingComments.threadType,
          questionStatus: listingComments.questionStatus,
          requestedExpertCategories: listingComments.requestedExpertCategories,
          listingSnapshot: listingComments.listingSnapshot,
          visibility: listingComments.visibility,
          status: listingComments.status,
          score: listingComments.score,
          helpfulCount: listingComments.helpfulCount,
          replyCount: listingComments.replyCount,
          reportCount: listingComments.reportCount,
          isPinned: listingComments.isPinned,
          userDisplaySnapshot: listingComments.userDisplaySnapshot,
          metadataJson: listingComments.metadataJson,
          createdAt: listingComments.createdAt,
          updatedAt: listingComments.updatedAt,
          editedAt: listingComments.editedAt,
          deletedAt: listingComments.deletedAt,
          userFirstName: users.firstName,
          userLastName: users.lastName,
          answerCount: sql<number>`(
            SELECT COUNT(*)::int FROM listing_comments answers
            WHERE answers.parent_comment_id = ${listingComments.id}
              AND answers.thread_type = 'answer'
              AND answers.status = 'active'
          )`,
        })
        .from(listingComments)
        .leftJoin(users, eq(users.id, listingComments.userId))
        .where(and(...conditions))
        .orderBy(desc(listingComments.createdAt))
        .limit(limit);

      let answersByQuestion = new Map<string, QuestionRow[]>();
      if (listingMlsNumber && questions.length) {
        const ids = questions.map((q) => q.id);
        const answers = await db
          .select({
            id: listingComments.id,
            listingMlsNumber: listingComments.listingMlsNumber,
            userId: listingComments.userId,
            parentCommentId: listingComments.parentCommentId,
            referencedAnalysisId: listingComments.referencedAnalysisId,
            body: listingComments.body,
            threadType: listingComments.threadType,
            questionStatus: listingComments.questionStatus,
            requestedExpertCategories: listingComments.requestedExpertCategories,
            listingSnapshot: listingComments.listingSnapshot,
            visibility: listingComments.visibility,
            status: listingComments.status,
            score: listingComments.score,
            helpfulCount: listingComments.helpfulCount,
            replyCount: listingComments.replyCount,
            reportCount: listingComments.reportCount,
            isPinned: listingComments.isPinned,
            userDisplaySnapshot: listingComments.userDisplaySnapshot,
            metadataJson: listingComments.metadataJson,
            createdAt: listingComments.createdAt,
            updatedAt: listingComments.updatedAt,
            editedAt: listingComments.editedAt,
            deletedAt: listingComments.deletedAt,
            userFirstName: users.firstName,
            userLastName: users.lastName,
          })
          .from(listingComments)
          .leftJoin(users, eq(users.id, listingComments.userId))
          .where(and(inArray(listingComments.parentCommentId, ids), eq(listingComments.threadType, "answer"), eq(listingComments.status, "active")))
          .orderBy(listingComments.createdAt);
        answersByQuestion = answers.reduce((map, answer) => {
          const key = answer.parentCommentId || "";
          map.set(key, [...(map.get(key) || []), answer]);
          return map;
        }, new Map<string, QuestionRow[]>());
      }

      res.json({ questions: questions.map((question) => shapeQuestion(question, answersByQuestion.get(question.id) || [])) });
    } catch (error) {
      console.error("[property-questions] list failed", error);
      res.status(500).json({ message: "Failed to load property questions" });
    }
  });

  app.post("/api/community/questions", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await ensure;
      const userId = getSessionUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const parsed = askQuestionSchema.parse(req.body);
      const categories = normalizeCategories(parsed.requestedExpertCategories);
      const body = sanitizeUserText(parsed.body, 1000);
      const [user] = await db.select({ firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, userId)).limit(1);
      const [question] = await db.insert(listingComments).values({
        listingMlsNumber: parsed.listingMlsNumber,
        userId,
        body,
        threadType: "question",
        questionStatus: "open",
        requestedExpertCategories: categories,
        listingSnapshot: parsed.listingSnapshot ?? null,
        visibility: "public",
        status: "active",
        userDisplaySnapshot: anonymizeDisplayName(user?.firstName, user?.lastName, "Realist member"),
        metadataJson: { source: "property_question" },
      }).returning();
      await upsertQuestionSignal({
        question,
        body,
        categories,
        userId,
        listingSnapshot: parsed.listingSnapshot ?? null,
        sourcePage: "/listings",
      });
      await appendQuestionEvent({
        questionId: question.id,
        eventName: "question_created",
        userId,
        listingMlsNumber: question.listingMlsNumber,
        metadata: {
          requestedExpertCategories: categories,
          questionIntent: inferQuestionIntent(body, categories),
          listingSnapshotAvailable: Boolean(parsed.listingSnapshot),
        },
      });
      await logUserActivity(req, {
        userId,
        eventName: "property_question_created",
        listingKey: structuredListingSnapshot(parsed.listingSnapshot).listingKey || parsed.listingMlsNumber,
        sourcePage: "/listings",
        component: "property_question_widget",
        metadata: {
          questionId: question.id,
          listingMlsNumber: parsed.listingMlsNumber,
          requestedExpertCategories: categories,
          questionIntent: inferQuestionIntent(body, categories),
          ...structuredListingSnapshot(parsed.listingSnapshot),
        },
      });
      await db.insert(contributionEvents).values({
        userId,
        type: "listing_question_created",
        points: 1,
        targetType: "listing_comment",
        targetId: question.id,
      });
      notifyLiveExperts(question).catch((error) => console.error("[property-questions] live expert email failed", error));
      res.status(201).json({ question: shapeQuestion({ ...question, userFirstName: user?.firstName, userLastName: user?.lastName }) });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors[0]?.message || "Invalid question" });
      console.error("[property-questions] create failed", error);
      res.status(500).json({ message: "Failed to post property question" });
    }
  });

  app.post("/api/community/questions/:id/answers", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await ensure;
      const userId = getSessionUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const parsed = answerQuestionSchema.parse(req.body);
      const [question] = await db.select().from(listingComments).where(and(eq(listingComments.id, req.params.id), eq(listingComments.threadType, "question"), eq(listingComments.status, "active"))).limit(1);
      if (!question) return res.status(404).json({ message: "Question not found" });

      const expert = await getApprovedExpertCategory(userId, parsed.expertCategory);
      const [user] = await db.select({ firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, userId)).limit(1);
      const [answer] = await db.insert(listingComments).values({
        listingMlsNumber: question.listingMlsNumber,
        userId,
        parentCommentId: question.id,
        body: sanitizeUserText(parsed.body, 2000),
        threadType: "answer",
        questionStatus: "none",
        requestedExpertCategories: [],
        visibility: "public",
        status: "active",
        userDisplaySnapshot: anonymizeDisplayName(user?.firstName, user?.lastName, "Realist member"),
        metadataJson: {
          source: "property_question_answer",
          expertCategory: expert.category,
          isExpertAnswer: expert.isExpert,
        },
      }).returning();

      const now = new Date();
      await db.update(listingComments)
        .set({
          replyCount: sql`${listingComments.replyCount} + 1`,
          questionStatus: question.questionStatus === "resolved" ? "resolved" : "answered",
          updatedAt: now,
        })
        .where(eq(listingComments.id, question.id));
      await db.update(propertyQuestionSignals)
        .set({
          answerCount: sql`${propertyQuestionSignals.answerCount} + 1`,
          expertAnswerCount: expert.isExpert ? sql`${propertyQuestionSignals.expertAnswerCount} + 1` : propertyQuestionSignals.expertAnswerCount,
          firstAnswerAt: sql`COALESCE(${propertyQuestionSignals.firstAnswerAt}, ${now})`,
          firstExpertAnswerAt: expert.isExpert ? sql`COALESCE(${propertyQuestionSignals.firstExpertAnswerAt}, ${now})` : propertyQuestionSignals.firstExpertAnswerAt,
          answeredAt: now,
          status: question.questionStatus === "resolved" ? "resolved" : "answered",
          updatedAt: now,
        })
        .where(eq(propertyQuestionSignals.questionId, question.id));
      await appendQuestionEvent({
        questionId: question.id,
        answerId: answer.id,
        eventName: expert.isExpert ? "expert_answer_created" : "community_answer_created",
        userId,
        expertUserId: expert.isExpert ? userId : null,
        expertCategory: expert.category,
        isExpertAnswer: expert.isExpert,
        listingMlsNumber: question.listingMlsNumber,
        latencySeconds: eventLatencySeconds(question.createdAt),
        metadata: {
          answerLength: answer.body.length,
          priorStatus: question.questionStatus,
        },
      });
      await logUserActivity(req, {
        userId,
        eventName: expert.isExpert ? "property_question_expert_answered" : "property_question_answered",
        listingKey: question.listingMlsNumber,
        sourcePage: "/community/questions",
        component: "property_question_answer",
        metadata: {
          questionId: question.id,
          answerId: answer.id,
          listingMlsNumber: question.listingMlsNumber,
          expertCategory: expert.category,
          isExpertAnswer: expert.isExpert,
          latencySeconds: eventLatencySeconds(question.createdAt),
        },
      });
      await db.insert(contributionEvents).values({
        userId,
        type: expert.isExpert ? "expert_question_answered" : "listing_question_answered",
        points: expert.isExpert ? 3 : 1,
        targetType: "listing_comment",
        targetId: answer.id,
      });
      res.status(201).json({
        answer: {
          id: answer.id,
          body: answer.body,
          authorName: anonymizeDisplayName(user?.firstName, user?.lastName, "Realist member"),
          expertCategory: expert.category,
          expertCategoryLabel: EXPERT_CATEGORY_LABELS[expert.category],
          isExpertAnswer: expert.isExpert,
          createdAt: answer.createdAt,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors[0]?.message || "Invalid answer" });
      console.error("[property-questions] answer failed", error);
      res.status(500).json({ message: "Failed to answer property question" });
    }
  });

  app.patch("/api/community/questions/:id/status", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await ensure;
      const userId = getSessionUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const parsed = updateStatusSchema.parse(req.body);
      const [question] = await db.select().from(listingComments).where(and(eq(listingComments.id, req.params.id), eq(listingComments.threadType, "question"))).limit(1);
      if (!question) return res.status(404).json({ message: "Question not found" });
      if (question.userId !== userId) return res.status(403).json({ message: "Only the question author can update status" });
      const [updated] = await db.update(listingComments)
        .set({ questionStatus: parsed.questionStatus, updatedAt: new Date() })
        .where(eq(listingComments.id, question.id))
        .returning();
      await db.update(propertyQuestionSignals)
        .set({
          status: parsed.questionStatus,
          resolvedAt: parsed.questionStatus === "resolved" ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(propertyQuestionSignals.questionId, question.id));
      await appendQuestionEvent({
        questionId: question.id,
        eventName: "question_status_changed",
        userId,
        listingMlsNumber: question.listingMlsNumber,
        latencySeconds: eventLatencySeconds(question.createdAt),
        metadata: {
          fromStatus: question.questionStatus,
          toStatus: parsed.questionStatus,
        },
      });
      await logUserActivity(req, {
        userId,
        eventName: "property_question_status_changed",
        listingKey: question.listingMlsNumber,
        sourcePage: "/community/questions",
        component: "property_question_status",
        metadata: {
          questionId: question.id,
          listingMlsNumber: question.listingMlsNumber,
          fromStatus: question.questionStatus,
          toStatus: parsed.questionStatus,
        },
      });
      res.json({ question: shapeQuestion(updated) });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors[0]?.message || "Invalid status" });
      console.error("[property-questions] status failed", error);
      res.status(500).json({ message: "Failed to update property question" });
    }
  });
}

export { ASKABLE_EXPERT_CATEGORIES };
