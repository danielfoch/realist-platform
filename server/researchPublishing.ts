import type { Express, NextFunction, Request, Response } from "express";
import crypto from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "./db";
import { appBaseUrl } from "./auth";
import {
  researchArticles,
  researchPublishAttempts,
  users,
} from "@shared/schema";
import {
  draftStatusFromErrors,
  researchDraftIngestSchema,
  researchDraftUpdateSchema,
  researchPublishRequestSchema,
  validateResearchArticle,
  type PublishedResearchSummary,
} from "@shared/researchPublishing";
import { reportRoute, type ReportContent } from "@shared/reportContent";

const PREVIEW_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function researchApiKey(): string | undefined {
  return process.env.REALIST_RESEARCH_API_KEY || process.env.DEAL_DESK_API_KEY;
}

function previewSecret(): string {
  return process.env.RESEARCH_PREVIEW_SECRET || process.env.SESSION_SECRET || "dev-research-preview-secret";
}

async function requireResearchAdminOrApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const apiKey = req.headers["x-research-key"] || req.headers["x-api-key"];
    const configuredKey = researchApiKey();
    if (configuredKey && apiKey === configuredKey) {
      next();
      return;
    }

    if (!req.session?.userId) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }
    const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, req.session.userId)).limit(1);
    if (!user || user.role !== "admin") {
      res.status(403).json({ success: false, error: "Admin access required" });
      return;
    }
    next();
  } catch (error) {
    console.error("[research-publishing] auth check failed:", error);
    res.status(500).json({ success: false, error: "Auth check failed" });
  }
}

async function requireResearchAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.session?.userId) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }
    const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, req.session.userId)).limit(1);
    if (!user || user.role !== "admin") {
      res.status(403).json({ success: false, error: "Admin access required" });
      return;
    }
    next();
  } catch (error) {
    console.error("[research-publishing] admin auth check failed:", error);
    res.status(500).json({ success: false, error: "Auth check failed" });
  }
}

