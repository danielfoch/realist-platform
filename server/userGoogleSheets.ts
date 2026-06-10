/**
 * Per-user Google Sheets integration — OAuth connect + export.
 *
 * Every USER-facing export goes through the user's OWN Google account via
 * the OAuth authorization-code flow, so spreadsheets are created in the
 * user's Drive, owned by them. The owner-account Replit connector
 * (server/googleSheets.ts getUncachableGoogleSheetClient) remains only for
 * ADMIN/internal exports (see server/leadsSheet.ts).
 *
 * Routes:
 *   GET    /api/integrations/google/status
 *   GET    /api/integrations/google/auth-url
 *   GET    /api/integrations/google/callback   (HMAC state carries the user id)
 *   DELETE /api/integrations/google
 *   POST   /api/integrations/google/export/:analysisId
 *
 * Required env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET; optional
 * GOOGLE_REDIRECT_URI (defaults to the live domain callback) and
 * GOOGLE_OAUTH_STATE_SECRET (falls back to SESSION_SECRET).
 *
 * Ported from the idx app (src/google-sheets.ts + src/integration-routes.ts),
 * adapted to Drizzle, the live session auth, and the live
 * users / property_analyses / user_activity_events tables.
 */

import type { Express, Request, Response } from "express";
import "express-session";
import { and, desc, eq } from "drizzle-orm";
import { db } from "./db";
import { isAuthenticated } from "./auth";
import { logUserActivity } from "./userActivity";
import { propertyAnalyses, userIntegrations, users } from "@shared/schema";
import { signGoogleOAuthState, verifyGoogleOAuthState } from "@shared/googleOAuthState";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

// drive.file = only files this app creates; the narrowest scope that works.
const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
  "openid",
  "email",
];

const PROVIDER = "google";
const CONNECT_RETURN_PATH = "/my-performance";

function clientConfig(): { clientId: string; clientSecret: string; redirectUri: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    (process.env.NODE_ENV === "production"
      ? "https://realist.ca/api/integrations/google/callback"
      : `https://${process.env.REPLIT_DEV_DOMAIN}/api/integrations/google/callback`);
  return { clientId, clientSecret, redirectUri };
}

function stateSecret(): string {
  return process.env.GOOGLE_OAUTH_STATE_SECRET || process.env.SESSION_SECRET || "change-me";
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}

async function postToken(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token endpoint ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as TokenResponse;
}

function expiryFromNow(expiresIn: number): Date {
  return new Date(Date.now() + Math.max(0, Number(expiresIn) || 0) * 1000);
}

async function getIntegration(userId: string) {
  const [row] = await db.select().from(userIntegrations).where(and(
    eq(userIntegrations.userId, userId),
    eq(userIntegrations.provider, PROVIDER),
  )).limit(1);
  return row;
}

async function exchangeCodeAndStore(userId: string, code: string): Promise<void> {
  const cfg = clientConfig();
  if (!cfg) throw new Error("Google OAuth is not configured");

  const tokens = await postToken(new URLSearchParams({
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
    grant_type: "authorization_code",
  }));

  if (!tokens.refresh_token) {
    throw new Error("Google did not return a refresh token — user may need to revoke prior access and reconnect");
  }

  // Which Google account did they connect? (non-fatal if unavailable)
  let externalEmail: string | null = null;
  try {
    const infoRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (infoRes.ok) {
      const info = (await infoRes.json()) as { email?: string };
      externalEmail = info.email ?? null;
    }
  } catch {
    // non-fatal
  }

  await db.insert(userIntegrations).values({
    userId,
    provider: PROVIDER,
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token,
    tokenExpiresAt: expiryFromNow(tokens.expires_in),
    scope: tokens.scope ?? SCOPES.join(" "),
    externalEmail,
  }).onConflictDoUpdate({
    target: [userIntegrations.userId, userIntegrations.provider],
    set: {
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      tokenExpiresAt: expiryFromNow(tokens.expires_in),
      scope: tokens.scope ?? SCOPES.join(" "),
      externalEmail,
      updatedAt: new Date(),
    },
  });
}

