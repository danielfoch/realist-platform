/**
 * Weekly podcast digest — The Canadian Real Estate Investor (Daniel Foch &
 * Nick Hill). Replaces Dan's manual Substack push: once a week it sweeps every
 * opted-in user, finds the episode(s) published since their last digest, and
 * sends a governed email whose PRIMARY listen CTA for each episode is the
 * canonical realist.ca episode page (Apple/Spotify are secondary). Goal: drive
 * the podcast audience onto realist.ca episode pages and into the analyzer.
 *
 * NON-NEGOTIABLES (owner):
 *   1. Own opt-in. This is a CONTENT newsletter with its OWN consent, separate
 *      from transactional/deal email. Default OFF for existing users — nobody
 *      is blasted. A user opts in either on /account/notifications
 *      (podcastDigestEnabled) or via the public POST /api/podcast/subscribe,
 *      which sets the toggle AND records an email_consent ledger row
 *      (channel 'email', source 'podcast_digest').
 *   2. Governed. Every send goes through governMarketingSend with
 *      category 'marketing', stream 'podcast_digest' → inherits the rolling
 *      weekly cap and honours the master marketing switch + per-stream toggle.
 *      A weekly content email is low-frequency and should rarely hit the cap,
 *      but it IS subject to it.
 *   3. Site is canonical. Each episode's PRIMARY CTA is
 *      realist.ca/insights/podcast/<slug>; Apple/Spotify are secondary.
 *
 * REUSE: episode data (fetch + parse + stable slugs) comes entirely from
 * server/podcastFeed.ts (getPodcastEpisodes) — this module NEVER re-fetches or
 * re-parses the RSS itself. Slugs match the episode pages and sitemap exactly.
 *
 * ── FUTURE: seeded subscriber import (Dan's Substack list) ──────────────────
 * Importing Dan's existing Substack subscribers is a future ONE-OFF (not built
 * here). A future admin importer would accept a CSV of the shape:
 *     email,first_name,subscribed_at
 *     jane@example.com,Jane,2024-11-03
 * and for each row: upsert a user by normalized email, set
 * notification_preferences.podcast_digest_enabled = true, and append an
 * email_consent row (channel 'email', status 'granted', source
 * 'substack_import') to preserve CASL proof-of-consent with the original
 * subscribe date. It would reuse ensurePodcastSubscriber() below.
 */

import crypto from "crypto";
import cron from "node-cron";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { backlinkUserRecords } from "./personSpine";
import { users, notificationQueue, notificationEvents, emailConsent } from "@shared/schema";
import { normalizeEmail } from "@shared/authTokens";
import { getResendClient } from "./resend";
import { governMarketingSend } from "./emailGovernor";
import { storage } from "./storage";
import { getPodcastEpisodes, type PodcastEpisode } from "./podcastFeed";
import { PODCAST_APPLE_URL, PODCAST_SPOTIFY_URL, PODCAST_NAME, BRAND_BASE_URL } from "@shared/brand";
import {
  selectEpisodesForDigest,
  summarizeShowNotes,
  podcastDigestDedupeKey,
  isoWeekKey,
  type DigestEpisode,
} from "@shared/podcastDigest";

const REPLY_TO_EMAIL = process.env.PODCAST_DIGEST_REPLY_EMAIL || "danielfoch@gmail.com";
/** First-ever digest for a subscriber looks back this far so they get recent
 * episodes (not the whole archive). One podcast week ≈ 7 days; 21 gives a
 * little slack for a subscriber who joined mid-week. */
const FIRST_SEND_LOOKBACK_DAYS = 21;
/** Max episodes surfaced in a single digest (a busy catch-up week is capped). */
const MAX_EPISODES_PER_DIGEST = 3;
const UNSUBSCRIBE_SECRET = process.env.SESSION_SECRET || "realist-digest-secret";

function unsubscribeToken(userId: string): string {
  return crypto.createHmac("sha256", UNSUBSCRIBE_SECRET).update(userId).digest("hex");
}

