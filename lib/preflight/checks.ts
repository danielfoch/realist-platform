/**
 * Go-live preflight. Answers one question — "if I deployed right now, what
 * wouldn't work?" — by checking every key and connection the site depends on,
 * using only read-only calls. It never prints a secret, never writes, never
 * sends anything. `npm run preflight` runs it; `scripts/preflight.ts` is the CLI.
 */

export type CheckStatus = "ok" | "missing" | "broken" | "warn";

export interface CheckResult {
  name: string;
  status: CheckStatus;
  /** Does launch depend on it? Optional things never fail the run. */
  required: boolean;
  detail: string;
  /** What to do about it, when something is off. */
  fix?: string;
}

type Env = Record<string, string | undefined>;
type Fetch = typeof fetch;

const has = (env: Env, ...names: string[]) => names.some((name) => Boolean(env[name]?.trim()));
const value = (env: Env, ...names: string[]) => names.map((name) => env[name]?.trim()).find(Boolean) ?? "";
/**
 * `vercel env pull` writes a variable marked Sensitive as an empty string: it exists in
 * Vercel, but its value never leaves. That is "set, and we can't look" — not "missing".
 */
const hidden = (env: Env, ...names: string[]) => !has(env, ...names) && names.some((name) => env[name] !== undefined);
const HIDDEN = "is set in Vercel as a sensitive value, which can't be downloaded — so it can't be tested from here";

async function getJson(fetcher: Fetch, url: string, headers: Record<string, string>): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetcher(url, { headers: { Accept: "application/json", ...headers }, signal: AbortSignal.timeout(10_000) });
  return { status: response.status, body: (await response.json().catch(() => ({}))) as Record<string, unknown> };
}

export function checkSite(env: Env): CheckResult {
  const url = value(env, "NEXT_PUBLIC_SITE_URL");
  if (!url && hidden(env, "NEXT_PUBLIC_SITE_URL")) return { name: "Site URL", status: "ok", required: false, detail: `NEXT_PUBLIC_SITE_URL ${HIDDEN}.` };
  if (!url) return { name: "Site URL", status: "warn", required: false, detail: "NEXT_PUBLIC_SITE_URL is not set — links in emails and share cards default to https://realist.ca." };
  return /^https:\/\//.test(url)
    ? { name: "Site URL", status: "ok", required: false, detail: url }
    : { name: "Site URL", status: "broken", required: true, detail: `${url} is not https`, fix: "Set NEXT_PUBLIC_SITE_URL to the https origin people will use." };
}

export function checkSecrets(env: Env): CheckResult[] {
  const emails = (name: string) => value(env, name).split(",").map((part) => part.trim()).filter(Boolean);
  const valid = (list: string[]) => list.length > 0 && list.every((email) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email));
  const results: CheckResult[] = [
    has(env, "CRON_SECRET") || hidden(env, "CRON_SECRET")
      ? { name: "Cron secret", status: "ok", required: true, detail: "CRON_SECRET is set (retries, learning and the Monday note can run)." }
      : { name: "Cron secret", status: "missing", required: true, detail: "CRON_SECRET is not set.", fix: "Add CRON_SECRET in Vercel — without it no lead is ever retried." },
  ];
  for (const [name, label, who] of [
    ["ACQUISITION_LEAD_EMAILS", "Acquisition inbox", "offers, showings and underwriting help"],
    ["FINANCING_LEAD_EMAILS", "Financing inbox", "financing requests"],
  ] as const) {
    const list = emails(name);
    if (!list.length && hidden(env, name)) {
      results.push({ name: label, status: "warn", required: true, detail: `${name} ${HIDDEN}. It's an address list, not a secret: un-mark it Sensitive and this can check it.` });
      continue;
    }
    results.push(
      valid(list)
        ? { name: label, status: "ok", required: true, detail: `${list.length} address${list.length === 1 ? "" : "es"} will be emailed for ${who}.` }
        : { name: label, status: list.length ? "broken" : "missing", required: true, detail: list.length ? `${name} contains something that isn't an email address.` : `${name} is not set.`, fix: `Set ${name} to a comma-separated list of addresses.` },
    );
  }
  results.push(
    valid(emails("ADMIN_EMAILS")) || hidden(env, "ADMIN_EMAILS")
      ? { name: "Admin access", status: "ok", required: false, detail: "ADMIN_EMAILS is set — sign in once with a link or Google so the address is verified, then open /admin/leads." }
      : { name: "Admin access", status: "warn", required: false, detail: "ADMIN_EMAILS is not set — nobody can open /admin/leads.", fix: "Set ADMIN_EMAILS to your address." },
    (has(env, "GOOGLE_CLIENT_ID") || hidden(env, "GOOGLE_CLIENT_ID")) && (has(env, "GOOGLE_CLIENT_SECRET") || hidden(env, "GOOGLE_CLIENT_SECRET"))
      ? { name: "Google sign-in", status: "ok", required: false, detail: "Keys are set. Make sure <site>/api/auth/google/callback is an authorised redirect URI in Google Cloud." }
      : { name: "Google sign-in", status: "warn", required: false, detail: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set — the Google button stays hidden; email links and passwords still work." },
    has(env, "KEYPR_REALIST_SECRET") || hidden(env, "KEYPR_REALIST_SECRET")
      ? { name: "Keypr cash-back handoff", status: "ok", required: false, detail: "KEYPR_REALIST_SECRET is set." }
      : { name: "Keypr cash-back handoff", status: "warn", required: false, detail: "KEYPR_REALIST_SECRET is not set — consented Ontario requests wait in the outbox until it is.", fix: "Copy the value from the Replit app's Secrets." },
  );
  if (value(env, "WEEKLY_DIGEST_ENABLED") === "1" && !has(env, "EMAIL_POSTAL_ADDRESS")) {
    results.push({ name: "Monday note", status: "broken", required: false, detail: "WEEKLY_DIGEST_ENABLED=1 but EMAIL_POSTAL_ADDRESS is empty — it will send nothing.", fix: "CASL needs a mailing address in every commercial email: set EMAIL_POSTAL_ADDRESS." });
  }
  return results;
}