async function getFreshAccessToken(userId: string): Promise<string> {
  const cfg = clientConfig();
  if (!cfg) throw new Error("Google OAuth is not configured");

  const row = await getIntegration(userId);
  if (!row) throw new Error("Google account not connected");

  const expiresAt = row.tokenExpiresAt ? new Date(row.tokenExpiresAt).getTime() : 0;
  if (row.accessToken && expiresAt - Date.now() > 60_000) {
    return row.accessToken;
  }

  const tokens = await postToken(new URLSearchParams({
    refresh_token: row.refreshToken,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: "refresh_token",
  }));

  await db.update(userIntegrations).set({
    accessToken: tokens.access_token,
    tokenExpiresAt: expiryFromNow(tokens.expires_in),
    updatedAt: new Date(),
  }).where(eq(userIntegrations.id, row.id));

  return tokens.access_token;
}

function entriesToRows(label: string, obj: Record<string, unknown> | null | undefined): (string | number)[][] {
  if (!obj || typeof obj !== "object") return [];
  const rows: (string | number)[][] = [[label, ""]];
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    rows.push([key, typeof value === "object" ? JSON.stringify(value) : (value as string | number)]);
  }
  rows.push(["", ""]);
  return rows;
}

export function analysisDisplayAddress(analysis: {
  title: string | null;
  listingMlsNumber: string;
  listingSnapshot: unknown;
  city: string | null;
}): string {
  const snapshot = (analysis.listingSnapshot || {}) as Record<string, unknown>;
  const snapshotAddress =
    (typeof snapshot.address === "string" && snapshot.address) ||
    (typeof snapshot.streetAddress === "string" && snapshot.streetAddress) ||
    (typeof snapshot.unparsedAddress === "string" && snapshot.unparsedAddress) ||
    null;
  return (
    analysis.title ||
    snapshotAddress ||
    [analysis.city, `MLS ${analysis.listingMlsNumber}`].filter(Boolean).join(" — ")
  );
}

/**
 * Create a spreadsheet in the USER's Google Drive containing the analysis.
 * Returns the spreadsheet URL. Uses the Sheets v4 REST API directly so the
 * file is owned by the user — no service account, no public link.
 */
async function exportAnalysisToSheet(
  userId: string,
  analysis: typeof propertyAnalyses.$inferSelect,
): Promise<string> {
  const accessToken = await getFreshAccessToken(userId);
  const address = analysisDisplayAddress(analysis);

  const values: (string | number)[][] = [
    ["Realist.ca Deal Analysis", ""],
    ["Property", address],
    ["City", analysis.city ?? ""],
    ["Province", analysis.province ?? ""],
    ["Property type", analysis.propertyType ?? ""],
    ["MLS number", analysis.listingMlsNumber],
    ["Listing price", analysis.listingPrice ?? ""],
    ["Analyzed at", new Date(analysis.createdAt).toISOString()],
    ["", ""],
    ...entriesToRows("— Metrics —", analysis.calculatedMetrics as Record<string, unknown> | null),
    ...entriesToRows("— Assumptions / Inputs —", (analysis.finalAssumptions || analysis.assumptions) as Record<string, unknown> | null),
    ...(analysis.userNotes ? [["Notes", analysis.userNotes] as (string | number)[]] : []),
    ["", ""],
    ["Generated by", "Realist.ca — model outputs, not investment advice"],
  ];

  const createRes = await fetch(SHEETS_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      properties: { title: `Realist Analysis — ${address}` },
      sheets: [{ properties: { title: "Analysis" } }],
    }),
  });
  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Sheets create failed ${createRes.status}: ${text.slice(0, 200)}`);
  }
  const sheet = (await createRes.json()) as { spreadsheetId: string; spreadsheetUrl: string };

  const writeRes = await fetch(
    `${SHEETS_API}/${sheet.spreadsheetId}/values/Analysis!A1?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    },
  );
  if (!writeRes.ok) {
    const text = await writeRes.text();
    console.warn(`[user-google-sheets] values write failed ${writeRes.status}: ${text.slice(0, 200)}`);
  }

  return sheet.spreadsheetUrl;
}

