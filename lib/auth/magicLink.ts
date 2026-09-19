import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { loginTokens } from "@/lib/db/schema";
import { SITE_BASE_URL } from "@/lib/brand";
import { sendEmail } from "@/lib/email";
import { generateToken, hashToken } from "./tokens";
import { normalizeEmail } from "./users";

const LINK_TTL_MS = 20 * 60 * 1000;

/**
 * Hosts a sign-in link may point at. The link is built from the request's own
 * origin so it works on whichever domain the person is using, but only when
 * that host is one of ours — a forged Host header must never end up in an
 * email.
 */
const TRUSTED_HOSTS = new Set(["realist.ca", "www.realist.ca", "new.realist.ca", "realist-lean.vercel.app"]);

export function publicOrigin(request: Request): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  if (TRUSTED_HOSTS.has(host)) return `https://${host}`;
  if (process.env.NODE_ENV !== "production" && /^localhost(:\d+)?$/.test(host)) return `http://${host}`;
  return SITE_BASE_URL;
}

/** What the email says around the link. The link itself always works the same way. */
export interface LinkMessage {
  subject: string;
  /** One or two plain sentences above the button. */
  intro: string;
  button: string;
  /** How long the link lives. Sign-in links are short; a receipt someone may open tomorrow is longer. */
  ttlMs?: number;
}

const SIGN_IN: LinkMessage = { subject: "Your Realist sign-in link", intro: "Here's your sign-in link.", button: "Sign in to Realist" };

/** Mint a single-use link for this address and return it (the caller sends it). */
export async function mintLoginLink(input: { email: string; next: string; origin: string; ttlMs?: number }): Promise<string> {
  const email = normalizeEmail(input.email);
  const token = generateToken();
  await getDb()
    .insert(loginTokens)
    .values({
      tokenHash: hashToken(token),
      email,
      purpose: "magic_link",
      expiresAt: new Date(Date.now() + (input.ttlMs ?? LINK_TTL_MS)),
    });
  // Points at a confirm page, not at the endpoint that burns the token: mail
  // scanners pre-fetch every link they see, and a GET that signed someone in
  // would spend the link before its owner ever clicked it.
  return `${input.origin}/login/confirm?token=${encodeURIComponent(token)}&next=${encodeURIComponent(input.next)}`;
}

export async function sendMagicLink(input: { email: string; next: string; origin: string; message?: LinkMessage }): Promise<void> {
  const email = normalizeEmail(input.email);
  const message = input.message ?? SIGN_IN;
  const ttlMs = message.ttlMs ?? LINK_TTL_MS;
  const link = await mintLoginLink({ email, next: input.next, origin: input.origin, ttlMs });
  const lifetime = ttlMs >= 86_400_000 ? `${Math.round(ttlMs / 86_400_000)} days` : `${Math.round(ttlMs / 60_000)} minutes`;

  const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  await sendEmail({
    to: email,
    subject: message.subject,
    text: `${message.intro}\n\n${link}\n\nThis link works once and expires in ${lifetime}. If you didn't ask for it, ignore this email.`,
    html: `<div style="font-family:Inter,Arial,sans-serif;color:#242424;max-width:480px">
  <p style="font-size:18px;font-weight:600;margin:0 0 12px">realist<span style="color:#ff334b">.</span></p>
  <p style="font-size:15px;line-height:1.6;margin:0 0 20px">${escape(message.intro)} It works once and expires in ${lifetime}.</p>
  <p style="margin:0 0 24px"><a href="${link}" style="background:#be1730;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 18px;border-radius:3px;display:inline-block">${escape(message.button)}</a></p>
  <p style="font-size:12px;line-height:1.6;color:#696969;margin:0">If you didn't ask for this, you can ignore this email.</p>
</div>`,
  });
}

/** Burn a link token. Returns the email it was issued to, or null. */
export async function consumeMagicLink(token: string): Promise<string | null> {
  const db = getDb();
  const now = new Date();
  const tokenHash = hashToken(token);
  // Single statement so two clicks cannot both win.
  const claimed = await db
    .update(loginTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(loginTokens.tokenHash, tokenHash),
        eq(loginTokens.purpose, "magic_link"),
        isNull(loginTokens.usedAt),
        gt(loginTokens.expiresAt, now),
      ),
    )
    .returning({ email: loginTokens.email });
  return claimed[0]?.email ?? null;
}