export async function checkGhl(env: Env, fetcher: Fetch = fetch): Promise<CheckResult[]> {
  const token = value(env, "GHL_API_KEY", "HIGHLEVEL_TOKEN");
  const locationId = value(env, "GHL_LOCATION_ID", "HIGHLEVEL_LOCATION_ID");
  const webhook = value(env, "GHL_WEBHOOK_URL");
  if ((!token && hidden(env, "GHL_API_KEY", "HIGHLEVEL_TOKEN")) || (!locationId && hidden(env, "GHL_LOCATION_ID", "HIGHLEVEL_LOCATION_ID"))) {
    return [{ name: "GoHighLevel", status: "warn", required: true, detail: `The GHL token ${HIDDEN}.`, fix: "After deploying, /admin/leads shows whether it's connected, and the first lead proves it." }];
  }
  if (!token || !locationId) {
    return [
      webhook.startsWith("https://")
        ? { name: "GoHighLevel", status: "ok", required: true, detail: "Leads go to the inbound webhook (GHL_WEBHOOK_URL). No API token, so no tags-by-API, notes or opportunities." }
        : { name: "GoHighLevel", status: "missing", required: true, detail: "No GHL_API_KEY + GHL_LOCATION_ID (and no GHL_WEBHOOK_URL).", fix: "GoHighLevel → Settings → Private Integrations → new token with contacts read/write. Leads captured meanwhile wait and are delivered once it's set." },
    ];
  }
  const headers = { Authorization: `Bearer ${token}`, Version: "2021-07-28" };
  const base = "https://services.leadconnectorhq.com";
  const results: CheckResult[] = [];
  try {
    // The exact call delivery makes first, for an address that can't exist.
    const probe = await getJson(fetcher, `${base}/contacts/search/duplicate?locationId=${encodeURIComponent(locationId)}&email=${encodeURIComponent("preflight-check@realist.invalid")}`, headers);
    results.push(
      probe.status === 200
        ? { name: "GoHighLevel", status: "ok", required: true, detail: "The token can read contacts in this location." }
        : { name: "GoHighLevel", status: "broken", required: true, detail: `GHL answered HTTP ${probe.status} to a contact lookup.`, fix: probe.status === 401 || probe.status === 403 ? "The token is wrong, expired, or lacks the contacts scopes — or GHL_LOCATION_ID isn't the sub-account it belongs to." : "Check GHL_LOCATION_ID." },
    );
  } catch (error) {
    results.push({ name: "GoHighLevel", status: "broken", required: true, detail: `Couldn't reach GHL: ${(error as Error).message}` });
  }
  const pipelineId = value(env, "GHL_PIPELINE_ID");
  if (pipelineId) {
    const stageId = value(env, "GHL_PIPELINE_STAGE_ID", "GHL_STAGE_ID");
    try {
      const { status, body } = await getJson(fetcher, `${base}/opportunities/pipelines?locationId=${encodeURIComponent(locationId)}`, headers);
      const pipelines = (Array.isArray(body.pipelines) ? body.pipelines : []) as Array<{ id?: string; name?: string; stages?: Array<{ id?: string; name?: string }> }>;
      const pipeline = pipelines.find((row) => row.id === pipelineId);
      if (status !== 200) results.push({ name: "GHL pipeline", status: "broken", required: false, detail: `HTTP ${status} listing pipelines.`, fix: "Give the token the opportunities read + write scopes." });
      else if (!pipeline) results.push({ name: "GHL pipeline", status: "broken", required: false, detail: "GHL_PIPELINE_ID doesn't match any pipeline in this location.", fix: `Pipelines here: ${pipelines.map((row) => `${row.name} (${row.id})`).join(", ") || "none"}` });
      else if (stageId && !pipeline.stages?.some((stage) => stage.id === stageId)) results.push({ name: "GHL pipeline", status: "broken", required: false, detail: `GHL_PIPELINE_STAGE_ID isn't a stage of "${pipeline.name}".`, fix: `Stages: ${(pipeline.stages ?? []).map((stage) => `${stage.name} (${stage.id})`).join(", ")}` });
      else results.push({ name: "GHL pipeline", status: "ok", required: false, detail: `Showing, offer and financing requests open opportunities on "${pipeline.name}".` });
    } catch (error) {
      results.push({ name: "GHL pipeline", status: "broken", required: false, detail: `Couldn't list pipelines: ${(error as Error).message}` });
    }
  }
  return results;
}

