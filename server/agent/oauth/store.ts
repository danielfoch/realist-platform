/**
 * Persistence for the OAuth 2.1 authorization server behind the hosted MCP
 * endpoint. Same shape as viewStore.ts: an interface, a Postgres
 * implementation that creates its tables idempotently, and an in-memory one
 * for tests.
 *
 * Nothing secret is stored in the clear — client secrets, authorization codes
 * and tokens are SHA-256 hashes, so a database leak cannot be replayed.
 */
import crypto from "crypto";
import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import {
  oauthAuthorizationCodes,
  oauthAuthorizationRequests,
  oauthClients,
  oauthGrants,
  oauthTokens,
} from "@shared/schema";

export const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

/** Constant-time comparison of a presented secret against a stored hash. */
export function secretMatchesHash(secret: string, hash: string): boolean {
  const presented = Buffer.from(sha256(secret), "hex");
  const stored = Buffer.from(hash, "hex");
  return presented.length === stored.length && crypto.timingSafeEqual(presented, stored);
}

export interface StoredOAuthClient {
  clientId: string;
  clientSecretHash: string | null;
  clientName: string | null;
  redirectUris: string[];
  /** Registered RFC 7591 metadata, without the secret. */
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface PendingAuthorization {
  id: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: string[];
  state: string | null;
  resource: string | null;
  expiresAt: Date;
}

export interface StoredAuthorizationCode {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: string[];
  resource: string | null;
  expiresAt: Date;
  usedAt: Date | null;
}

export interface StoredGrant {
  id: string;
  userId: string;
  clientId: string;
  scopes: string[];
  resource: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

export interface StoredToken {
  kind: "access" | "refresh";
  grantId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface OAuthStore {
  saveClient(client: StoredOAuthClient): Promise<void>;
  getClient(clientId: string): Promise<StoredOAuthClient | null>;

  savePending(request: PendingAuthorization): Promise<void>;
  getPending(id: string): Promise<PendingAuthorization | null>;
  /** Removes the request and reports whether it was still there — a consent decision can only be used once. */
  takePending(id: string): Promise<boolean>;

  saveCode(codeHash: string, code: Omit<StoredAuthorizationCode, "usedAt">): Promise<void>;
  getCode(codeHash: string): Promise<StoredAuthorizationCode | null>;
  /** Marks the code used; false when it was already used (a replay). */
  markCodeUsed(codeHash: string): Promise<boolean>;

  /** One live grant per (user, client): reconnecting replaces the scopes instead of piling up rows. */
  upsertGrant(input: { userId: string; clientId: string; scopes: string[]; resource: string | null }): Promise<StoredGrant>;
  getGrant(id: string): Promise<StoredGrant | null>;
  listGrantsForUser(userId: string): Promise<StoredGrant[]>;
  /** Revokes the grant and every token issued under it. */
  revokeGrant(id: string): Promise<void>;
  touchGrant(id: string): Promise<void>;

  saveToken(tokenHash: string, token: Omit<StoredToken, "revokedAt">): Promise<void>;
  getToken(tokenHash: string): Promise<StoredToken | null>;
  revokeToken(tokenHash: string): Promise<void>;
  /** Housekeeping: drop expired requests, codes and tokens. */
  purgeExpired(now?: Date): Promise<void>;
}

// ---------- in-memory ----------

export function createMemoryOAuthStore(): OAuthStore {
  const clients = new Map<string, StoredOAuthClient>();
  const pending = new Map<string, PendingAuthorization>();
  const codes = new Map<string, StoredAuthorizationCode>();
  const grants = new Map<string, StoredGrant>();
  const tokens = new Map<string, StoredToken>();
  return {
    async saveClient(client) { clients.set(client.clientId, client); },
    async getClient(clientId) { return clients.get(clientId) ?? null; },
    async savePending(request) { pending.set(request.id, request); },
    async getPending(id) { return pending.get(id) ?? null; },
    async takePending(id) { return pending.delete(id); },
    async saveCode(codeHash, code) { codes.set(codeHash, { ...code, usedAt: null }); },
    async getCode(codeHash) { return codes.get(codeHash) ?? null; },
    async markCodeUsed(codeHash) {
      const code = codes.get(codeHash);
      if (!code || code.usedAt) return false;
      code.usedAt = new Date();
      return true;
    },
    async upsertGrant(input) {
      const existing = [...grants.values()].find((g) => g.userId === input.userId && g.clientId === input.clientId && !g.revokedAt);
      if (existing) {
        existing.scopes = input.scopes;
        existing.resource = input.resource;
        return existing;
      }
      const grant: StoredGrant = { id: crypto.randomUUID(), ...input, createdAt: new Date(), lastUsedAt: null, revokedAt: null };
      grants.set(grant.id, grant);
      return grant;
    },
    async getGrant(id) { return grants.get(id) ?? null; },
    async listGrantsForUser(userId) {
      return [...grants.values()].filter((g) => g.userId === userId && !g.revokedAt).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async revokeGrant(id) {
      const grant = grants.get(id);
      if (grant && !grant.revokedAt) grant.revokedAt = new Date();
      for (const token of tokens.values()) if (token.grantId === id && !token.revokedAt) token.revokedAt = new Date();
    },
    async touchGrant(id) {
      const grant = grants.get(id);
      if (grant) grant.lastUsedAt = new Date();
    },
    async saveToken(tokenHash, token) { tokens.set(tokenHash, { ...token, revokedAt: null }); },
    async getToken(tokenHash) { return tokens.get(tokenHash) ?? null; },
    async revokeToken(tokenHash) {
      const token = tokens.get(tokenHash);
      if (token && !token.revokedAt) token.revokedAt = new Date();
    },
    async purgeExpired(now = new Date()) {
      for (const [id, request] of pending) if (request.expiresAt < now) pending.delete(id);
      for (const [hash, code] of codes) if (code.expiresAt < now) codes.delete(hash);
      for (const [hash, token] of tokens) if (token.expiresAt < now) tokens.delete(hash);
    },
  };
}

// ---------- Postgres ----------

export function createDbOAuthStore(): OAuthStore {
  const getDb = async () => (await import("../../db")).db;

  let ready: Promise<void> | undefined;
  /** Idempotent boot migration, also awaited by requests (see viewStore.ts for why). */
  const ensure = () =>
    (ready ??= (async () => {
      const db = await getDb();
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS oauth_clients (
          client_id varchar PRIMARY KEY,
          client_secret_hash text,
          client_name text,
          redirect_uris text[] NOT NULL,
          metadata jsonb NOT NULL,
          created_at timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS oauth_authorization_requests (
          id varchar PRIMARY KEY,
          client_id varchar NOT NULL,
          redirect_uri text NOT NULL,
          code_challenge text NOT NULL,
          scopes text[] NOT NULL,
          state text,
          resource text,
          expires_at timestamp NOT NULL,
          created_at timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
          code_hash text PRIMARY KEY,
          client_id varchar NOT NULL,
          user_id varchar NOT NULL,
          redirect_uri text NOT NULL,
          code_challenge text NOT NULL,
          scopes text[] NOT NULL,
          resource text,
          expires_at timestamp NOT NULL,
          used_at timestamp
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS oauth_grants (
          id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id varchar NOT NULL,
          client_id varchar NOT NULL,
          scopes text[] NOT NULL,
          resource text,
          created_at timestamp NOT NULL DEFAULT now(),
          last_used_at timestamp,
          revoked_at timestamp
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS oauth_grants_user_idx ON oauth_grants(user_id, created_at)`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS oauth_tokens (
          token_hash text PRIMARY KEY,
          kind text NOT NULL,
          grant_id varchar NOT NULL,
          expires_at timestamp NOT NULL,
          revoked_at timestamp,
          created_at timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS oauth_tokens_grant_idx ON oauth_tokens(grant_id)`);
    })().catch((error) => {
      ready = undefined;
      throw error;
    }));

  const ready_db = async () => {
    await ensure();
    return getDb();
  };

  return {
    async saveClient(client) {
      const db = await ready_db();
      await db.insert(oauthClients).values({
        clientId: client.clientId,
        clientSecretHash: client.clientSecretHash,
        clientName: client.clientName,
        redirectUris: client.redirectUris,
        metadata: client.metadata,
      });
    },
    async getClient(clientId) {
      const db = await ready_db();
      const [row] = await db.select().from(oauthClients).where(eq(oauthClients.clientId, clientId)).limit(1);
      return row ? { ...row, metadata: (row.metadata ?? {}) as Record<string, unknown> } : null;
    },
    async savePending(request) {
      const db = await ready_db();
      await db.insert(oauthAuthorizationRequests).values(request);
    },
    async getPending(id) {
      const db = await ready_db();
      const [row] = await db.select().from(oauthAuthorizationRequests).where(eq(oauthAuthorizationRequests.id, id)).limit(1);
      return row ?? null;
    },
    async takePending(id) {
      const db = await ready_db();
      const deleted = await db.delete(oauthAuthorizationRequests).where(eq(oauthAuthorizationRequests.id, id)).returning({ id: oauthAuthorizationRequests.id });
      return deleted.length > 0;
    },
    async saveCode(codeHash, code) {
      const db = await ready_db();
      await db.insert(oauthAuthorizationCodes).values({ codeHash, ...code });
    },
    async getCode(codeHash) {
      const db = await ready_db();
      const [row] = await db.select().from(oauthAuthorizationCodes).where(eq(oauthAuthorizationCodes.codeHash, codeHash)).limit(1);
      return row ?? null;
    },
    async markCodeUsed(codeHash) {
      const db = await ready_db();
      // Single conditional UPDATE: two concurrent exchanges cannot both win.
      const updated = await db.update(oauthAuthorizationCodes)
        .set({ usedAt: new Date() })
        .where(and(eq(oauthAuthorizationCodes.codeHash, codeHash), isNull(oauthAuthorizationCodes.usedAt)))
        .returning({ codeHash: oauthAuthorizationCodes.codeHash });
      return updated.length > 0;
    },
    async upsertGrant(input) {
      const db = await ready_db();
      const [existing] = await db.select().from(oauthGrants)
        .where(and(eq(oauthGrants.userId, input.userId), eq(oauthGrants.clientId, input.clientId), isNull(oauthGrants.revokedAt)))
        .orderBy(desc(oauthGrants.createdAt))
        .limit(1);
      if (existing) {
        const [updated] = await db.update(oauthGrants)
          .set({ scopes: input.scopes, resource: input.resource })
          .where(eq(oauthGrants.id, existing.id))
          .returning();
        return updated;
      }
      const [created] = await db.insert(oauthGrants).values(input).returning();
      return created;
    },
    async getGrant(id) {
      const db = await ready_db();
      const [row] = await db.select().from(oauthGrants).where(eq(oauthGrants.id, id)).limit(1);
      return row ?? null;
    },
    async listGrantsForUser(userId) {
      const db = await ready_db();
      return db.select().from(oauthGrants)
        .where(and(eq(oauthGrants.userId, userId), isNull(oauthGrants.revokedAt)))
        .orderBy(desc(oauthGrants.createdAt));
    },
    async revokeGrant(id) {
      const db = await ready_db();
      const now = new Date();
      await db.update(oauthGrants).set({ revokedAt: now }).where(and(eq(oauthGrants.id, id), isNull(oauthGrants.revokedAt)));
      await db.update(oauthTokens).set({ revokedAt: now }).where(and(eq(oauthTokens.grantId, id), isNull(oauthTokens.revokedAt)));
    },
    async touchGrant(id) {
      try {
        const db = await ready_db();
        await db.update(oauthGrants).set({ lastUsedAt: new Date() }).where(eq(oauthGrants.id, id));
      } catch (error: any) {
        console.error("[oauth] failed to touch grant:", error?.message || error);
      }
    },
    async saveToken(tokenHash, token) {
      const db = await ready_db();
      await db.insert(oauthTokens).values({ tokenHash, ...token });
    },
    async getToken(tokenHash) {
      const db = await ready_db();
      const [row] = await db.select().from(oauthTokens).where(eq(oauthTokens.tokenHash, tokenHash)).limit(1);
      return row ? { kind: row.kind as StoredToken["kind"], grantId: row.grantId, expiresAt: row.expiresAt, revokedAt: row.revokedAt } : null;
    },
    async revokeToken(tokenHash) {
      const db = await ready_db();
      await db.update(oauthTokens).set({ revokedAt: new Date() }).where(and(eq(oauthTokens.tokenHash, tokenHash), isNull(oauthTokens.revokedAt)));
    },
    async purgeExpired(now = new Date()) {
      const db = await ready_db();
      await db.delete(oauthAuthorizationRequests).where(lt(oauthAuthorizationRequests.expiresAt, now));
      await db.delete(oauthAuthorizationCodes).where(lt(oauthAuthorizationCodes.expiresAt, now));
      await db.delete(oauthTokens).where(lt(oauthTokens.expiresAt, now));
    },
  };
}

let activeStore: OAuthStore | null = null;

export function getOAuthStore(): OAuthStore {
  return (activeStore ??= createDbOAuthStore());
}

/** Test seam — swap in createMemoryOAuthStore(). */
export function setOAuthStore(store: OAuthStore | null): void {
  activeStore = store;
}
