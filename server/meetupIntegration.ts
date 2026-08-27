/**
 * Meetup Pro → native Realist event bridge.
 *
 * Meetup is the distribution calendar; Realist remains the identity and RSVP
 * system. An event-admin completes OAuth once, then the scheduler copies the
 * Pro network's upcoming GraphQL events into realist_events. No Meetup member
 * emails or profiles are imported by this job.
 */

import type { Express, Request, Response } from "express";
import cron from "node-cron";
import { and, desc, eq, max, sql } from "drizzle-orm";
import { db } from "./db";
import { ensureRealistEventTables, getSessionUser, isEventAdminRequest, requireEventAdmin } from "./eventsModule";
import { decryptMeetupToken, encryptMeetupToken } from "./meetupSecrets";
import { realistEvents, userIntegrations } from "@shared/schema";
import {
  normalizeMeetupEvent,
  signMeetupOAuthState,
  verifyMeetupOAuthState,
  type MeetupEventNode,
} from "@shared/meetupIntegration";

const PROVIDER = "meetup";
const GRAPHQL_URL = "https://api.meetup.com/gql-ext";
const AUTH_URL = "https://secure.meetup.com/oauth2/authorize";
const TOKEN_URL = "https://secure.meetup.com/oauth2/access";
const DEFAULT_NETWORK_URLNAME = "the-canadian-real-estate-investor";

type MeetupConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  networkUrlname: string;
};

type MeetupTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
};

type MeetupGraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message?: string; extensions?: { code?: string } }>;
};

type MeetupEventsQuery = {
  proNetwork?: {
    eventsSearch?: {
      totalCount?: number;
      edges?: Array<{ node?: MeetupEventNode | null } | null>;
    } | null;
  } | null;
};

const UPCOMING_EVENTS_QUERY = `
  query RealistUpcomingMeetupEvents($urlname: ID!) {
    proNetwork(urlname: $urlname) {
      eventsSearch(input: { first: 100, filter: { status: "UPCOMING" } }) {
        totalCount
        edges {
          node {
            id
            title
            eventUrl
            description
            dateTime
            duration
            eventHosts { name }
            featuredEventPhoto { id baseUrl }
            group { id name urlname }
            rsvps { totalCount }
          }
        }
      }
    }
  }
`;

function config(): MeetupConfig | null {
  const clientId = process.env.MEETUP_CLIENT_ID?.trim();
  const clientSecret = process.env.MEETUP_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    redirectUri: process.env.MEETUP_REDIRECT_URI?.trim() || "https://realist.ca/api/auth/meetup/callback",
    networkUrlname: process.env.MEETUP_PRO_NETWORK_URLNAME?.trim() || DEFAULT_NETWORK_URLNAME,
  };
}

function stateSecret(): string {
  return process.env.MEETUP_OAUTH_STATE_SECRET || process.env.SESSION_SECRET || "";
}

function tokenSecret(): string {
  return process.env.MEETUP_TOKEN_ENCRYPTION_KEY || process.env.SESSION_SECRET || "";
}

function cronKeyOk(req: Request): boolean {
  const supplied = req.headers["x-api-key"] || req.query.api_key;
  const configured = process.env.EVENTS_CRON_API_KEY || process.env.DEAL_DESK_API_KEY;
  return Boolean(configured && supplied === configured);
}

function expiresAt(expiresIn?: number): Date {
  return new Date(Date.now() + Math.max(60, Number(expiresIn) || 3600) * 1000);
}

