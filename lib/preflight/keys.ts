/**
 * The keys only the owner can supply, in the order they matter — and the small
 * pure helpers `scripts/setup-keys.ts` needs. Nothing here reads or stores a
 * value; the script holds what is typed in memory just long enough to test it
 * and hand it to `vercel env add` over stdin (never argv, never disk).
 */

export interface KeySpec {
  name: string;
  /** What to type at the prompt, in plain words. */
  ask: string;
  /** Where the value comes from. */
  where: string;
  secret: boolean;
  /** A value that doesn't look like this is probably the wrong thing pasted. A hint, never a refusal. */
  looksLike?: RegExp;
  optional?: boolean;
}

export interface KeyGroup {
  title: string;
  why: string;
  keys: KeySpec[];
}

const EMAIL_LIST = /^\s*[^@\s,]+@[^@\s,]+\.[^@\s,]+(\s*,\s*[^@\s,]+@[^@\s,]+\.[^@\s,]+)*\s*$/;

export const KEY_GROUPS: KeyGroup[] = [
  {
    title: "GoHighLevel",
    why: "Every lead, tag, note and opportunity lands in your CRM. Leads captured until now are waiting and deliver the moment this is set.",
    keys: [
      { name: "GHL_API_KEY", ask: "Private integration token", where: "GoHighLevel → Settings → Private Integrations → Create. Scopes: contacts (read + write), opportunities (read + write).", secret: true, looksLike: /^pit-/ },
      { name: "GHL_LOCATION_ID", ask: "Location (sub-account) id", where: "GoHighLevel → Settings → Business Profile → Location ID.", secret: false, looksLike: /^[A-Za-z0-9]{15,30}$/ },
    ],
  },
  {
    title: "Who gets the emails",
    why: "A person reads every request. These are the inboxes.",
    keys: [
      { name: "ACQUISITION_LEAD_EMAILS", ask: "Offers, showings, underwriting help go to (comma-separated)", where: "Your acquisition inbox(es).", secret: false, looksLike: EMAIL_LIST },
      { name: "FINANCING_LEAD_EMAILS", ask: "Financing requests go to (comma-separated)", where: "Your mortgage partner's inbox(es). Acquisition is copied.", secret: false, looksLike: EMAIL_LIST },
      { name: "ADMIN_EMAILS", ask: "Who may open /admin/leads (comma-separated)", where: "Your own address. Sign in once with an emailed link so it's verified.", secret: false, looksLike: EMAIL_LIST },
    ],
  },
  {
    title: "Email (Resend)",
    why: "Sign-in links, confirmations and receipts. Most v1 members have no password — without this they can't get in.",
    keys: [{ name: "RESEND_API_KEY", ask: "Resend API key", where: "resend.com → API Keys. realist.ca must show as Verified under Domains.", secret: true, looksLike: /^re_/ }],
  },
  {
    title: "Live MLS® listings (CREA DDF)",
    why: "The Find-deals door. Without it the listings pages have nothing to show.",
    keys: [
      { name: "CREA_DDF_USERNAME", ask: "DDF username (client id)", where: "The same pair the Replit app uses (Secrets tab).", secret: false },
      { name: "CREA_DDF_PASSWORD", ask: "DDF password (client secret)", where: "Same place.", secret: true },
    ],
  },
  {
    title: "AI (Anthropic)",
    why: "The written deal memo, multiplex reports and Ask Realist. Spend is capped site-wide (AI_DAILY_BUDGET, default 2000 calls a day).",
    keys: [{ name: "ANTHROPIC_API_KEY", ask: "Anthropic API key", where: "console.anthropic.com → API keys.", secret: true, looksLike: /^sk-ant-/, optional: true }],
  },
  {
    title: "Sign in with Google",
    why: "One-tap accounts. Add <site>/api/auth/google/callback as an authorised redirect URI for each host you use.",
    keys: [
      { name: "GOOGLE_CLIENT_ID", ask: "OAuth client id", where: "Google Cloud → APIs & Services → Credentials (the same client the Replit app uses).", secret: false, looksLike: /\.apps\.googleusercontent\.com$/, optional: true },
      { name: "GOOGLE_CLIENT_SECRET", ask: "OAuth client secret", where: "Same place.", secret: true, optional: true },
    ],
  },
  {
    title: "Keypr cash-back handoff",
    why: "Consented Ontario showing and offer requests go to your cash-back partner.",
    keys: [{ name: "KEYPR_REALIST_SECRET", ask: "Keypr shared secret", where: "The Replit app's Secrets tab (same name).", secret: true, optional: true }],
  },
];

/** Variable names from `vercel env ls` output — names only ever; the CLI never prints values. */
export function parseEnvNames(output: string): Set<string> {
  const names = new Set<string>();
  for (const line of output.split("\n")) {
    const first = line.trim().split(/\s+/)[0];
    if (/^[A-Z][A-Z0-9_]{2,}$/.test(first ?? "")) names.add(first);
  }
  return names;
}

/** Why a pasted value might be the wrong thing — or null when it looks right. */
export function shapeWarning(spec: KeySpec, value: string): string | null {
  if (/\s/.test(value) && spec.secret) return "that has a space in it — a key is one unbroken string";
  if (spec.looksLike && !spec.looksLike.test(value)) return spec.looksLike === EMAIL_LIST ? "that isn't a list of email addresses" : `that doesn't look like a ${spec.ask.toLowerCase()}`;
  return null;
}

/** CREA hands out a token for valid credentials and nothing else: a read-only proof they work. */
export async function checkDdfCredentials(username: string, password: string, fetcher: typeof fetch = fetch): Promise<{ ok: boolean; detail: string }> {
  try {
    const response = await fetcher("https://identity.crea.ca/connect/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: username, client_secret: password, scope: "DDFApi_Read" }).toString(),
      signal: AbortSignal.timeout(15_000),
    });
    return response.ok ? { ok: true, detail: "CREA accepted the credentials." } : { ok: false, detail: `CREA answered HTTP ${response.status} — the pair is wrong or the feed isn't active.` };
  } catch (error) {
    return { ok: false, detail: `Couldn't reach CREA: ${(error as Error).message}` };
  }
}