// ---------------------------------------------------------------------------
// AI-summary seam
// ---------------------------------------------------------------------------

/**
 * Return the 2-3 sentence summary for one episode in the digest.
 *
 * SEAM (do NOT build AI summarization now): today this returns the truncated
 * RSS show-notes via the pure summarizeShowNotes(). When we later want AI
 * summaries, this is the ONE place to change — e.g. look the slug up in an
 * `episode_enrichments` table (mirroring podcastFeed.getEpisodeEnrichment) and
 * fall back to the RSS summary when none exists. The email template already
 * consumes whatever string this returns, so the swap stays local.
 */
function getEpisodeSummary(episode: PodcastEpisode): string {
  return summarizeShowNotes(episode.description, { maxSentences: 3, maxChars: 320 });
}

// ---------------------------------------------------------------------------
// Recipients + per-user last-send
// ---------------------------------------------------------------------------

interface Recipient {
  id: string;
  email: string;
  firstName: string | null;
}

/**
 * Users who have explicitly opted into the podcast digest. Because the toggle
 * defaults ON at the column level but existing users must OPT IN, we require an
 * actual notification_preferences row with podcast_digest_enabled = true (a
 * user with no row is NOT swept — they never opted in). The public subscribe
 * endpoint and the /account/notifications page both write that row.
 *
 * We still require a live email and a non-revoked consent posture; the governor
 * re-checks consent per user, but filtering here keeps the sweep tight.
 */
async function getSubscribedUsers(): Promise<Recipient[]> {
  const result = await db.execute(sql`
    SELECT u.id, u.email, u.first_name AS "firstName"
    FROM users u
    JOIN notification_preferences np ON np.user_id = u.id
    WHERE np.podcast_digest_enabled = true
      AND COALESCE(np.marketing_email_enabled, true) = true
      AND COALESCE(u.email_digest_opt_in, true) = true
      AND u.email IS NOT NULL AND u.email != ''
      AND COALESCE((
        SELECT ec.status FROM email_consent ec
        WHERE ec.user_id = u.id AND ec.channel = 'email'
        ORDER BY ec.created_at DESC LIMIT 1
      ), 'granted') != 'revoked'
  `);
  return ((result as any).rows as Recipient[]) ?? [];
}

/**
 * The timestamp of a user's most recent podcast digest send (from the canonical
 * retention_email_log). Null when they've never received one → first send.
 * Episode selection uses this so each digest only contains episodes newer than
 * what we already emailed them.
 */
async function getLastDigestSentAt(userId: string): Promise<Date | null> {
  const result = await db.execute(sql`
    SELECT MAX(sent_at) AS last
    FROM retention_email_log
    WHERE user_id = ${userId} AND email_type = 'podcast_digest'
  `);
  const last = (result as any).rows?.[0]?.last;
  return last ? new Date(last) : null;
}

function toDigestEpisode(episode: PodcastEpisode): DigestEpisode {
  return {
    slug: episode.slug,
    title: episode.title,
    description: episode.description,
    pubDate: episode.pubDate,
    duration: episode.duration,
    imageUrl: episode.imageUrl,
  };
}

// ---------------------------------------------------------------------------
// Email rendering
// ---------------------------------------------------------------------------

interface RenderedEpisode {
  episode: PodcastEpisode;
  summary: string;
  episodeUrl: string;
}

function episodeUrl(slug: string): string {
  return `${BRAND_BASE_URL}/insights/podcast/${slug}?source=podcast_digest`;
}

