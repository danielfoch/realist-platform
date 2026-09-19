/**
 * Persistence for hosted agent result views (the /v/:token pages).
 *
 * The store is an interface with two implementations: Postgres (production)
 * and in-memory (unit tests, and a safety net so a tool call never fails just
 * because a view could not be saved). Tool handlers reach it through
 * getAgentViewStore(), so tests swap it with setAgentViewStore().
 */
import crypto from "crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { agentResultViews } from "@shared/schema";
import type { AgentViewDocument, AgentViewKind } from "@shared/agentViews";

export interface CreateAgentViewInput {
  document: AgentViewDocument;
  userId: string;
  apiKeyId?: string | null;
  analysisId?: string | null;
  tool?: string | null;
  channel?: string | null;
}

export interface StoredAgentView {
  token: string;
  kind: AgentViewKind;
  title: string;
  document: AgentViewDocument;
  userId: string;
  analysisId: string | null;
  tool: string | null;
  viewCount: number;
  createdAt: Date;
}

export type AgentViewSummary = Omit<StoredAgentView, "document" | "userId">;

export interface AgentViewStore {
  create(input: CreateAgentViewInput): Promise<StoredAgentView>;
  getByToken(token: string): Promise<StoredAgentView | null>;
  getLatestForAnalysis(userId: string, analysisId: string): Promise<StoredAgentView | null>;
  listForUser(userId: string, limit: number): Promise<AgentViewSummary[]>;
  deleteForUser(userId: string, token: string): Promise<boolean>;
  /** Best-effort open counter; never throws. */
  recordOpen(token: string): Promise<void>;
}

/** 128 bits of entropy, URL-safe. The token IS the access control. */
export function generateViewToken(): string {
  return crypto.randomBytes(16).toString("base64url");
}

export const VIEW_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

// ---------- in-memory ----------

export function createMemoryAgentViewStore(): AgentViewStore {
  const rows = new Map<string, StoredAgentView>();
  return {
    async create(input) {
      const row: StoredAgentView = {
        token: generateViewToken(),
        kind: input.document.kind,
        title: input.document.title,
        document: input.document,
        userId: input.userId,
        analysisId: input.analysisId ?? null,
        tool: input.tool ?? null,
        viewCount: 0,
        createdAt: new Date(),
      };
      rows.set(row.token, row);
      return row;
    },
    async getByToken(token) {
      return rows.get(token) ?? null;
    },
    async getLatestForAnalysis(userId, analysisId) {
      const matches = [...rows.values()].filter((r) => r.userId === userId && r.analysisId === analysisId);
      return matches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
    },
    async listForUser(userId, limit) {
      return [...rows.values()]
        .filter((r) => r.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit)
        .map(({ document: _document, userId: _userId, ...summary }) => summary);
    },
    async deleteForUser(userId, token) {
      const row = rows.get(token);
      if (!row || row.userId !== userId) return false;
      rows.delete(token);
      return true;
    },
    async recordOpen(token) {
      const row = rows.get(token);
      if (row) row.viewCount += 1;
    },
  };
}

// ---------- Postgres ----------

type Row = typeof agentResultViews.$inferSelect;

function toStored(row: Row): StoredAgentView {
  return {
    token: row.token,
    kind: row.kind as AgentViewKind,
    title: row.title,
    document: row.document as AgentViewDocument,
    userId: row.userId,
    analysisId: row.analysisId,
    tool: row.tool,
    viewCount: row.viewCount,
    createdAt: row.createdAt,
  };
}

export function createDbAgentViewStore(): AgentViewStore {
  // Imported lazily so unit tests that never touch the DB store do not need a
  // DATABASE_URL-backed pool.
  const getDb = async () => (await import("../db")).db;

  let ready: Promise<void> | undefined;
  /**
   * Idempotent boot migration, also awaited by requests so the first call
   * cannot race it. Mirrors the api_usage_events precedent: the table is
   * declared in shared/schema.ts AND created here, so an autoscale deploy never
   * depends on someone having run db:push.
   */
  const ensure = () =>
    (ready ??= (async () => {
      const db = await getDb();
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS agent_result_views (
          id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
          token varchar(64) NOT NULL UNIQUE,
          kind text NOT NULL,
          title text NOT NULL,
          document jsonb NOT NULL,
          user_id varchar NOT NULL,
          api_key_id varchar,
          analysis_id varchar,
          tool text,
          channel text,
          view_count integer NOT NULL DEFAULT 0,
          last_viewed_at timestamp,
          created_at timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS agent_result_views_user_created_idx ON agent_result_views(user_id, created_at)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS agent_result_views_analysis_idx ON agent_result_views(analysis_id)`);
    })().catch((error) => {
      ready = undefined;
      throw error;
    }));

  return {
    async create(input) {
      await ensure();
      const db = await getDb();
      const [row] = await db.insert(agentResultViews).values({
        token: generateViewToken(),
        kind: input.document.kind,
        title: input.document.title.slice(0, 300),
        document: input.document,
        userId: input.userId,
        apiKeyId: input.apiKeyId ?? null,
        analysisId: input.analysisId ?? null,
        tool: input.tool ?? null,
        channel: input.channel ?? null,
      }).returning();
      return toStored(row);
    },
    async getByToken(token) {
      await ensure();
      const db = await getDb();
      const [row] = await db.select().from(agentResultViews).where(eq(agentResultViews.token, token)).limit(1);
      return row ? toStored(row) : null;
    },
    async getLatestForAnalysis(userId, analysisId) {
      await ensure();
      const db = await getDb();
      const [row] = await db.select().from(agentResultViews)
        .where(and(eq(agentResultViews.userId, userId), eq(agentResultViews.analysisId, analysisId)))
        .orderBy(desc(agentResultViews.createdAt))
        .limit(1);
      return row ? toStored(row) : null;
    },
    async listForUser(userId, limit) {
      await ensure();
      const db = await getDb();
      const rows = await db.select({
        token: agentResultViews.token,
        kind: agentResultViews.kind,
        title: agentResultViews.title,
        analysisId: agentResultViews.analysisId,
        tool: agentResultViews.tool,
        viewCount: agentResultViews.viewCount,
        createdAt: agentResultViews.createdAt,
      }).from(agentResultViews)
        .where(eq(agentResultViews.userId, userId))
        .orderBy(desc(agentResultViews.createdAt))
        .limit(limit);
      return rows.map((row) => ({ ...row, kind: row.kind as AgentViewKind }));
    },
    async deleteForUser(userId, token) {
      await ensure();
      const db = await getDb();
      const deleted = await db.delete(agentResultViews)
        .where(and(eq(agentResultViews.token, token), eq(agentResultViews.userId, userId)))
        .returning({ id: agentResultViews.id });
      return deleted.length > 0;
    },
    async recordOpen(token) {
      try {
        await ensure();
        const db = await getDb();
        await db.update(agentResultViews)
          .set({ viewCount: sql`${agentResultViews.viewCount} + 1`, lastViewedAt: new Date() })
          .where(eq(agentResultViews.token, token));
      } catch (error: any) {
        console.error("[agent-views] failed to record open:", error?.message || error);
      }
    },
  };
}

let activeStore: AgentViewStore | null = null;

export function getAgentViewStore(): AgentViewStore {
  return (activeStore ??= createDbAgentViewStore());
}

/** Test seam — swap in createMemoryAgentViewStore(). */
export function setAgentViewStore(store: AgentViewStore | null): void {
  activeStore = store;
}