export async function checkResend(env: Env, fetcher: Fetch = fetch): Promise<CheckResult> {
  const key = value(env, "RESEND_API_KEY");
  if (!key && hidden(env, "RESEND_API_KEY")) return { name: "Email (Resend)", status: "warn", required: true, detail: `RESEND_API_KEY ${HIDDEN}.`, fix: "Confirm realist.ca shows as Verified in Resend; after deploying, ask for a sign-in link to prove it." };
  if (!key) return { name: "Email (Resend)", status: "missing", required: true, detail: "RESEND_API_KEY is not set.", fix: "Most v1 members have no password — without email they cannot sign in, and nobody gets a receipt." };
  const from = value(env, "EMAIL_FROM") || "Realist <hello@realist.ca>";
  const domain = (from.match(/@([^>\s]+)/)?.[1] ?? "").toLowerCase();
  try {
    const { status, body } = await getJson(fetcher, "https://api.resend.com/domains", { Authorization: `Bearer ${key}` });
    if (status === 401 || status === 403) {
      const restricted = JSON.stringify(body).includes("restricted");
      return restricted
        ? { name: "Email (Resend)", status: "warn", required: true, detail: `The key is send-only, so the ${domain} domain can't be checked from here.`, fix: `Confirm ${domain} shows as Verified in Resend.` }
        : { name: "Email (Resend)", status: "broken", required: true, detail: "Resend rejected the key.", fix: "Create a new API key in Resend." };
    }
    const domains = (Array.isArray(body.data) ? body.data : []) as Array<{ name?: string; status?: string }>;
    const match = domains.find((row) => row.name?.toLowerCase() === domain);
    if (match?.status === "verified") return { name: "Email (Resend)", status: "ok", required: true, detail: `${domain} is verified; mail sends as ${from}.` };
    return { name: "Email (Resend)", status: "broken", required: true, detail: match ? `${domain} is "${match.status}" in Resend, not verified.` : `${domain} isn't a domain on this Resend account.`, fix: `Add and verify ${domain} in Resend (DNS records), or set EMAIL_FROM to a verified domain.` };
  } catch (error) {
    return { name: "Email (Resend)", status: "broken", required: true, detail: `Couldn't reach Resend: ${(error as Error).message}` };
  }
}

export async function checkAnthropic(env: Env, fetcher: Fetch = fetch): Promise<CheckResult> {
  const key = value(env, "ANTHROPIC_API_KEY");
  if (!key && hidden(env, "ANTHROPIC_API_KEY")) return { name: "AI (Anthropic)", status: "warn", required: false, detail: `ANTHROPIC_API_KEY ${HIDDEN}.` };
  if (!key) return { name: "AI (Anthropic)", status: "warn", required: false, detail: "ANTHROPIC_API_KEY is not set — memos and multiplex reports use the rules-based versions; Ask Realist stays hidden." };
  try {
    const { status } = await getJson(fetcher, "https://api.anthropic.com/v1/models?limit=1", { "x-api-key": key, "anthropic-version": "2023-06-01" });
    return status === 200
      ? { name: "AI (Anthropic)", status: "ok", required: false, detail: `Key works. Site-wide ceiling: ${value(env, "AI_DAILY_BUDGET") || "2000 (default)"} calls a day.` }
      : { name: "AI (Anthropic)", status: "broken", required: false, detail: `Anthropic answered HTTP ${status}.`, fix: "Check ANTHROPIC_API_KEY." };
  } catch (error) {
    return { name: "AI (Anthropic)", status: "broken", required: false, detail: `Couldn't reach Anthropic: ${(error as Error).message}` };
  }
}

