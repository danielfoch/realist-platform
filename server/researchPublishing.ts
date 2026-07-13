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
  researchPublishRequestSchema,
  validateResearchArticle,
} from "@shared/researchPublishing";

const PREVIEW_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PUBLISH_BLOCKED_REASON = "Phase 2 skeleton only: public publishing is intentionally disabled until the production publish workflow is wired and approved.";

function researchApiKey(): string | undefined {
  return process.env.REALIST_RESEARCH_API_KEY || process.env.DEAL_DESK_API_KEY;
}

function previewSecret(): string {
  return process.env.RESEARCH_PREVIEW_SECRET || process.env.SESSION_SECRET || "dev-research-preview-secret";
}

async function requireResearchAdminOrApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const apiKey = req.headers["x-api-key"] || req.query.api_key;
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
  return {
    ...row,
    previewUrl: `${appBaseUrl()}/api/research/preview/${row.id}?token=${signPreviewToken(row.id, Date.now() + PREVIEW_TTL_MS)}`,
  };
}

export function registerResearchPublishingRoutes(app: Express): void {
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
        res.json({ success: true, idempotent: true, attempt: existingAttempt });
        return;
      }

      const [article] = await db.select().from(researchArticles).where(eq(researchArticles.id, req.params.id)).limit(1);
      if (!article) {
        res.status(404).json({ success: false, error: "Research article not found" });
        return;
      }

      const [attempt] = await db.insert(researchPublishAttempts).values({
        articleId: article.id,
        idempotencyKey: payload.idempotencyKey,
        requestedByUserId: req.session.userId ?? null,
        outcome: "blocked",
        message: PUBLISH_BLOCKED_REASON,
      }).returning();

      await db.update(researchArticles).set({
        status: "publish_blocked",
        reviewedByUserId: req.session.userId ?? null,
        reviewedAt: new Date(),
        publishRequestedAt: new Date(),
        publishBlockedReason: PUBLISH_BLOCKED_REASON,
        updatedAt: new Date(),
      }).where(eq(researchArticles.id, article.id));

      res.status(202).json({ success: true, idempotent: false, attempt, message: PUBLISH_BLOCKED_REASON });
    } catch (error: any) {
      if (error?.issues) {
        res.status(400).json({ success: false, error: "validation_failed", details: error.issues });
        return;
      }
      console.error("[research-publishing] publish skeleton failed:", error);
      res.status(500).json({ success: false, error: "Failed to record publish attempt" });
    }
  });
}
