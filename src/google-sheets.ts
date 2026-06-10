/**
 * Google Sheets integration — per-user OAuth.
 *
 * Every export uses the investor's OWN Google account via the OAuth
 * authorization-code flow. We never touch a service account, so spreadsheets
 * are created in the user's Drive, owned by them.
 *
 * Required env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
 * (e.g. https://realist.ca/api/integrations/google/callback)
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { db } from './db';
import { logger } from './logger';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

// drive.file = only files this app creates; the narrowest scope that works
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file', 'openid', 'email'];

function clientConfig(): { clientId: string; clientSecret: string; redirectUri: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

export function isGoogleConfigured(): boolean {
  return clientConfig() !== null;
}

// ---------- Signed state (CSRF protection on the callback) ----------

function stateSecret(): string {
  return process.env.GOOGLE_OAUTH_STATE_SECRET || process.env.JWT_SECRET || 'change-me';
}

export function signState(userId: number): string {
  const payload = `${userId}.${Date.now()}`;
  const sig = createHmac('sha256', stateSecret()).update(payload).digest('hex');
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

const STATE_MAX_AGE_MS = 15 * 60 * 1000;

export function verifyState(state: string): number | null {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const [userIdStr, tsStr, sig] = decoded.split('.');
    const payload = `${userIdStr}.${tsStr}`;
    const expected = createHmac('sha256', stateSecret()).update(payload).digest('hex');
    const sigBuf = Buffer.from(sig, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
    if (Date.now() - Number(tsStr) > STATE_MAX_AGE_MS) return null;
    const userId = Number(userIdStr);
    return Number.isInteger(userId) && userId > 0 ? userId : null;
  } catch {
    return null;
  }
}

// ---------- OAuth flow ----------

export function buildAuthUrl(userId: number): string {
  const cfg = clientConfig();
  if (!cfg) throw new Error('Google OAuth is not configured');
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline', // we need a refresh_token
    prompt: 'consent',      // force refresh_token issuance on re-connect
    state: signState(userId),
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}

async function postToken(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token endpoint ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as TokenResponse;
}

export async function exchangeCodeAndStore(userId: number, code: string): Promise<void> {
  const cfg = clientConfig();
  if (!cfg) throw new Error('Google OAuth is not configured');

  const tokens = await postToken(
    new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
      grant_type: 'authorization_code',
    }),
  );

  if (!tokens.refresh_token) {
    throw new Error('Google did not return a refresh token — user may need to revoke prior access and reconnect');
  }

  // Which Google account did they connect?
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

  await db.query(
    `INSERT INTO user_integrations (user_id, provider, refresh_token, access_token, token_expires_at, scope, external_email)
     VALUES ($1, 'google', $2, $3, NOW() + ($4 || ' seconds')::interval, $5, $6)
     ON CONFLICT (user_id, provider) DO UPDATE SET
       refresh_token = EXCLUDED.refresh_token,
       access_token = EXCLUDED.access_token,
       token_expires_at = EXCLUDED.token_expires_at,
       scope = EXCLUDED.scope,
       external_email = EXCLUDED.external_email,
       updated_at = NOW()`,
    [userId, tokens.refresh_token, tokens.access_token, String(tokens.expires_in), tokens.scope ?? SCOPES.join(' '), externalEmail],
  );
}

export async function getConnection(userId: number): Promise<{ externalEmail: string | null } | null> {
  const result = await db.query<{ external_email: string | null }>(
    `SELECT external_email FROM user_integrations WHERE user_id = $1 AND provider = 'google'`,
    [userId],
  );
  return result.rows.length > 0 ? { externalEmail: result.rows[0].external_email } : null;
}

export async function disconnect(userId: number): Promise<void> {
  const result = await db.query<{ refresh_token: string }>(
    `DELETE FROM user_integrations WHERE user_id = $1 AND provider = 'google' RETURNING refresh_token`,
    [userId],
  );
  const token = result.rows[0]?.refresh_token;
  if (token) {
    // Best-effort revocation at Google's side
    fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => {});
  }
}

async function getFreshAccessToken(userId: number): Promise<string> {
  const cfg = clientConfig();
  if (!cfg) throw new Error('Google OAuth is not configured');

  const result = await db.query<{ refresh_token: string; access_token: string | null; token_expires_at: Date | null }>(
    `SELECT refresh_token, access_token, token_expires_at FROM user_integrations
     WHERE user_id = $1 AND provider = 'google'`,
    [userId],
  );
  if (result.rows.length === 0) throw new Error('Google account not connected');

  const row = result.rows[0];
  const expiresAt = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0;
  if (row.access_token && expiresAt - Date.now() > 60_000) {
    return row.access_token;
  }

  const tokens = await postToken(
    new URLSearchParams({
      refresh_token: row.refresh_token,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      grant_type: 'refresh_token',
    }),
  );

  await db.query(
    `UPDATE user_integrations
     SET access_token = $1, token_expires_at = NOW() + ($2 || ' seconds')::interval, updated_at = NOW()
     WHERE user_id = $3 AND provider = 'google'`,
    [tokens.access_token, String(tokens.expires_in), userId],
  );

  return tokens.access_token;
}

// ---------- Export ----------

interface AnalysisRow {
  id: number;
  property_address: string;
  city: string | null;
  province: string | null;
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  verdict_check: string | null;
  metrics: Record<string, unknown> | null;
  inputs: Record<string, unknown> | null;
  notes: string | null;
  analyzed_at: Date;
}

function entriesToRows(label: string, obj: Record<string, unknown> | null): (string | number)[][] {
  if (!obj) return [];
  const rows: (string | number)[][] = [[label, '']];
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    rows.push([key, typeof value === 'object' ? JSON.stringify(value) : (value as string | number)]);
  }
  rows.push(['', '']);
  return rows;
}

/**
 * Create a spreadsheet in the USER's Google Drive containing the analysis.
 * Returns the spreadsheet URL.
 */
export async function exportAnalysisToSheet(userId: number, analysis: AnalysisRow): Promise<string> {
  const accessToken = await getFreshAccessToken(userId);

  const values: (string | number)[][] = [
    ['Realist.ca Deal Analysis', ''],
    ['Property', analysis.property_address],
    ['City', analysis.city ?? ''],
    ['Province', analysis.province ?? ''],
    ['Property type', analysis.property_type ?? ''],
    ['Bedrooms', analysis.bedrooms ?? ''],
    ['Bathrooms', analysis.bathrooms ?? ''],
    ['Sqft', analysis.sqft ?? ''],
    ['Verdict', analysis.verdict_check ?? ''],
    ['Analyzed at', new Date(analysis.analyzed_at).toISOString()],
    ['', ''],
    ...entriesToRows('— Metrics —', analysis.metrics),
    ...entriesToRows('— Assumptions / Inputs —', analysis.inputs),
    ...(analysis.notes ? [['Notes', analysis.notes] as (string | number)[]] : []),
    ['', ''],
    ['Generated by', 'Realist.ca — model outputs, not investment advice'],
  ];

  const createRes = await fetch(SHEETS_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title: `Realist Analysis — ${analysis.property_address}` },
      sheets: [{ properties: { title: 'Analysis' } }],
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
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    },
  );
  if (!writeRes.ok) {
    const text = await writeRes.text();
    logger.warn('Sheets values write failed', { status: writeRes.status, body: text.slice(0, 200) });
  }

  return sheet.spreadsheetUrl;
}