function signPreviewToken(articleId: string, expiresAt: number): string {
  const payload = Buffer.from(JSON.stringify({ articleId, expiresAt })).toString("base64url");
  const sig = crypto.createHmac("sha256", previewSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyPreviewToken(token: string | undefined, articleId: string): boolean {
  if (!token || !token.includes(".")) return false;
  const [payload, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", previewSecret()).update(payload).digest("base64url");
  if (Buffer.byteLength(sig) !== Buffer.byteLength(expected)) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { articleId?: string; expiresAt?: number };
  return parsed.articleId === articleId && typeof parsed.expiresAt === "number" && parsed.expiresAt > Date.now();
}

function serializeArticle(row: typeof researchArticles.$inferSelect) {
  const token = signPreviewToken(row.id, Date.now() + PREVIEW_TTL_MS);
  return {
    ...row,
    previewUrl: `${appBaseUrl()}${reportRoute(row.slug)}?previewId=${encodeURIComponent(row.id)}&token=${encodeURIComponent(token)}`,
  };
}

function publicSummary(row: typeof researchArticles.$inferSelect): PublishedResearchSummary {
  const article = row.articleJson;
  return {
    slug: article.slug,
    title: article.title,
    dek: article.dek,
    publishDate: article.publishDate,
    kind: article.kind,
    tags: article.tags,
    route: reportRoute(article.slug),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getPublishedResearchArticleBySlug(slug: string): Promise<ReportContent | null> {
  const [row] = await db.select({ articleJson: researchArticles.articleJson })
    .from(researchArticles)
    .where(and(eq(researchArticles.slug, slug), eq(researchArticles.status, "published")))
    .limit(1);
  return row?.articleJson || null;
}

export async function getPublishedResearchSummaries(limit = 100): Promise<PublishedResearchSummary[]> {
  const rows = await db.select().from(researchArticles)
    .where(eq(researchArticles.status, "published"))
    .orderBy(desc(researchArticles.publishedAt), desc(researchArticles.createdAt))
    .limit(Math.max(1, Math.min(250, limit)));
  return rows.map(publicSummary);
}

export function registerResearchPublishingRoutes(app: Express): void {
  app.get("/api/research/articles", async (_req, res) => {
    try {
      res.set("Cache-Control", "public, max-age=300, s-maxage=900, stale-while-revalidate=3600");
      res.json(await getPublishedResearchSummaries());
    } catch (error) {
      console.error("[research-publishing] public index failed:", error);
      res.status(500).json({ error: "Failed to load published research" });
    }
  });

  app.get("/api/research/articles/:slug", async (req, res) => {
    try {
      const article = await getPublishedResearchArticleBySlug(req.params.slug);
      if (!article) {
        res.status(404).json({ error: "Research article not found" });
        return;
      }
      res.set("Cache-Control", "public, max-age=300, s-maxage=900, stale-while-revalidate=3600");
      res.json(article);
    } catch (error) {
      console.error("[research-publishing] public article failed:", error);
      res.status(500).json({ error: "Failed to load research article" });
    }
  });

  app.post("/api/research/drafts/ingest", requireResearchAdminOrApiKey, async (req, res) => {
    try {
      const payload = researchDraftIngestSchema.parse(req.body);
      const [existingByIdempotency] = await db
        .select()
        .from(researchArticles)
        .where(eq(researchArticles.ingestIdempotencyKey, payload.idempotencyKey))
        .limit(1);
      if (existingByIdempotency) {
        res.json({ success: true, idempotent: true, article: serializeArticle(existingByIdempotency) });
        return;
      }

      const [existingBySource] = await db
        .select({ id: researchArticles.id })
        .from(researchArticles)
        .where(eq(researchArticles.sourceId, payload.sourceId))
        .limit(1);
      if (existingBySource) {
        res.status(409).json({
          success: false,
          error: "source_already_ingested",
          message: "Use the original idempotency key for retries, or create a new sourceId for a replacement draft.",
        });
        return;
      }

      const { article, errors } = validateResearchArticle(payload.article);
      const [created] = await db.insert(researchArticles).values({
        sourceId: payload.sourceId,
        ingestIdempotencyKey: payload.idempotencyKey,
        slug: article.slug,
        title: article.title,
        dek: article.dek,
        status: draftStatusFromErrors(errors),
        articleJson: article,
        validationErrors: errors,
      }).returning();

      res.status(201).json({ success: true, idempotent: false, article: serializeArticle(created) });
    } catch (error: any) {
      if (error?.issues) {
        res.status(400).json({ success: false, error: "validation_failed", details: error.issues });
        return;
      }
      console.error("[research-publishing] ingest failed:", error);
      res.status(500).json({ success: false, error: "Failed to ingest research draft" });
    }
  });

  app.get("/api/admin/research/articles", requireResearchAdmin, async (_req, res) => {
    const rows = await db.select().from(researchArticles).orderBy(desc(researchArticles.createdAt)).limit(100);
    res.json(rows.map(serializeArticle));
  });

  app.get("/api/admin/research/articles/:id", requireResearchAdmin, async (req, res) => {
    const [row] = await db.select().from(researchArticles).where(eq(researchArticles.id, req.params.id)).limit(1);
    if (!row) {
      res.status(404).json({ success: false, error: "Research article not found" });
      return;
    }
    res.json(serializeArticle(row));
  });

  app.put("/api/admin/research/articles/:id", requireResearchAdmin, async (req, res) => {
    try {
      const payload = researchDraftUpdateSchema.parse(req.body);
      const [existing] = await db.select().from(researchArticles).where(eq(researchArticles.id, req.params.id)).limit(1);
      if (!existing) {
        res.status(404).json({ success: false, error: "Research article not found" });
        return;
      }
      if (existing.status === "published") {
        res.status(409).json({ success: false, error: "Published research is immutable; ingest a replacement draft instead" });
        return;
      }
      const { article, errors } = validateResearchArticle(payload.article);
      const [updated] = await db.update(researchArticles).set({
        slug: article.slug,
        title: article.title,
        dek: article.dek,
        articleJson: article,
        validationErrors: errors,
        status: draftStatusFromErrors(errors),
        publishBlockedReason: null,
        updatedAt: new Date(),
      }).where(eq(researchArticles.id, existing.id)).returning();
      res.json({ success: true, article: serializeArticle(updated) });
    } catch (error: any) {
      if (error?.issues) {
        res.status(400).json({ success: false, error: "validation_failed", details: error.issues });
        return;
      }
      if (error?.code === "23505") {
        res.status(409).json({ success: false, error: "slug_already_exists" });
        return;
      }
      console.error("[research-publishing] update failed:", error);
      res.status(500).json({ success: false, error: "Failed to update research draft" });
    }
  });

  app.post("/api/admin/research/articles/:id/preview-link", requireResearchAdmin, async (req, res) => {
    const [row] = await db
      .update(researchArticles)
      .set({ previewIssuedAt: new Date(), updatedAt: new Date() })
      .where(eq(researchArticles.id, req.params.id))
      .returning();
    if (!row) {
      res.status(404).json({ success: false, error: "Research article not found" });
      return;
    }
    res.json({ success: true, previewUrl: serializeArticle(row).previewUrl });
  });

  app.get("/api/research/preview/:id", async (req, res) => {
    try {
      const token = typeof req.query.token === "string" ? req.query.token : undefined;
      if (!verifyPreviewToken(token, req.params.id)) {
        res.status(401).json({ success: false, error: "Invalid or expired preview token" });
        return;
      }
      const [row] = await db.select().from(researchArticles).where(eq(researchArticles.id, req.params.id)).limit(1);
      if (!row) {
        res.status(404).json({ success: false, error: "Research article not found" });
        return;
      }
      res.set("Cache-Control", "no-store");
      res.json({ success: true, article: serializeArticle(row) });
    } catch (error) {
      console.error("[research-publishing] preview failed:", error);
      res.status(401).json({ success: false, error: "Invalid preview token" });
    }
  });

  app.post("/api/admin/research/articles/:id/publish", requireResearchAdmin, async (req, res) => {
    try {
      const payload = researchPublishRequestSchema.parse(req.body);
      const [existingAttempt] = await db
        .select()
        .from(researchPublishAttempts)
        .where(and(
          eq(researchPublishAttempts.articleId, req.params.id),
          eq(researchPublishAttempts.idempotencyKey, payload.idempotencyKey),
        ))
        .limit(1);
      if (existingAttempt) {
        const successful = existingAttempt.outcome === "published" || existingAttempt.outcome === "already_published";
        res.status(successful ? 200 : 409).json({
          success: successful,
          idempotent: true,
          attempt: existingAttempt,
          ...(successful ? {} : { error: "publish_blocked", message: existingAttempt.message }),
        });
        return;
      }

      const [article] = await db.select().from(researchArticles).where(eq(researchArticles.id, req.params.id)).limit(1);
      if (!article) {
        res.status(404).json({ success: false, error: "Research article not found" });
        return;
      }
      const { article: normalized, errors } = validateResearchArticle(article.articleJson);
      const { getConfigReport } = await import("@shared/reports");
      const blockedReason = errors.length > 0
        ? `Validation failed: ${errors.join("; ")}`
        : getConfigReport(normalized.slug)
          ? "A committed config report already uses this slug"
          : null;

      if (blockedReason) {
        const [attempt] = await db.insert(researchPublishAttempts).values({
          articleId: article.id,
          idempotencyKey: payload.idempotencyKey,
          requestedByUserId: req.session.userId ?? null,
          outcome: "blocked",
          message: blockedReason,
        }).returning();
        await db.update(researchArticles).set({
          status: errors.length > 0 ? "needs_revision" : "publish_blocked",
          validationErrors: errors,
          reviewedByUserId: req.session.userId ?? null,
          reviewedAt: new Date(),
          publishRequestedAt: new Date(),
          publishBlockedReason: blockedReason,
          updatedAt: new Date(),
        }).where(eq(researchArticles.id, article.id));
        res.status(409).json({ success: false, idempotent: false, attempt, error: "publish_blocked", message: blockedReason });
        return;
      }

      if (article.status === "published") {
        const [attempt] = await db.insert(researchPublishAttempts).values({
          articleId: article.id,
          idempotencyKey: payload.idempotencyKey,
          requestedByUserId: req.session.userId ?? null,
          outcome: "already_published",
          message: reportRoute(normalized.slug),
        }).returning();
        res.json({
          success: true,
          idempotent: false,
          attempt,
          article: serializeArticle(article),
          publicUrl: `${appBaseUrl()}${reportRoute(normalized.slug)}`,
        });
        return;
      }

      const now = new Date();
      const result = await db.transaction(async (tx) => {
        const [published] = await tx.update(researchArticles).set({
          slug: normalized.slug,
          title: normalized.title,
          dek: normalized.dek,
          articleJson: normalized,
          status: "published",
          validationErrors: [],
          reviewedByUserId: req.session.userId ?? null,
          reviewedAt: now,
          publishRequestedAt: now,
          publishBlockedReason: null,
          publishedAt: article.publishedAt || now,
          updatedAt: now,
        }).where(eq(researchArticles.id, article.id)).returning();
        const [attempt] = await tx.insert(researchPublishAttempts).values({
          articleId: article.id,
          idempotencyKey: payload.idempotencyKey,
          requestedByUserId: req.session.userId ?? null,
          outcome: "published",
          message: reportRoute(normalized.slug),
        }).returning();
        return { published, attempt };
      });

      res.json({
        success: true,
        idempotent: false,
        attempt: result.attempt,
        article: serializeArticle(result.published),
        publicUrl: `${appBaseUrl()}${reportRoute(normalized.slug)}`,
      });
    } catch (error: any) {
      if (error?.issues) {
        res.status(400).json({ success: false, error: "validation_failed", details: error.issues });
        return;
      }
      console.error("[research-publishing] publish failed:", error);
      res.status(500).json({ success: false, error: "Failed to record publish attempt" });
    }
  });
}