/** Tables (and the newest column) the running code expects. A miss means `npm run db:push` hasn't been run against this database. */
export const EXPECTED_TABLES = ["users", "sessions", "auth_throttle", "saved_deals", "leads", "lead_deliveries", "deal_analyses", "learned_assumptions", "ddf_listing_snapshots"] as const;

export interface DbFacts {
  tables: string[];
  hasNewestColumn: boolean;
  members: number;
  legacyMembers: number;
  freshListings: number;
  waitingDeliveries: number;
}

export function checkDatabase(url: string, facts: DbFacts | Error): CheckResult[] {
  if (!url) return [{ name: "Database", status: "missing", required: true, detail: "DATABASE_URL is not set — nothing persists: no accounts, no leads, no analyses.", fix: "Vercel → Storage → Create → Neon, then `npm run db:push` once." }];
  if (facts instanceof Error) return [{ name: "Database", status: "broken", required: true, detail: `Couldn't connect: ${facts.message}`, fix: "Check DATABASE_URL (and that the database accepts connections from here)." }];
  const missing = EXPECTED_TABLES.filter((table) => !facts.tables.includes(table));
  if (missing.length || !facts.hasNewestColumn) {
    return [{ name: "Database", status: "broken", required: true, detail: missing.length ? `Connected, but the schema is missing: ${missing.join(", ")}.` : "Connected, but the schema is behind the code.", fix: "Run `npm run db:push` against this database." }];
  }
  return [
    { name: "Database", status: "ok", required: true, detail: `Connected; schema is current. ${facts.members.toLocaleString("en-CA")} members.` },
    facts.legacyMembers > 0
      ? { name: "v1 members", status: "ok", required: false, detail: `${facts.legacyMembers.toLocaleString("en-CA")} members carried over from the Replit app.` }
      : { name: "v1 members", status: "warn", required: false, detail: "No v1 members here yet.", fix: "`npm run migrate:users` (dry run), then `-- --commit`. Safe to re-run until cutover." },
    facts.freshListings > 0
      ? { name: "Listings crawl", status: "ok", required: false, detail: `${facts.freshListings.toLocaleString("en-CA")} listings seen in the last 7 days — yield browse, buy-box matches and the fallback all have data.` }
      : { name: "Listings crawl", status: "warn", required: false, detail: "No listings crawled in the last 7 days — yield-sorted browse and buy-box matches will be empty.", fix: "`npm run sync:ddf` (and add the CREA credentials to GitHub Actions for the nightly run)." },
    ...(facts.waitingDeliveries > 0 ? [{ name: "Outbox", status: "warn" as const, required: false, detail: `${facts.waitingDeliveries} lead deliveries are waiting — they go out on the next cron run, or press "Retry failed and deliver now" on /admin/leads.` }] : []),
  ];
}

export function checkDdf(env: Env): CheckResult {
  return (has(env, "CREA_DDF_USERNAME") || hidden(env, "CREA_DDF_USERNAME")) && (has(env, "CREA_DDF_PASSWORD") || hidden(env, "CREA_DDF_PASSWORD"))
    ? { name: "Live MLS® feed", status: "ok", required: false, detail: "CREA DDF credentials are set." }
    : { name: "Live MLS® feed", status: "warn", required: false, detail: "CREA_DDF_USERNAME / CREA_DDF_PASSWORD are not set — listings come from the last crawl only, and new listing pages can't be fetched live.", fix: "Add the DDF credentials (same ones the Replit app uses)." };
}

export function summarize(results: CheckResult[]): { ready: boolean; blockers: CheckResult[]; line: string } {
  const blockers = results.filter((result) => result.required && (result.status === "missing" || result.status === "broken"));
  const warnings = results.filter((result) => !blockers.includes(result) && result.status !== "ok");
  return {
    ready: blockers.length === 0,
    blockers,
    line: blockers.length === 0
      ? `Ready to deploy${warnings.length ? ` — ${warnings.length} optional item${warnings.length === 1 ? "" : "s"} still off` : ""}.`
      : `Not ready: ${blockers.length} thing${blockers.length === 1 ? "" : "s"} launch depends on ${blockers.length === 1 ? "is" : "are"} missing or broken.`,
  };
}