async function ensureMeetupTables(): Promise<void> {
  await ensureRealistEventTables();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "user_integrations" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "provider" varchar(30) NOT NULL,
      "refresh_token" text NOT NULL,
      "access_token" text,
      "token_expires_at" timestamp,
      "scope" text,
      "external_email" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_integrations_user_provider"
      ON "user_integrations" ("user_id", "provider")
  `);
}

async function tokenRequest(body: URLSearchParams): Promise<MeetupTokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const payload = await response.json().catch(() => ({})) as Partial<MeetupTokenResponse> & { error?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(`Meetup token exchange failed (${response.status}): ${payload.error || "invalid response"}`);
  }
  return payload as MeetupTokenResponse;
}

async function graphql<T>(accessToken: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const payload = await response.json().catch(() => ({})) as MeetupGraphqlResponse<T>;
  if (!response.ok || payload.errors?.length || !payload.data) {
    const detail = payload.errors?.map((error) => error.message || error.extensions?.code).filter(Boolean).join("; ");
    throw new Error(`Meetup GraphQL failed (${response.status}): ${detail || "invalid response"}`);
  }
  return payload.data;
}

async function getConnection() {
  const [row] = await db.select().from(userIntegrations)
    .where(eq(userIntegrations.provider, PROVIDER))
    .orderBy(desc(userIntegrations.updatedAt))
    .limit(1);
  return row || null;
}

async function getConnectionForUser(userId: string) {
  const [row] = await db.select().from(userIntegrations)
    .where(and(eq(userIntegrations.userId, userId), eq(userIntegrations.provider, PROVIDER)))
    .limit(1);
  return row || null;
}

async function storeConnection(userId: string, tokens: MeetupTokenResponse, externalEmail: string | null): Promise<void> {
  const secret = tokenSecret();
  if (!secret) throw new Error("MEETUP_TOKEN_ENCRYPTION_KEY or SESSION_SECRET is required");
  const existing = await getConnectionForUser(userId);
  const refreshToken = tokens.refresh_token
    ? encryptMeetupToken(tokens.refresh_token, secret)
    : existing?.refreshToken;
  if (!refreshToken) throw new Error("Meetup did not return a refresh token");

  await db.insert(userIntegrations).values({
    userId,
    provider: PROVIDER,
    refreshToken,
    accessToken: encryptMeetupToken(tokens.access_token, secret),
    tokenExpiresAt: expiresAt(tokens.expires_in),
    scope: tokens.scope || null,
    externalEmail,
  }).onConflictDoUpdate({
    target: [userIntegrations.userId, userIntegrations.provider],
    set: {
      refreshToken,
      accessToken: encryptMeetupToken(tokens.access_token, secret),
      tokenExpiresAt: expiresAt(tokens.expires_in),
      scope: tokens.scope || null,
      externalEmail,
      updatedAt: new Date(),
    },
  });
}

let refreshInFlight: Promise<string> | null = null;

async function freshAccessToken(): Promise<string> {
  const connection = await getConnection();
  if (!connection) throw new Error("Meetup is not connected");
  const secret = tokenSecret();
  if (!secret) throw new Error("MEETUP_TOKEN_ENCRYPTION_KEY or SESSION_SECRET is required");
  const expiry = connection.tokenExpiresAt?.getTime() || 0;
  if (connection.accessToken && expiry - Date.now() > 120_000) {
    return decryptMeetupToken(connection.accessToken, secret);
  }
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const cfg = config();
    if (!cfg) throw new Error("Meetup OAuth is not configured");
    const tokens = await tokenRequest(new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      grant_type: "refresh_token",
      refresh_token: decryptMeetupToken(connection.refreshToken, secret),
    }));
    // Meetup refresh tokens are single-use; always persist the replacement.
    await storeConnection(connection.userId, tokens, connection.externalEmail);
    return tokens.access_token;
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function exchangeAuthorizationCode(userId: string, code: string): Promise<void> {
  const cfg = config();
  if (!cfg) throw new Error("Meetup OAuth is not configured");
  const tokens = await tokenRequest(new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: "authorization_code",
    redirect_uri: cfg.redirectUri,
    code,
  }));
  const self = await graphql<{ self?: { id?: string | number; name?: string } }>(
    tokens.access_token,
    "query RealistMeetupConnection { self { id name } }",
    {},
  );
  await storeConnection(userId, tokens, self.self?.name || null);
}

export type MeetupSyncResult = {
  fetched: number;
  imported: number;
  skipped: number;
  networkUrlname: string;
  syncedAt: string;
};

export async function runMeetupEventSync(): Promise<MeetupSyncResult> {
  const cfg = config();
  if (!cfg) throw new Error("Meetup OAuth is not configured");
  await ensureMeetupTables();
  const accessToken = await freshAccessToken();
  const data = await graphql<MeetupEventsQuery>(accessToken, UPCOMING_EVENTS_QUERY, { urlname: cfg.networkUrlname });
  const nodes = (data.proNetwork?.eventsSearch?.edges || [])
    .map((edge) => edge?.node || null)
    .filter((node): node is MeetupEventNode => Boolean(node));
  const syncedAt = new Date();
  const connection = await getConnection();
  const createdByEmail = connection?.externalEmail?.includes("@")
    ? connection.externalEmail
    : "meetup-sync@realist.ca";
  let imported = 0;
  let skipped = 0;

  for (const node of nodes) {
    const event = normalizeMeetupEvent(node);
    if (!event) {
      skipped += 1;
      continue;
    }
    await db.insert(realistEvents).values({
      slug: event.slug,
      title: event.title,
      shortDescription: event.shortDescription,
      longDescription: event.longDescription || null,
      headerImageUrl: event.headerImageUrl,
      eventType: event.eventType,
      status: "PUBLISHED",
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      timezone: event.timezone,
      venueName: null,
      venueAddress: null,
      agendaSections: event.hostNames.length ? [{ title: `Hosted by ${event.hostNames.join(", ")}` }] : [],
      kind: "meetup",
      city: event.city,
      externalSource: PROVIDER,
      externalEventId: event.externalEventId,
      externalUrl: event.externalUrl,
      externalGroupUrlname: event.externalGroupUrlname,
      externalGroupName: event.externalGroupName,
      externalRsvpCount: event.externalRsvpCount,
      externalSyncedAt: syncedAt,
      createdByEmail,
    }).onConflictDoUpdate({
      target: [realistEvents.externalSource, realistEvents.externalEventId],
      set: {
        title: event.title,
        shortDescription: event.shortDescription,
        longDescription: event.longDescription || null,
        headerImageUrl: event.headerImageUrl,
        eventType: event.eventType,
        status: "PUBLISHED",
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        timezone: event.timezone,
        city: event.city,
        externalUrl: event.externalUrl,
        externalGroupUrlname: event.externalGroupUrlname,
        externalGroupName: event.externalGroupName,
        externalRsvpCount: event.externalRsvpCount,
        externalSyncedAt: syncedAt,
        updatedAt: syncedAt,
      },
    });
    imported += 1;
  }

  return {
    fetched: nodes.length,
    imported,
    skipped,
    networkUrlname: cfg.networkUrlname,
    syncedAt: syncedAt.toISOString(),
  };
}

export function registerMeetupIntegrationRoutes(app: Express): void {
  ensureMeetupTables().catch((error) => console.error("[meetup] integration table ensure failed:", error.message));

  app.get("/api/admin/integrations/meetup/status", requireEventAdmin, async (_req: Request, res: Response) => {
    try {
      await ensureMeetupTables();
      const cfg = config();
      const connection = await getConnection();
      const [sync] = await db.select({ lastSyncedAt: max(realistEvents.externalSyncedAt) })
        .from(realistEvents)
        .where(eq(realistEvents.externalSource, PROVIDER));
      res.json({
        configured: Boolean(cfg && stateSecret() && tokenSecret()),
        connected: Boolean(connection),
        networkUrlname: cfg?.networkUrlname || DEFAULT_NETWORK_URLNAME,
        account: connection?.externalEmail || null,
        lastSyncedAt: sync?.lastSyncedAt || null,
      });
    } catch (error) {
      console.error("[meetup] status failed:", error);
      res.status(500).json({ error: "Failed to check Meetup connection" });
    }
  });

  app.get("/api/admin/integrations/meetup/connect", requireEventAdmin, async (req: Request, res: Response) => {
    const cfg = config();
    const secret = stateSecret();
    const user = await getSessionUser(req);
    if (!cfg || !secret || !user) return res.status(503).send("Meetup OAuth is not configured");
    const params = new URLSearchParams({
      client_id: cfg.clientId,
      response_type: "code",
      redirect_uri: cfg.redirectUri,
      state: signMeetupOAuthState(user.id, secret),
    });
    res.redirect(`${AUTH_URL}?${params.toString()}`);
  });

  app.get("/api/auth/meetup/callback", async (req: Request, res: Response) => {
    const { code, state, error } = req.query;
    if (error || typeof code !== "string" || typeof state !== "string") {
      return res.redirect("/admin/events?meetup=denied");
    }
    const secret = stateSecret();
    const userId = secret ? verifyMeetupOAuthState(state, secret) : null;
    const sessionUser = await getSessionUser(req);
    if (!userId || !sessionUser || sessionUser.id !== userId || !(await isEventAdminRequest(req))) {
      return res.redirect("/admin/events?meetup=invalid-state");
    }
    try {
      await ensureMeetupTables();
      await exchangeAuthorizationCode(userId, code);
      await runMeetupEventSync();
      return res.redirect("/admin/events?meetup=connected");
    } catch (syncError) {
      console.error("[meetup] OAuth callback failed:", syncError);
      return res.redirect("/admin/events?meetup=error");
    }
  });

  app.post("/api/admin/integrations/meetup/sync", requireEventAdmin, async (_req: Request, res: Response) => {
    try {
      res.json(await runMeetupEventSync());
    } catch (error) {
      console.error("[meetup] manual sync failed:", error);
      res.status(502).json({ error: error instanceof Error ? error.message : "Meetup sync failed" });
    }
  });

  app.post("/api/integrations/meetup/sync", async (req: Request, res: Response) => {
    if (!cronKeyOk(req) && !(await isEventAdminRequest(req))) return res.status(401).json({ error: "Unauthorized" });
    try {
      res.json(await runMeetupEventSync());
    } catch (error) {
      console.error("[meetup] scheduled sync failed:", error);
      res.status(502).json({ error: error instanceof Error ? error.message : "Meetup sync failed" });
    }
  });
}

export function scheduleMeetupEventSync(log: (message: string, source?: string) => void): void {
  const sync = async () => {
    if (!config()) return;
    try {
      const result = await runMeetupEventSync();
      log(`Meetup sync imported ${result.imported}/${result.fetched} upcoming events`, "meetup");
    } catch (error) {
      log(`Meetup sync failed: ${error instanceof Error ? error.message : String(error)}`, "meetup");
    }
  };
  cron.schedule("17 */6 * * *", sync, { timezone: "America/Toronto" });
  setTimeout(sync, 5 * 60 * 1000);
}