export function registerUserGoogleSheetsRoutes(app: Express): void {
  /**
   * GET /api/integrations/google/status
   */
  app.get("/api/integrations/google/status", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const row = await getIntegration(req.session.userId!);
      res.json({
        connected: !!row,
        configured: clientConfig() !== null,
        email: row?.externalEmail ?? null,
      });
    } catch (error) {
      console.error("[user-google-sheets] status failed:", error);
      res.status(500).json({ error: "Failed to check Google status" });
    }
  });

  /**
   * GET /api/integrations/google/auth-url
   * Returns the Google consent URL. The HMAC-signed state carries the live
   * app's user id (uuid) so the callback works even without the session.
   */
  app.get("/api/integrations/google/auth-url", isAuthenticated, (req: Request, res: Response) => {
    const cfg = clientConfig();
    if (!cfg) {
      res.status(503).json({ error: "Google OAuth is not configured" });
      return;
    }
    const params = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: cfg.redirectUri,
      response_type: "code",
      scope: SCOPES.join(" "),
      access_type: "offline", // we need a refresh_token
      prompt: "consent",      // force refresh_token issuance on re-connect
      state: signGoogleOAuthState(req.session.userId!, stateSecret()),
    });
    res.json({ url: `${GOOGLE_AUTH_URL}?${params.toString()}` });
  });

  /**
   * GET /api/integrations/google/callback
   */
  app.get("/api/integrations/google/callback", async (req: Request, res: Response) => {
    const { code, state, error } = req.query;

    if (error || typeof code !== "string" || typeof state !== "string") {
      res.redirect(`${CONNECT_RETURN_PATH}?google=error&reason=denied`);
      return;
    }

    const userId = verifyGoogleOAuthState(state, stateSecret());
    if (!userId) {
      console.error("[user-google-sheets] callback: invalid or expired state");
      res.redirect(`${CONNECT_RETURN_PATH}?google=error&reason=state`);
      return;
    }

    try {
      await exchangeCodeAndStore(userId, code);
      await logUserActivity(req, {
        userId,
        eventName: "integration_connected",
        sourcePage: "/api/integrations/google/callback",
        metadata: { provider: PROVIDER },
      });
      res.redirect(`${CONNECT_RETURN_PATH}?google=connected`);
    } catch (err) {
      console.error("[user-google-sheets] code exchange failed:", err);
      res.redirect(`${CONNECT_RETURN_PATH}?google=error&reason=exchange`);
    }
  });

  /**
   * DELETE /api/integrations/google
   * Removes stored tokens and best-effort revokes the refresh token at Google.
   */
  app.delete("/api/integrations/google", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const [deleted] = await db.delete(userIntegrations).where(and(
        eq(userIntegrations.userId, req.session.userId!),
        eq(userIntegrations.provider, PROVIDER),
      )).returning({ refreshToken: userIntegrations.refreshToken });

      if (deleted?.refreshToken) {
        fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(deleted.refreshToken)}`, { method: "POST" })
          .catch(() => {});
      }
      res.json({ success: true });
    } catch (error) {
      console.error("[user-google-sheets] disconnect failed:", error);
      res.status(500).json({ error: "Failed to disconnect Google" });
    }
  });

  /**
   * POST /api/integrations/google/export/:analysisId
   * Exports the caller's own property_analyses row into a spreadsheet in
   * THEIR Drive. 409 GOOGLE_NOT_CONNECTED tells the client to run the
   * auth-url hop first.
   */
  app.post("/api/integrations/google/export/:analysisId", isAuthenticated, async (req: Request, res: Response) => {
    const userId = req.session.userId!;
    try {
      if (!clientConfig()) {
        res.status(503).json({ error: "Google OAuth is not configured" });
        return;
      }

      const [analysis] = await db.select().from(propertyAnalyses).where(and(
        eq(propertyAnalyses.id, req.params.analysisId),
        eq(propertyAnalyses.userId, userId),
        eq(propertyAnalyses.isDeleted, false),
      )).limit(1);
      if (!analysis) {
        res.status(404).json({ error: "Analysis not found" });
        return;
      }

      const integration = await getIntegration(userId);
      if (!integration) {
        res.status(409).json({
          error: "Google account not connected",
          code: "GOOGLE_NOT_CONNECTED",
          authUrlEndpoint: "/api/integrations/google/auth-url",
        });
        return;
      }

      let spreadsheetUrl: string;
      try {
        spreadsheetUrl = await exportAnalysisToSheet(userId, analysis);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // invalid_grant = revoked/expired refresh token — force a reconnect
        if (message.includes("invalid_grant")) {
          await db.delete(userIntegrations).where(eq(userIntegrations.id, integration.id));
          res.status(409).json({
            error: "Google connection expired — reconnect and try again",
            code: "GOOGLE_NOT_CONNECTED",
            authUrlEndpoint: "/api/integrations/google/auth-url",
          });
          return;
        }
        throw err;
      }

      // Feed the live activity-event sink (same pattern as dealDesk.ts)
      await logUserActivity(req, {
        userId,
        eventName: "deal_exported",
        analysisId: analysis.id,
        sourcePage: typeof req.body?.sourcePage === "string" ? req.body.sourcePage : null,
        metadata: {
          destination: "google_sheets",
          provider: PROVIDER,
          city: analysis.city,
          property_type: analysis.propertyType,
        },
      });

      res.json({ success: true, url: spreadsheetUrl });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[user-google-sheets] export failed:", message);
      res.status(500).json({ error: "Failed to export to Google Sheets", message });
    }
  });

  /**
   * Owner-only analysis reads for the integration surfaces (export buttons,
   * pitch deck). Path is /api/my/... to avoid colliding with the existing
   * /api/community/my-analyses/:mlsNumber and /api/analyses/:id routes,
   * which serve different tables.
   */
  app.get("/api/my/analyses", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const rows = await db.select({
        id: propertyAnalyses.id,
        title: propertyAnalyses.title,
        listingMlsNumber: propertyAnalyses.listingMlsNumber,
        listingSnapshot: propertyAnalyses.listingSnapshot,
        city: propertyAnalyses.city,
        province: propertyAnalyses.province,
        propertyType: propertyAnalyses.propertyType,
        listingPrice: propertyAnalyses.listingPrice,
        calculatedMetrics: propertyAnalyses.calculatedMetrics,
        createdAt: propertyAnalyses.createdAt,
      }).from(propertyAnalyses).where(and(
        eq(propertyAnalyses.userId, req.session.userId!),
        eq(propertyAnalyses.isDeleted, false),
      )).orderBy(desc(propertyAnalyses.createdAt)).limit(limit);

      res.json({
        success: true,
        data: rows.map((row) => ({ ...row, address: analysisDisplayAddress(row) })),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: message });
    }
  });

  app.get("/api/my/analyses/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const [analysis] = await db.select().from(propertyAnalyses).where(and(
        eq(propertyAnalyses.id, req.params.id),
        eq(propertyAnalyses.userId, req.session.userId!),
        eq(propertyAnalyses.isDeleted, false),
      )).limit(1);
      if (!analysis) {
        res.status(404).json({ success: false, error: "Analysis not found" });
        return;
      }

      const [owner] = await db.select({
        firstName: users.firstName,
        lastName: users.lastName,
      }).from(users).where(eq(users.id, analysis.userId)).limit(1);

      res.json({
        success: true,
        data: {
          ...analysis,
          address: analysisDisplayAddress(analysis),
          ownerName: [owner?.firstName, owner?.lastName].filter(Boolean).join(" ") || null,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: message });
    }
  });
}
