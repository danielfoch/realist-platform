/**
 * Pure mapping rules for carrying accounts over from the legacy realist.ca
 * database (scripts/migrate-users.ts does the I/O). Everything here is
 * deterministic and unit-tested — these are decisions about real people's
 * logins and consent, so none of it lives inline in a script.
 *
 * Legacy shapes are `Record<string, unknown>` on purpose: the live database
 * has drifted from its own schema file before, so rows are read with
 * SELECT * and unknown columns are preserved rather than assumed away.
 */

export type LegacyRow = Record<string, unknown>;

export interface MappedUser {
  id: string;
  email: string;
  passwordHash: string | null;
  googleId: string | null;
  name: string | null;
  phone: string | null;
  city: string | null;
  province: string | null;
  investorFocus: string | null;
  role: "user" | "admin";
  emailVerifiedAt: Date | null;
  consentMarketing: boolean;
  consentAt: Date | null;
  consentSource: string;
  legacy: Record<string, unknown>;
  createdAt: Date;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function date(value: unknown): Date | null {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export function normalizeLegacyEmail(value: unknown): string | null {
  const email = text(value)?.toLowerCase() ?? null;
  return email && email.includes("@") ? email : null;
}

/**
 * The legacy unique constraint was on the raw email, so "A@x.com" and
 * "a@x.com" can both exist. Exactly one may survive per normalized address:
 * the account someone can actually still get into (has a password, then has a
 * Google link), and among equals the oldest. The rest are folded into it.
 */
export function pickDuplicateWinner(
  rows: LegacyRow[],
  hasGoogleLink: (id: string) => boolean,
): LegacyRow {
  const score = (row: LegacyRow) =>
    (text(row.password_hash) ? 2 : 0) + (hasGoogleLink(String(row.id)) ? 1 : 0);
  return [...rows].sort((a, b) => {
    const byScore = score(b) - score(a);
    if (byScore !== 0) return byScore;
    const ta = date(a.created_at)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const tb = date(b.created_at)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (ta !== tb) return ta - tb;
    return String(a.id).localeCompare(String(b.id));
  })[0];
}

export interface ConsentInputs {
  /** email_consent rows for this user, any order. */
  ledger: Array<{ channel?: unknown; status?: unknown; source?: unknown; created_at?: unknown }>;
  /** users.email_digest_opt_in — NULL means opted in. */
  emailDigestOptIn: unknown;
  /** notification_preferences.marketing_email_enabled — no row / NULL means on. */
  marketingEmailEnabled: unknown;
  userCreatedAt: unknown;
}

/**
 * Reproduce the legacy app's three-layer gate exactly. Its rule — repeated in
 * seven modules there — is: the latest email-channel ledger row decides, and
 * NO rows means GRANTED; the digest flag and the marketing toggle can each
 * veto. Flipping that default on the way over would silently unsubscribe most
 * of the list, so it is preserved, and labelled so it stays auditable:
 * `legacy:default` marks consent that rests on the old default rather than on
 * a recorded act.
 */
export function effectiveConsent(input: ConsentInputs): {
  granted: boolean;
  at: Date | null;
  source: string;
} {
  const emailRows = input.ledger
    .filter((row) => (text(row.channel) ?? "email") === "email")
    .map((row) => ({ status: text(row.status), source: text(row.source), at: date(row.created_at) }))
    .sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0));
  const latest = emailRows[0];

  if (input.emailDigestOptIn === false) {
    return { granted: false, at: latest?.at ?? null, source: "legacy:unsubscribed" };
  }
  if (input.marketingEmailEnabled === false) {
    return { granted: false, at: latest?.at ?? null, source: "legacy:marketing_off" };
  }
  if (latest) {
    return {
      granted: latest.status !== "revoked",
      at: latest.at,
      source: `legacy:${latest.source ?? "ledger"}`,
    };
  }
  return { granted: true, at: date(input.userCreatedAt), source: "legacy:default" };
}

/** Columns that must never travel in the catch-all `legacy` blob. */
const SECRET_COLUMNS = new Set([
  "password_hash",
  "email_verification_token",
  "access_token",
  "refresh_token",
]);

/** Columns already mapped onto real fields. */
const MAPPED_COLUMNS = new Set([
  "id",
  "email",
  "password_hash",
  "first_name",
  "last_name",
  "phone",
  "role",
  "email_verified",
  "created_at",
  "updated_at",
]);

export function stripSecrets(row: LegacyRow): LegacyRow {
  return Object.fromEntries(Object.entries(row).filter(([key]) => !SECRET_COLUMNS.has(key)));
}

export function mapLegacyUser(input: {
  user: LegacyRow;
  googleId: string | null;
  profile: LegacyRow | null;
  consent: ReturnType<typeof effectiveConsent>;
  /** Ids of duplicate accounts folded into this one. */
  mergedIds?: string[];
}): MappedUser | null {
  const { user, profile } = input;
  const email = normalizeLegacyEmail(user.email);
  const id = text(user.id);
  if (!email || !id) return null;

  const name = [text(user.first_name), text(user.last_name)].filter(Boolean).join(" ") || null;
  const createdAt = date(user.created_at) ?? new Date();
  const legacyRole = text(user.role);

  // Unknown / drifted columns ride along untouched; secrets never do.
  const extras = Object.fromEntries(
    Object.entries(stripSecrets(user)).filter(([key, value]) => !MAPPED_COLUMNS.has(key) && value !== null),
  );

  return {
    id,
    email,
    passwordHash: text(user.password_hash),
    googleId: input.googleId,
    name,
    phone: text(user.phone) ?? text(profile?.phone),
    city: text(profile?.city),
    province: text(profile?.province),
    investorFocus: text(profile?.investment_goals),
    role: legacyRole === "admin" ? "admin" : "user",
    emailVerifiedAt: user.email_verified === true ? createdAt : null,
    consentMarketing: input.consent.granted,
    consentAt: input.consent.at,
    consentSource: input.consent.source,
    legacy: {
      ...extras,
      role: legacyRole,
      ...(text(profile?.bio) ? { bio: text(profile?.bio) } : {}),
      ...(input.mergedIds?.length ? { mergedLegacyIds: input.mergedIds } : {}),
    },
    createdAt,
  };
}

/** Pull a number out of the analyzer's results blob, whatever it was called. */
function firstNumber(source: unknown, keys: string[]): number | null {
  if (!source || typeof source !== "object") return null;
  const record = source as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && isFinite(Number(value))) return Number(value);
  }
  for (const nested of ["metrics", "summary", "results"]) {
    const found = firstNumber(record[nested], keys);
    if (found !== null) return found;
  }
  return null;
}

/** Headline fields for a legacy analyzer save, for the account page's archive list. */
export function snapshotFromLegacyDeal(row: LegacyRow): Record<string, string | number | null> {
  return {
    source: "legacy_deal_analyzer",
    address: text(row.address),
    city: text(row.city),
    province: text(row.province),
    strategy: text(row.strategy_type),
    mlsNumber: text(row.mls_number),
    capRate: firstNumber(row.results_json, ["capRate", "cap_rate", "capRatePct"]),
    cashFlowMonthly: firstNumber(row.results_json, ["monthlyCashFlow", "cashFlowMonthly", "monthly_cash_flow", "cashFlow"]),
    purchasePrice: firstNumber(row.inputs_json, ["purchasePrice", "purchase_price", "price"]),
  };
}