function prettyDate(pubDate: string): string {
  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", {
    timeZone: "America/Toronto",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildSubject(rendered: RenderedEpisode[]): string {
  const lead = rendered[0]?.episode.title;
  if (rendered.length === 1 && lead) return `New episode: ${lead}`;
  if (rendered.length > 1 && lead) return `${rendered.length} new episodes — ${lead}`;
  return `This week on ${PODCAST_NAME}`;
}

function buildHtml(firstName: string, rendered: RenderedEpisode[], unsubscribeUrl: string): string {
  const episodeCards = rendered
    .map(({ episode, summary, episodeUrl: url }) => {
      const meta = [prettyDate(episode.pubDate), episode.duration].filter(Boolean).join(" · ");
      return `
      <div style="border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin: 0 0 16px 0; background: #ffffff;">
        <p style="margin: 0 0 6px 0; font-size: 12px; color: #6b7280; letter-spacing: 0.4px;">${meta}</p>
        <h2 style="margin: 0 0 10px 0; font-size: 18px; line-height: 1.35; color: #0f172a; font-weight: 700;">
          <a href="${url}" style="color: #0f172a; text-decoration: none;">${episode.title}</a>
        </h2>
        ${summary ? `<p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #374151;">${summary}</p>` : ""}
        <div style="margin: 0 0 4px 0;">
          <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; text-decoration: none; padding: 10px 22px; border-radius: 8px; font-weight: 600; font-size: 14px;">
            Listen on realist.ca &rarr;
          </a>
        </div>
        <p style="margin: 10px 0 0 0; font-size: 12px; color: #9ca3af;">
          Prefer an app? <a href="${PODCAST_APPLE_URL}" style="color: #6b7280;">Apple Podcasts</a> &middot;
          <a href="${PODCAST_SPOTIFY_URL}" style="color: #6b7280;">Spotify</a>
        </p>
      </div>`;
    })
    .join("");

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb;">
      <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 28px 24px; border-radius: 8px 8px 0 0;">
        <p style="margin: 0; font-size: 12px; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase;">Weekly Episode Digest</p>
        <h1 style="margin: 6px 0 0 0; font-size: 22px; color: white; font-weight: 700;">${PODCAST_NAME}</h1>
        <p style="margin: 6px 0 0 0; font-size: 13px; color: #64748b;">with Daniel Foch &amp; Nick Hill</p>
      </div>

      <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
        <p style="margin: 0 0 16px 0; font-size: 15px; color: #111827;">Hey ${firstName || "there"},</p>
        <p style="margin: 0 0 20px 0; font-size: 14px; color: #374151; line-height: 1.6;">
          Here's what dropped this week on Canada's #1 real estate podcast. Tap through to listen on realist.ca — every episode page has the show notes, the topics we covered, and a tool to run the numbers yourself.
        </p>

        ${episodeCards}

        <div style="text-align: center; margin: 24px 0 8px 0;">
          <a href="${BRAND_BASE_URL}/insights/podcast?source=podcast_digest" style="color: #2563eb; text-decoration: none; font-size: 13px;">
            Browse every episode on realist.ca &rarr;
          </a>
        </div>
      </div>

      <div style="padding: 16px 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; background: #f9fafb;">
        <p style="margin: 0; text-align: center; color: #9ca3af; font-size: 11px;">
          ${PODCAST_NAME} &mdash; a weekly digest from realist.ca
        </p>
        <p style="margin: 8px 0 0 0; text-align: center;">
          <a href="${unsubscribeUrl}" style="color: #9ca3af; text-decoration: underline; font-size: 11px;">
            Unsubscribe from the podcast digest
          </a>
        </p>
      </div>
    </div>`;
}

function buildText(firstName: string, rendered: RenderedEpisode[], unsubscribeUrl: string): string {
  const lines = [
    `Hey ${firstName || "there"},`,
    "",
    `This week on ${PODCAST_NAME} (Daniel Foch & Nick Hill):`,
    "",
  ];
  for (const { episode, summary, episodeUrl: url } of rendered) {
    const meta = [prettyDate(episode.pubDate), episode.duration].filter(Boolean).join(" · ");
    lines.push(`• ${episode.title}${meta ? ` (${meta})` : ""}`);
    if (summary) lines.push(`  ${summary}`);
    lines.push(`  Listen: ${url}`);
    lines.push(`  Or: Apple ${PODCAST_APPLE_URL} | Spotify ${PODCAST_SPOTIFY_URL}`);
    lines.push("");
  }
  lines.push(`Browse every episode: ${BRAND_BASE_URL}/insights/podcast?source=podcast_digest`);
  lines.push("");
  lines.push(`Unsubscribe: ${unsubscribeUrl}`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Subscribe (public opt-in) — shared by the endpoint and a future importer
// ---------------------------------------------------------------------------

export interface SubscribeResult {
  userId: string;
  created: boolean;
  alreadySubscribed: boolean;
}

/**
 * Idempotently subscribe an email to the podcast digest:
 *   - upsert a user by normalized email (create with digest opt-in on),
 *   - set notification_preferences.podcast_digest_enabled = true (preserving
 *     the user's other preferences),
 *   - append an email_consent ledger row (channel 'email', status 'granted',
 *     source `source`) so we have CASL proof-of-consent for THIS content
 *     stream, separate from any transactional consent.
 *
 * `source` defaults to 'podcast_digest' (the public subscribe path); a future
 * Substack importer passes 'substack_import'.
 */
export async function ensurePodcastSubscriber(
  rawEmail: string,
  opts: { firstName?: string | null; source?: string } = {},
): Promise<SubscribeResult> {
  const email = normalizeEmail(rawEmail);
  if (!email || !email.includes("@")) throw new Error("A valid email is required");
  const source = (opts.source || "podcast_digest").slice(0, 100);

  const [existing] = await db.select().from(users).where(sql`${users.email} = ${email}`).limit(1);
  let userId: string;
  let created = false;
  if (existing) {
    userId = existing.id;
    // A previously-unsubscribed user re-subscribing must clear the master flag.
    if (existing.emailDigestOptIn === false) {
      await db.update(users).set({ emailDigestOptIn: true }).where(sql`${users.id} = ${userId}`);
    }
  } else {
    const firstName = (opts.firstName || "").trim() || null;
    const [user] = await db
      .insert(users)
      .values({ email, firstName, role: "investor", emailDigestOptIn: true })
      .returning({ id: users.id });
    userId = user.id;
    created = true;

    // PERSON SPINE (phase 1): backlink pre-existing leads/crm_contacts rows
    // with this email. Best-effort, never fails the subscribe.
    await backlinkUserRecords(userId, email);
  }

  const existingPref = await storage.getNotificationPreference(userId);
  const alreadySubscribed = existingPref?.podcastDigestEnabled === true;

  // Preserve every other preference; flip podcast_digest_enabled on. Marketing
  // master switch must be on for the governor to allow the stream.
  await storage.upsertNotificationPreference({
    userId,
    marketingEmailEnabled: existingPref?.marketingEmailEnabled ?? true,
    retentionTipsEnabled: existingPref?.retentionTipsEnabled ?? true,
    listingWatchAlertsEnabled: existingPref?.listingWatchAlertsEnabled ?? true,
    marketAlertsEnabled: existingPref?.marketAlertsEnabled ?? true,
    communityAlertsEnabled: existingPref?.communityAlertsEnabled ?? true,
    weeklyDigestEnabled: existingPref?.weeklyDigestEnabled ?? true,
    monthlyRankEnabled: existingPref?.monthlyRankEnabled ?? true,
    podcastDigestEnabled: true,
    productUpdatesEnabled: existingPref?.productUpdatesEnabled ?? true,
    digestEnabled: existingPref?.digestEnabled ?? true,
    weeklyEmailFrequency: existingPref?.weeklyEmailFrequency ?? null,
  });

  // CASL proof-of-consent for the content stream. Append-only ledger; the
  // subscribe action IS the express-consent moment.
  await db
    .insert(emailConsent)
    .values({ userId, channel: "email", status: "granted", source })
    .catch((error: any) =>
      console.error("[podcast-digest] consent ledger write failed:", error?.message || error),
    );

  return { userId, created, alreadySubscribed };
}

// ---------------------------------------------------------------------------
// Preview (admin) + sweep (send)
// ---------------------------------------------------------------------------

export interface DigestPreview {
  week: string;
  subscriberCount: number;
  latestEpisodes: Array<{ slug: string; title: string; pubDate: string; summary: string; episodeUrl: string }>;
  subjectExample: string;
}

/**
 * Read-only preview for the admin route: the ISO week, how many users are
 * subscribed, and how a fresh (first-send) digest would render this week. No
 * sends, no cap consumption, no send-log rows.
 */
export async function previewPodcastDigest(now: Date = new Date()): Promise<DigestPreview> {
  const [episodes, subscribers] = await Promise.all([getPodcastEpisodes(), getSubscribedUsers()]);
  const lookback = new Date(now.getTime() - FIRST_SEND_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const selected = selectEpisodesForDigest(episodes.map(toDigestEpisode), {
    firstSendLookback: lookback,
    maxEpisodes: MAX_EPISODES_PER_DIGEST,
  });
  const rendered: RenderedEpisode[] = selected.map((sel) => {
    const full = episodes.find((e) => e.slug === sel.slug)!;
    return { episode: full, summary: getEpisodeSummary(full), episodeUrl: episodeUrl(full.slug) };
  });
  return {
    week: isoWeekKey(now),
    subscriberCount: subscribers.length,
    latestEpisodes: rendered.map((r) => ({
      slug: r.episode.slug,
      title: r.episode.title,
      pubDate: r.episode.pubDate,
      summary: r.summary,
      episodeUrl: r.episodeUrl,
    })),
    subjectExample: buildSubject(rendered),
  };
}

export interface SweepResult {
  week: string;
  subscribers: number;
  sent: number;
  skipped: number;
  errors: number;
  dryRun: boolean;
}

/**
 * The weekly sweep. For each subscribed user: find the episode(s) newer than
 * their last digest, and if there are any, run the governor (which claims the
 * per-week dedupe row and applies consent/prefs/cap) then send via Resend.
 *
 * dedupeKey is `podcast_digest:<userId>:<yyyy-Www>` so a user gets at most one
 * digest per ISO week even if the sweep runs more than once, and the governor's
 * global cap composes with (does not replace) that per-week dedupe.
 */
export async function runPodcastDigestSweep(
  options: { dryRun?: boolean; now?: Date } = {},
): Promise<SweepResult> {
  const dryRun = options.dryRun === true;
  const now = options.now ?? new Date();
  const week = isoWeekKey(now);
  console.log(`[podcast-digest] Starting weekly sweep for ${week} (dryRun=${dryRun})`);

  const episodes = await getPodcastEpisodes();
  const digestEpisodes = episodes.map(toDigestEpisode);
  const subscribers = await getSubscribedUsers();
  console.log(`[podcast-digest] ${subscribers.length} subscribed users`);

  const result: SweepResult = { week, subscribers: subscribers.length, sent: 0, skipped: 0, errors: 0, dryRun };
  if (subscribers.length === 0) return result;

  const lookback = new Date(now.getTime() - FIRST_SEND_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  // One notification event groups this sweep's deliveries (like weeklyDigest).
  let eventId: string | null = null;
  if (!dryRun) {
    const [event] = await db
      .insert(notificationEvents)
      .values({ eventType: "podcast_digest", payloadJson: { week } })
      .returning({ id: notificationEvents.id });
    eventId = event.id;
  }

  let resendCtx: Awaited<ReturnType<typeof getResendClient>> | null = null;
  if (!dryRun) {
    try {
      resendCtx = await getResendClient();
    } catch (err: any) {
      console.error("[podcast-digest] Resend init failed:", err?.message || err);
      throw err;
    }
  }

  for (const recipient of subscribers) {
    try {
      const lastSentAt = await getLastDigestSentAt(recipient.id);
      const selected = selectEpisodesForDigest(digestEpisodes, {
        since: lastSentAt,
        firstSendLookback: lookback,
        maxEpisodes: MAX_EPISODES_PER_DIGEST,
      });
      if (selected.length === 0) {
        // Nothing new since we last emailed them — no send this week.
        result.skipped++;
        continue;
      }

      const rendered: RenderedEpisode[] = selected.map((sel) => {
        const full = episodes.find((e) => e.slug === sel.slug)!;
        return { episode: full, summary: getEpisodeSummary(full), episodeUrl: episodeUrl(full.slug) };
      });

      if (dryRun) {
        result.sent++; // "would send"
        continue;
      }

      // Governor: claims podcast_digest:<uid>:<week> in retention_email_log,
      // applies CASL consent + podcast_digest toggle + rolling weekly cap.
      const dedupeKey = podcastDigestDedupeKey(recipient.id, now);
      const gate = await governMarketingSend({
        userId: recipient.id,
        stream: "podcast_digest",
        emailType: "podcast_digest",
        dedupeKey,
      });
      if (!gate.ok) {
        console.log(`[podcast-digest] Governor blocked ${recipient.email} (${gate.reason})`);
        result.skipped++;
        continue;
      }

      const token = unsubscribeToken(recipient.id);
      const unsubscribeUrl = `${BRAND_BASE_URL}/api/email/unsubscribe?uid=${encodeURIComponent(recipient.id)}&token=${token}`;
      const subject = buildSubject(rendered);
      const html = buildHtml(recipient.firstName || "", rendered, unsubscribeUrl);
      const text = buildText(recipient.firstName || "", rendered, unsubscribeUrl);

      const reservation = await db
        .insert(notificationQueue)
        .values({
          recipientUserId: recipient.id,
          notificationEventId: eventId!, // set above whenever !dryRun; we only reach here when !dryRun
          channel: "email_resend",
          templateKey: "podcast_digest",
          dedupeKey,
          status: "pending",
          payloadJson: { week, episodeSlugs: selected.map((e) => e.slug) },
        })
        .onConflictDoNothing({ target: notificationQueue.dedupeKey })
        .returning({ id: notificationQueue.id });

      if (reservation.length === 0) {
        // Delivery record already exists for this week — governor claimed but a
        // prior sweep already queued; treat as skip.
        result.skipped++;
        continue;
      }

      const { data, error } = await resendCtx!.client.emails.send({
        from: resendCtx!.fromEmail,
        to: recipient.email,
        replyTo: REPLY_TO_EMAIL,
        subject,
        html,
        text,
      });

      if (error) {
        await db
          .update(notificationQueue)
          .set({ status: "failed", failureReason: String((error as any).message || error) })
          .where(sql`${notificationQueue.id} = ${reservation[0].id}`);
        console.error(`[podcast-digest] Send failed for ${recipient.email}:`, error);
        result.errors++;
        continue;
      }

      await db
        .update(notificationQueue)
        .set({ status: "sent", sentAt: new Date() })
        .where(sql`${notificationQueue.id} = ${reservation[0].id}`);
      console.log(`[podcast-digest] Sent to ${recipient.email} (${selected.length} ep) id=${(data as any)?.id || "?"}`);
      result.sent++;
      await new Promise((r) => setTimeout(r, 600)); // throttle: gentle on Resend
    } catch (err: any) {
      console.error(`[podcast-digest] Error for ${recipient.email}:`, err);
      result.errors++;
    }
  }

  console.log(
    `[podcast-digest] Sweep complete for ${week}: sent=${result.sent} skipped=${result.skipped} errors=${result.errors}`,
  );
  return result;
}

/**
 * Schedule the weekly sweep: Thursdays 9am Toronto (13:00 UTC in EDT / 14:00 in
 * EST — cron here fires at 13:00 UTC; the sweep is idempotent per ISO week so a
 * one-hour DST drift never double-sends). Mirrors scheduleWeeklyDigest.
 */
export function schedulePodcastDigest() {
  cron.schedule("0 13 * * 4", () => {
    console.log("[podcast-digest] Cron triggered");
    runPodcastDigestSweep().catch((err) => console.error("[podcast-digest] Cron error:", err));
  });
  console.log("[podcast-digest] Scheduled: Thursdays ~9am Toronto (13:00 UTC)");
}
