import { and, count, desc, eq, gte, inArray, lte, ne, isNotNull, sql } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import {
  analyses,
  ddfListingSnapshots,
  discoverySignals,
  listingAnalysisAggregates,
  listingWatchers,
  notificationQueue,
  propertyAnalyses,
  type DiscoverySignal,
  type DdfListingSnapshot,
  type ListingAnalysisAggregate,
  type ListingComment,
  type PropertyAnalysis,
  type UsListing,
} from "@shared/schema";
import { users } from "@shared/models/auth";
import {
  buildNoteVoteCopy,
  noteExcerpt,
  noteVoteDedupeKey,
  type NoteVoteMilestone,
} from "@shared/fieldNotes";
import type { ExpertFieldNote } from "@shared/schema";
import { buildFieldNoteLeadCopy } from "@shared/fieldNoteIncentives";
import { governMarketingSend } from "./emailGovernor";

type NotificationKind =
  | "saved_search_match"
  | "analysis_created"
  | "analysis_updated"
  | "comment_created"
  | "comment_reply"
  | "consensus_shifted"
  | "listing_price_changed"
  | "listing_status_changed"
  | "analyzer_completed"
  | "inactive_high_intent"
  | "multiplex_intent"
  | "distress_intent"
  | "daily_digest_ready"
  | "weekly_leaderboard_digest"
  | "co_analysis_alert"
  | "milestone_reached"
  | "note_vote_update"
  | "field_note_lead";

export type GhlNotificationPayload = {
  sendEmail: true;
  eventType: NotificationKind;
  eventId: string;
  eventTs: string;
  email: string;
  phone?: string | null;
  firstName: string;
  lastName?: string | null;
  fullName?: string;
  listingMlsNumber?: string;
  listingAddress?: string;
  listingCity?: string;
  listingProvince?: string;
  listingPrice?: number | null;
  propertyType?: string | null;
  strategyType?: string | null;
  analysisId?: string;
  commentId?: string;
  capRate?: number | null;
  cashOnCash?: number | null;
  monthlyCashFlow?: number | null;
  consensusLabel?: string | null;
  matchCount?: number;
  searchArea?: string;
  milestoneCount?: number;
  coAnalystCount?: number;
  reasonText: string;
  ctaLabel: string;
  ctaUrl: string;
  subjectLine: string;
  previewText: string;
  emailBody: string;
  emailHtml?: string;
  ghlTags: string[];
  leadScoreDelta: number;
};

function normalizeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getMetric(source: Record<string, unknown> | null | undefined, keys: string[]): number | null {
  for (const key of keys) {
    const normalized = normalizeNumber(source?.[key]);
    if (normalized != null) return normalized;
  }
  return null;
}

function formatPercent(value: number | null | undefined): string {
  return value == null ? "n/a" : `${value}%`;
}

function formatCurrency(value: number | null | undefined): string {
  return value == null ? "n/a" : `$${Math.round(value).toLocaleString()}`;
}

function buildEmailBody(firstName: string, lines: string[]): string {
  return [`Hello ${firstName},`, "", ...lines, "", "Best,", "Realist"].join("\n");
}

function buildFullName(firstName?: string | null, lastName?: string | null): string {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

function buildAnalysisUrl(mlsNumber?: string | null): string {
  return mlsNumber ? `https://realist.ca/tools/cap-rates?mls=${encodeURIComponent(mlsNumber)}&tab=community` : "https://realist.ca/tools/cap-rates";
}

function buildMarketSearchUrl(area?: string | null, propertyType?: string | null): string {
  const query = [propertyType, area].filter(Boolean).join(" ").trim();
  if (!query) return "https://realist.ca/tools/cap-rates";
  return `https://realist.ca/tools/cap-rates?q=${encodeURIComponent(query)}`;
}

function buildUsListingUrl(listing: Pick<UsListing, "sourceId" | "sourceUrl" | "city" | "propertyType">): string {
  if (listing.sourceId) {
    return buildAnalysisUrl(listing.sourceId);
  }
  if (listing.sourceUrl) return listing.sourceUrl;
  return buildMarketSearchUrl(listing.city, listing.propertyType);
}

function buildCanadianListingUrl(listing: Pick<DdfListingSnapshot, "mlsNumber" | "listingKey" | "city" | "propertySubType" | "structureType">): string {
  return buildAnalysisUrl(listing.mlsNumber || listing.listingKey);
}

function normalizeText(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

function safeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getSignalSearchArea(signal?: DiscoverySignal): string | undefined {
  if (!signal) return undefined;
  const payload = (signal.payloadJson || {}) as Record<string, unknown>;
  return safeString(payload.geography) || safeString(payload.query) || safeString(payload.label);
}

function getSignalPropertyType(signal?: DiscoverySignal): string | undefined {
  if (!signal) return undefined;
  const payload = (signal.payloadJson || {}) as Record<string, unknown>;
  return safeString(payload.propertyType);
}

function getSignalBudgetMax(signal?: DiscoverySignal): number | undefined {
  if (!signal) return undefined;
  const payload = (signal.payloadJson || {}) as Record<string, unknown>;
  return typeof payload.budgetMax === "number" && Number.isFinite(payload.budgetMax) ? payload.budgetMax : undefined;
}

function getSignalStrategy(signal?: DiscoverySignal): string | undefined {
  if (!signal) return undefined;
  const payload = (signal.payloadJson || {}) as Record<string, unknown>;
  return safeString(payload.strategy);
}

function matchesSavedSearch(signal: DiscoverySignal, listing: UsListing): boolean {
  const area = normalizeText(getSignalSearchArea(signal));
  const propertyType = normalizeText(getSignalPropertyType(signal));
  const budgetMax = getSignalBudgetMax(signal);
  const listingArea = normalizeText([listing.city, listing.state, listing.formattedAddress].filter(Boolean).join(" "));
  const listingType = normalizeText(listing.propertyType);

  if (area && !listingArea.includes(area)) return false;
  if (propertyType && !listingType.includes(propertyType) && !propertyType.includes(listingType)) return false;
  if (budgetMax != null && listing.listPrice != null && listing.listPrice > Math.round(budgetMax * 1.05)) return false;
  if (listing.delistedAt) return false;
  return true;
}

function matchesSavedSearchDdf(signal: DiscoverySignal, listing: DdfListingSnapshot): boolean {
  const area = normalizeText(getSignalSearchArea(signal));
  const propertyType = normalizeText(getSignalPropertyType(signal));
  const budgetMax = getSignalBudgetMax(signal);
  const listingArea = normalizeText([listing.city, listing.province, listing.mlsNumber].filter(Boolean).join(" "));
  const listingType = normalizeText(listing.propertySubType || listing.structureType);

  if (area && !listingArea.includes(area)) return false;
  if (propertyType && !listingType.includes(propertyType) && !propertyType.includes(listingType)) return false;
  if (budgetMax != null && listing.listPrice != null && listing.listPrice > budgetMax * 1.05) return false;
  return true;
}

function buildPriceChangeReason(previous: UsListing, current: UsListing): string | null {
  if (previous.listPrice == null || current.listPrice == null || previous.listPrice === current.listPrice) return null;
  const delta = current.listPrice - previous.listPrice;
  const absDelta = Math.abs(delta);
  const percentDelta = previous.listPrice > 0 ? (absDelta / previous.listPrice) * 100 : 0;
  if (absDelta < 5000 && percentDelta < 1.5) return null;
  if (delta < 0) {
    return `This listing dropped in price by ${formatCurrency(absDelta)}.`;
  }
  return `This listing increased in price by ${formatCurrency(absDelta)}.`;
}

function buildStatusChangeReason(previous: UsListing, current: UsListing): string | null {
  if (!previous.status || !current.status || previous.status === current.status) return null;
  return `Status changed from ${previous.status} to ${current.status}.`;
}

function buildDdfPriceChangeReason(previous: DdfListingSnapshot, current: DdfListingSnapshot): string | null {
  if (previous.listPrice == null || current.listPrice == null || previous.listPrice === current.listPrice) return null;
  const delta = current.listPrice - previous.listPrice;
  const absDelta = Math.abs(delta);
  const percentDelta = previous.listPrice > 0 ? (absDelta / previous.listPrice) * 100 : 0;
  if (absDelta < 5000 && percentDelta < 1.5) return null;
  if (delta < 0) return `This listing dropped in price by ${formatCurrency(absDelta)}.`;
  return `This listing increased in price by ${formatCurrency(absDelta)}.`;
}

function buildDdfStatusChangeReason(previous: DdfListingSnapshot, current: DdfListingSnapshot): string | null {
  const before = safeString((previous.rawJson as Record<string, unknown> | undefined)?.StandardStatus);
  const after = safeString((current.rawJson as Record<string, unknown> | undefined)?.StandardStatus);
  if (!before || !after || before === after) return null;
  return `Status changed from ${before} to ${after}.`;
}

function buildConsensusReason(before?: ListingAnalysisAggregate | null, after?: ListingAnalysisAggregate | null): string | null {
  if (!after) return null;
  const capDelta = (after.medianCapRate ?? 0) - (before?.medianCapRate ?? 0);
  const cocDelta = (after.medianCashOnCash ?? 0) - (before?.medianCashOnCash ?? 0);
  const cfDelta = (after.medianMonthlyCashFlow ?? 0) - (before?.medianMonthlyCashFlow ?? 0);
  if ((before?.consensusLabel || null) !== (after.consensusLabel || null)) {
    return `Community underwriting shifted from ${before?.consensusLabel || "no consensus"} to ${after.consensusLabel || "no consensus"}.`;
  }
  if (Math.abs(capDelta) >= 0.4) {
    return `Community median cap rate moved by ${capDelta > 0 ? "+" : ""}${capDelta.toFixed(1)} points.`;
  }
  if (Math.abs(cocDelta) >= 0.75) {
    return `Community median cash-on-cash moved by ${cocDelta > 0 ? "+" : ""}${cocDelta.toFixed(1)} points.`;
  }
  if (Math.abs(cfDelta) >= 100) {
    return `Community median monthly cash flow moved by ${cfDelta > 0 ? "+" : ""}${Math.round(cfDelta).toLocaleString()}.`;
  }
  return null;
}

async function getRecipient(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user;
}

async function recipientAllows(userId: string, kind: "listing" | "community" | "digest"): Promise<boolean> {
  const pref = await storage.getNotificationPreference(userId);
  if (!pref) return true;
  if (!pref.productUpdatesEnabled) return false;
  if (kind === "listing") return pref.listingWatchAlertsEnabled;
  if (kind === "community") return pref.communityAlertsEnabled;
  return pref.digestEnabled;
}

function buildPayload(input: {
  recipient: { email: string; phone: string | null; firstName: string | null; lastName: string | null };
  eventType: NotificationKind;
  reasonText: string;
  ctaUrl: string;
  ctaLabel: string;
  subjectLine: string;
  previewText: string;
  listingMlsNumber?: string;
  listingAddress?: string | null;
  listingCity?: string | null;
  listingProvince?: string | null;
  listingPrice?: number | null;
  propertyType?: string | null;
  strategyType?: string | null;
  analysisId?: string;
  commentId?: string;
  capRate?: number | null;
  cashOnCash?: number | null;
  monthlyCashFlow?: number | null;
  consensusLabel?: string | null;
  matchCount?: number;
  searchArea?: string;
  emailHtml?: string;
  ghlTags: string[];
  leadScoreDelta: number;
}): GhlNotificationPayload {
  const firstName = input.recipient.firstName || "there";
  const fullName = buildFullName(input.recipient.firstName, input.recipient.lastName);
  const detailLines: string[] = [input.reasonText];
  if (input.capRate != null) detailLines.push(`Cap rate: ${formatPercent(input.capRate)}`);
  if (input.cashOnCash != null) detailLines.push(`Cash-on-cash: ${formatPercent(input.cashOnCash)}`);
  if (input.monthlyCashFlow != null) detailLines.push(`Monthly cash flow: ${formatCurrency(input.monthlyCashFlow)}`);
  detailLines.push(`${input.ctaLabel}: ${input.ctaUrl}`);

  return {
    sendEmail: true,
    eventType: input.eventType,
    eventId: "preview",
    eventTs: new Date().toISOString(),
    email: input.recipient.email,
    phone: input.recipient.phone,
    firstName,
    lastName: input.recipient.lastName,
    fullName,
    listingMlsNumber: input.listingMlsNumber,
    listingAddress: input.listingAddress || undefined,
    listingCity: input.listingCity || undefined,
    listingProvince: input.listingProvince || undefined,
    listingPrice: input.listingPrice ?? undefined,
    propertyType: input.propertyType || undefined,
    strategyType: input.strategyType || undefined,
    analysisId: input.analysisId,
    commentId: input.commentId,
    capRate: input.capRate ?? undefined,
    cashOnCash: input.cashOnCash ?? undefined,
    monthlyCashFlow: input.monthlyCashFlow ?? undefined,
    consensusLabel: input.consensusLabel || undefined,
    matchCount: input.matchCount,
    searchArea: input.searchArea,
    reasonText: input.reasonText,
    ctaLabel: input.ctaLabel,
    ctaUrl: input.ctaUrl,
    subjectLine: input.subjectLine,
    previewText: input.previewText,
    emailBody: buildEmailBody(firstName, detailLines),
    emailHtml: input.emailHtml,
    ghlTags: input.ghlTags,
    leadScoreDelta: input.leadScoreDelta,
  };
}

// upsertWatcherFromSavedDeal / syncWatchersFromDiscoverySignals used to live
// here, auto-creating listing_watchers rows (with all five alert flags on)
// from passive signals — saving a deal, shortlisting, or merely VIEWING a
// listing. Retired as consent-hostile: watches are now created only by the
// explicit Watch action (server/watchlists.ts), and legacy auto-created rows
// remain visible/deletable via GET /api/watchlists.

/**
 * Central unsubscribe gate. Every recipient must (a) not have turned off the
 * users.email_digest_opt_in flag and (b) not have a latest email_consent
 * ledger row of 'revoked' for the email channel (append-only CASL ledger —
 * latest row per user wins; no rows = no objection on record). Applied here,
 * in the single enqueue path, so every notification producer inherits it.
 */
async function filterUnsubscribedRecipients(userIds: string[]): Promise<Set<string>> {
  if (!userIds.length) return new Set();
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(
      inArray(users.id, userIds),
      sql`COALESCE(${users.emailDigestOptIn}, true) = true`,
      sql`COALESCE((
        SELECT ec.status FROM email_consent ec
        WHERE ec.user_id = ${users.id} AND ec.channel = 'email'
        ORDER BY ec.created_at DESC
        LIMIT 1
      ), 'granted') <> 'revoked'`,
    ));
  return new Set(rows.map((row) => row.id));
}

async function enqueueForRecipients(args: {
  eventType: NotificationKind;
  listingMlsNumber?: string;
  analysisId?: string;
  commentId?: string;
  city?: string | null;
  rawPayload: Record<string, unknown>;
  recipients: Array<{
    userId: string;
    payload: Omit<GhlNotificationPayload, "sendEmail" | "eventId" | "eventTs">;
    dedupeKey: string;
  }>;
}): Promise<void> {
  const allowedIds = await filterUnsubscribedRecipients(
    Array.from(new Set(args.recipients.map((recipient) => recipient.userId))),
  );
  const allowedRecipients = args.recipients.filter((recipient) => allowedIds.has(recipient.userId));
  const skipped = args.recipients.length - allowedRecipients.length;
  if (skipped > 0) {
    console.log(`[notifications] ${args.eventType}: skipped ${skipped} unsubscribed/revoked recipient(s)`);
  }
  if (!allowedRecipients.length) return;

  const event = await storage.createNotificationEvent({
    eventType: args.eventType,
    listingMlsNumber: args.listingMlsNumber || null,
    analysisId: args.analysisId || null,
    commentId: args.commentId || null,
    city: args.city || null,
    payloadJson: args.rawPayload,
  });

  await Promise.all(allowedRecipients.map(async (recipient) => {
    await storage.createNotificationQueueItem({
      recipientUserId: recipient.userId,
      notificationEventId: event.id,
      channel: "ghl_webhook",
      templateKey: args.eventType,
      dedupeKey: recipient.dedupeKey,
      payloadJson: {
        ...recipient.payload,
        sendEmail: true,
        eventId: event.id,
        eventTs: new Date().toISOString(),
      },
      scheduledFor: new Date(),
    });
  }));
}

export async function queueAnalysisNotification(params: {
  kind: "analysis_created" | "analysis_updated";
  analysis: PropertyAnalysis;
  actorUserId: string;
  beforeAggregate?: ListingAnalysisAggregate | null;
  afterAggregate?: ListingAnalysisAggregate | null;
}): Promise<void> {
  const watchers = await storage.getListingWatchersByListing(params.analysis.listingMlsNumber);
  const listingRecipientIds = Array.from(new Set(
    watchers
      .filter((watcher) => watcher.userId !== params.actorUserId && watcher.watchAnalysisUpdates)
      .map((watcher) => watcher.userId),
  ));

  const metrics = (params.analysis.calculatedMetrics || {}) as Record<string, unknown>;
  const recipients: Array<{
    userId: string;
    payload: Omit<GhlNotificationPayload, "sendEmail" | "eventId" | "eventTs">;
    dedupeKey: string;
  }> = [];

  for (const userId of listingRecipientIds) {
    if (!(await recipientAllows(userId, "listing"))) continue;
    const recipient = await getRecipient(userId);
    if (!recipient?.email) continue;
    const subjectLine = params.kind === "analysis_created"
      ? `New analysis on ${params.analysis.title || params.analysis.listingMlsNumber}`
      : `Updated numbers for ${params.analysis.title || params.analysis.listingMlsNumber}`;
    const payload = buildPayload({
      recipient,
      eventType: params.kind,
      reasonText: params.kind === "analysis_created"
        ? `A new ${params.analysis.propertyType || "investment"} analysis was added for a listing you are watching in ${params.analysis.city || "your market"}.`
        : "The underwriting changed materially on a listing you are watching.",
      ctaLabel: params.kind === "analysis_created" ? "See what changed" : "Review update",
      ctaUrl: buildAnalysisUrl(params.analysis.listingMlsNumber),
      subjectLine,
      previewText: params.kind === "analysis_created"
        ? "Someone ran fresh numbers on a listing you are watching."
        : "The analysis changed on a listing you are watching.",
      listingMlsNumber: params.analysis.listingMlsNumber,
      listingAddress: params.analysis.title || params.analysis.listingMlsNumber,
      listingCity: params.analysis.city,
      listingProvince: params.analysis.province,
      listingPrice: params.analysis.listingPrice,
      propertyType: params.analysis.propertyType,
      strategyType: typeof params.analysis.sourceContext === "object" ? String((params.analysis.sourceContext as Record<string, unknown>)?.strategyType || "") || null : null,
      analysisId: params.analysis.id,
      capRate: getMetric(metrics, ["capRate", "cap_rate"]),
      cashOnCash: getMetric(metrics, ["cashOnCash", "cash_on_cash"]),
      monthlyCashFlow: getMetric(metrics, ["monthlyCashFlow", "monthly_cash_flow"]),
      consensusLabel: params.afterAggregate?.consensusLabel || null,
      ghlTags: ["realist-user", params.kind, ...(params.analysis.city ? [`city-${params.analysis.city.toLowerCase().replace(/\s+/g, "-")}`] : [])],
      leadScoreDelta: params.kind === "analysis_created" ? 4 : 3,
    });
    recipients.push({
      userId,
      payload,
      dedupeKey: `${params.kind}:${userId}:${params.analysis.id}`,
    });
  }

  if (recipients.length) {
    await enqueueForRecipients({
      eventType: params.kind,
      listingMlsNumber: params.analysis.listingMlsNumber,
      analysisId: params.analysis.id,
      city: params.analysis.city,
      rawPayload: {
        analysisId: params.analysis.id,
        listingMlsNumber: params.analysis.listingMlsNumber,
        kind: params.kind,
      },
      recipients,
    });
  }

  const consensusReason = buildConsensusReason(params.beforeAggregate, params.afterAggregate);
  if (!consensusReason || !params.afterAggregate) return;

  const consensusRecipients: typeof recipients = [];
  for (const userId of Array.from(new Set(
    watchers
      .filter((watcher) => watcher.userId !== params.actorUserId && watcher.watchConsensusUpdates)
      .map((watcher) => watcher.userId),
  ))) {
    if (!(await recipientAllows(userId, "community"))) continue;
    const recipient = await getRecipient(userId);
    if (!recipient?.email) continue;
    const payload = buildPayload({
      recipient,
      eventType: "consensus_shifted",
      reasonText: consensusReason,
      ctaLabel: "See consensus",
      ctaUrl: buildAnalysisUrl(params.analysis.listingMlsNumber),
      subjectLine: `Community view changed on ${params.analysis.title || params.analysis.listingMlsNumber}`,
      previewText: `Consensus shifted to ${params.afterAggregate.consensusLabel || "a new view"}.`,
      listingMlsNumber: params.analysis.listingMlsNumber,
      listingAddress: params.analysis.title || params.analysis.listingMlsNumber,
      listingCity: params.analysis.city,
      listingProvince: params.analysis.province,
      consensusLabel: params.afterAggregate.consensusLabel,
      ghlTags: ["realist-user", "consensus-shifted"],
      leadScoreDelta: 4,
    });
    consensusRecipients.push({
      userId,
      payload,
      dedupeKey: `consensus_shifted:${userId}:${params.analysis.listingMlsNumber}:${params.afterAggregate.consensusLabel || "none"}`,
    });
  }

  if (consensusRecipients.length) {
    await enqueueForRecipients({
      eventType: "consensus_shifted",
      listingMlsNumber: params.analysis.listingMlsNumber,
      analysisId: params.analysis.id,
      city: params.analysis.city,
      rawPayload: {
        listingMlsNumber: params.analysis.listingMlsNumber,
        reasonText: consensusReason,
      },
      recipients: consensusRecipients,
    });
  }
}

export async function queueCommentNotification(params: {
  comment: ListingComment;
  actorUserId: string;
  listingAddress?: string | null;
  listingCity?: string | null;
  parentComment?: ListingComment | null;
  beforeAggregate?: ListingAnalysisAggregate | null;
  afterAggregate?: ListingAnalysisAggregate | null;
}): Promise<void> {
  const watchers = await storage.getListingWatchersByListing(params.comment.listingMlsNumber);
  const watcherIds = Array.from(new Set(
    watchers
      .filter((watcher) => watcher.userId !== params.actorUserId && watcher.watchCommentUpdates)
      .map((watcher) => watcher.userId),
  ));

  const recipients: Array<{
    userId: string;
    payload: Omit<GhlNotificationPayload, "sendEmail" | "eventId" | "eventTs">;
    dedupeKey: string;
  }> = [];

  for (const userId of watcherIds) {
    if (!(await recipientAllows(userId, "community"))) continue;
    const recipient = await getRecipient(userId);
    if (!recipient?.email) continue;
    recipients.push({
      userId,
      payload: buildPayload({
        recipient,
        eventType: "comment_created",
        reasonText: "There is new investor discussion on a listing you are watching.",
        ctaLabel: "Join the discussion",
        ctaUrl: buildAnalysisUrl(params.comment.listingMlsNumber),
        subjectLine: `New discussion on ${params.listingAddress || params.comment.listingMlsNumber}`,
        previewText: "There is new investor discussion on a listing you are watching.",
        listingMlsNumber: params.comment.listingMlsNumber,
        listingAddress: params.listingAddress || params.comment.listingMlsNumber,
        listingCity: params.listingCity,
        commentId: params.comment.id,
        ghlTags: ["realist-user", "comment-created"],
        leadScoreDelta: 2,
      }),
      dedupeKey: `comment_created:${userId}:${params.comment.id}`,
    });
  }

  if (recipients.length) {
    await enqueueForRecipients({
      eventType: "comment_created",
      listingMlsNumber: params.comment.listingMlsNumber,
      commentId: params.comment.id,
      city: params.listingCity,
      rawPayload: {
        commentId: params.comment.id,
        listingMlsNumber: params.comment.listingMlsNumber,
      },
      recipients,
    });
  }

  if (params.parentComment && params.parentComment.userId !== params.actorUserId) {
    const recipient = await getRecipient(params.parentComment.userId);
    if (recipient?.email && await recipientAllows(params.parentComment.userId, "community")) {
      await enqueueForRecipients({
        eventType: "comment_reply",
        listingMlsNumber: params.comment.listingMlsNumber,
        commentId: params.comment.id,
        city: params.listingCity,
        rawPayload: {
          commentId: params.comment.id,
          parentCommentId: params.parentComment.id,
        },
        recipients: [{
          userId: params.parentComment.userId,
          payload: buildPayload({
            recipient,
            eventType: "comment_reply",
            reasonText: "Someone replied to your comment.",
            ctaLabel: "View reply",
            ctaUrl: buildAnalysisUrl(params.comment.listingMlsNumber),
            subjectLine: "Someone replied to your comment",
            previewText: `New reply on ${params.listingAddress || params.comment.listingMlsNumber}.`,
            listingMlsNumber: params.comment.listingMlsNumber,
            listingAddress: params.listingAddress || params.comment.listingMlsNumber,
            listingCity: params.listingCity,
            commentId: params.comment.id,
            ghlTags: ["realist-user", "comment-reply"],
            leadScoreDelta: 3,
          }),
          dedupeKey: `comment_reply:${params.parentComment.userId}:${params.comment.id}`,
        }],
      });
    }
  }

  const consensusReason = buildConsensusReason(params.beforeAggregate, params.afterAggregate);
  if (!consensusReason || !params.afterAggregate) return;
  const consensusRecipients: typeof recipients = [];
  for (const userId of Array.from(new Set(
    watchers
      .filter((watcher) => watcher.userId !== params.actorUserId && watcher.watchConsensusUpdates)
      .map((watcher) => watcher.userId),
  ))) {
    if (!(await recipientAllows(userId, "community"))) continue;
    const recipient = await getRecipient(userId);
    if (!recipient?.email) continue;
    consensusRecipients.push({
      userId,
      payload: buildPayload({
        recipient,
        eventType: "consensus_shifted",
        reasonText: consensusReason,
        ctaLabel: "See consensus",
        ctaUrl: buildAnalysisUrl(params.comment.listingMlsNumber),
        subjectLine: `Community view changed on ${params.listingAddress || params.comment.listingMlsNumber}`,
        previewText: `Consensus shifted to ${params.afterAggregate.consensusLabel || "a new view"}.`,
        listingMlsNumber: params.comment.listingMlsNumber,
        listingAddress: params.listingAddress || params.comment.listingMlsNumber,
        listingCity: params.listingCity,
        consensusLabel: params.afterAggregate.consensusLabel,
        ghlTags: ["realist-user", "consensus-shifted"],
        leadScoreDelta: 4,
      }),
      dedupeKey: `consensus_shifted:${userId}:${params.comment.listingMlsNumber}:${params.afterAggregate.consensusLabel || "none"}`,
    });
  }

  if (consensusRecipients.length) {
    await enqueueForRecipients({
      eventType: "consensus_shifted",
      listingMlsNumber: params.comment.listingMlsNumber,
      commentId: params.comment.id,
      city: params.listingCity,
      rawPayload: {
        listingMlsNumber: params.comment.listingMlsNumber,
        reasonText: consensusReason,
      },
      recipients: consensusRecipients,
    });
  }
}

export async function processPendingGhlNotifications(limit = 50): Promise<{ sent: number; failed: number; skipped: number }> {
  const { appendLead } = await import("./leadsSheet");
  const webhookUrl = process.env.GHL_WEBHOOK_URL;

  const queue = await storage.getPendingNotificationQueue(limit);
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const item of queue) {
    // Always mirror the notification event to the owner's Google Sheet
    // (replaces GHL as the primary destination).
    const payload = (item.payloadJson || {}) as Record<string, any>;
    appendLead("GhlNotifications", {
      queueId: item.id,
      eventType: (item as any).eventType || payload.eventType || "",
      recipientEmail: payload.email || payload.recipientEmail || "",
      recipientFirstName: payload.firstName || "",
      ...payload,
    });

    if (!webhookUrl) {
      // No GHL configured — count the sheet write as the successful send.
      sent++;
      await storage.markNotificationQueueItemSent(item.id);
      continue;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.payloadJson),
      });
      if (!response.ok) {
        failed++;
        await storage.markNotificationQueueItemFailed(item.id, `HTTP ${response.status}`);
        continue;
      }
      sent++;
      await storage.markNotificationQueueItemSent(item.id);
    } catch (error) {
      failed++;
      await storage.markNotificationQueueItemFailed(item.id, error instanceof Error ? error.message : "Unknown send error");
    }
  }

  skipped = Math.max(0, limit - queue.length);
  return { sent, failed, skipped };
}

export async function buildSavedSearchMatchPayload(params: {
  email: string;
  firstName: string;
  searchArea: string;
  propertyType: string;
  matchCount: number;
  ctaUrl: string;
}): Promise<GhlNotificationPayload> {
  return {
    sendEmail: true,
    eventType: "saved_search_match",
    eventId: "preview",
    eventTs: new Date().toISOString(),
    email: params.email,
    firstName: params.firstName,
    reasonText: `${params.matchCount} new ${params.propertyType} listings match your saved search in ${params.searchArea}.`,
    ctaLabel: "See matches",
    ctaUrl: params.ctaUrl,
    subjectLine: `New matches in ${params.searchArea}`,
    previewText: `${params.matchCount} new ${params.propertyType} listings match your saved search.`,
    emailBody: buildEmailBody(params.firstName, [
      `We found ${params.matchCount} new ${params.propertyType} listings matching your saved search in ${params.searchArea}.`,
      `See matches: ${params.ctaUrl}`,
    ]),
    searchArea: params.searchArea,
    propertyType: params.propertyType,
    matchCount: params.matchCount,
    ghlTags: ["realist-user", "saved-search", "match-alert"],
    leadScoreDelta: 6,
  };
}

export async function buildAnalysisCompletedPayload(params: {
  email: string;
  firstName: string;
  strategyType: string;
  listingCity: string;
  capRate?: number | null;
  cashOnCash?: number | null;
  monthlyCashFlow?: number | null;
  ctaUrl: string;
  reasonText: string;
}): Promise<GhlNotificationPayload> {
  return {
    sendEmail: true,
    eventType: "analyzer_completed",
    eventId: "preview",
    eventTs: new Date().toISOString(),
    email: params.email,
    firstName: params.firstName,
    strategyType: params.strategyType,
    listingCity: params.listingCity,
    capRate: params.capRate ?? undefined,
    cashOnCash: params.cashOnCash ?? undefined,
    monthlyCashFlow: params.monthlyCashFlow ?? undefined,
    reasonText: params.reasonText,
    ctaLabel: "Open it here",
    ctaUrl: params.ctaUrl,
    subjectLine: "Your analysis is ready to revisit",
    previewText: "Take the next step on this deal.",
    emailBody: buildEmailBody(params.firstName, [
      `Your latest ${params.strategyType} analysis is complete.`,
      params.reasonText,
      `Open it here: ${params.ctaUrl}`,
    ]),
    ghlTags: ["realist-user", "analysis-complete"],
    leadScoreDelta: 8,
  };
}

export async function queueSavedSearchMatchNotifications(listings: UsListing[]): Promise<number> {
  if (!listings.length) return 0;

  const savedSearchSignals = await db.select().from(discoverySignals)
    .where(eq(discoverySignals.signalType, "saved_search"));

  const groupedMatches = new Map<string, {
    userId: string;
    signal: DiscoverySignal;
    matches: UsListing[];
  }>();

  for (const signal of savedSearchSignals) {
    const matches = listings.filter((listing) => matchesSavedSearch(signal, listing));
    if (!matches.length) continue;
    const key = `${signal.userId}:${signal.signalKey}`;
    groupedMatches.set(key, {
      userId: signal.userId,
      signal,
      matches,
    });
  }

  let queued = 0;
  for (const grouped of groupedMatches.values()) {
    if (!(await recipientAllows(grouped.userId, "listing"))) continue;
    const recipient = await getRecipient(grouped.userId);
    if (!recipient?.email) continue;

    const searchArea = getSignalSearchArea(grouped.signal) || grouped.matches[0]?.city || "your market";
    const propertyType = getSignalPropertyType(grouped.signal) || grouped.matches[0]?.propertyType || "investment";
    const payload = await buildSavedSearchMatchPayload({
      email: recipient.email,
      firstName: recipient.firstName || "there",
      searchArea,
      propertyType,
      matchCount: grouped.matches.length,
      ctaUrl: buildMarketSearchUrl(searchArea, propertyType),
    });

    const dedupeKey = `saved_search_match:${grouped.userId}:${grouped.signal.signalKey}:${grouped.matches.map((listing) => `${listing.source}:${listing.sourceId}`).join(",")}`;
    await enqueueForRecipients({
      eventType: "saved_search_match",
      city: grouped.matches[0]?.city || null,
      rawPayload: {
        signalKey: grouped.signal.signalKey,
        matches: grouped.matches.map((listing) => ({
          source: listing.source,
          sourceId: listing.sourceId,
          city: listing.city,
          propertyType: listing.propertyType,
        })),
      },
      recipients: [{
        userId: grouped.userId,
        payload: {
          ...payload,
          ghlTags: Array.from(new Set([
            ...payload.ghlTags,
            ...(searchArea ? [`city-${searchArea.toLowerCase().replace(/\s+/g, "-")}`] : []),
            ...(getSignalStrategy(grouped.signal) ? [`strategy-${getSignalStrategy(grouped.signal)!.toLowerCase().replace(/\s+/g, "_")}`] : []),
          ])),
        },
        dedupeKey,
      }],
    });
    queued++;
  }

  return queued;
}

export async function queueUsListingChangeNotifications(changes: Array<{
  previous: UsListing;
  current: UsListing;
}>): Promise<number> {
  let queued = 0;

  for (const change of changes) {
    const listingMlsNumber = change.current.sourceId;
    const watchers = await storage.getListingWatchersByListing(listingMlsNumber);
    const watcherIds = Array.from(new Set(
      watchers
        .filter((watcher) => watcher.userId && (watcher.watchPriceUpdates || watcher.watchStatusUpdates))
        .map((watcher) => watcher.userId),
    ));

    const priceReason = buildPriceChangeReason(change.previous, change.current);
    const statusReason = buildStatusChangeReason(change.previous, change.current);
    const events: Array<{ eventType: "listing_price_changed" | "listing_status_changed"; reasonText: string }> = [];
    if (priceReason) events.push({ eventType: "listing_price_changed", reasonText: priceReason });
    if (statusReason) events.push({ eventType: "listing_status_changed", reasonText: statusReason });

    for (const event of events) {
      const recipients: Array<{
        userId: string;
        payload: Omit<GhlNotificationPayload, "sendEmail" | "eventId" | "eventTs">;
        dedupeKey: string;
      }> = [];

      for (const userId of watcherIds) {
        if (!(await recipientAllows(userId, "listing"))) continue;
        const recipient = await getRecipient(userId);
        if (!recipient?.email) continue;

        recipients.push({
          userId,
          payload: buildPayload({
            recipient,
            eventType: event.eventType,
            reasonText: event.reasonText,
            ctaLabel: "See listing",
            ctaUrl: buildUsListingUrl(change.current),
            subjectLine: `Update on ${change.current.formattedAddress || change.current.sourceId}`,
            previewText: "A listing you are watching just changed.",
            listingMlsNumber,
            listingAddress: change.current.formattedAddress || change.current.sourceId,
            listingCity: change.current.city,
            listingProvince: change.current.state,
            listingPrice: change.current.listPrice,
            propertyType: change.current.propertyType,
            ghlTags: ["realist-user", event.eventType],
            leadScoreDelta: event.eventType === "listing_price_changed" ? 5 : 4,
          }),
          dedupeKey: `${event.eventType}:${userId}:${listingMlsNumber}:${event.eventType === "listing_price_changed" ? change.current.listPrice : change.current.status}`,
        });
      }

      if (!recipients.length) continue;

      await enqueueForRecipients({
        eventType: event.eventType,
        listingMlsNumber,
        city: change.current.city,
        rawPayload: {
          listingMlsNumber,
          previousPrice: change.previous.listPrice,
          currentPrice: change.current.listPrice,
          previousStatus: change.previous.status,
          currentStatus: change.current.status,
        },
        recipients,
      });
      queued += recipients.length;
    }
  }

  return queued;
}

export async function queueSavedSearchMatchNotificationsForDdf(listings: DdfListingSnapshot[]): Promise<number> {
  if (!listings.length) return 0;

  const savedSearchSignals = await db.select().from(discoverySignals)
    .where(eq(discoverySignals.signalType, "saved_search"));

  const groupedMatches = new Map<string, {
    userId: string;
    signal: DiscoverySignal;
    matches: DdfListingSnapshot[];
  }>();

  for (const signal of savedSearchSignals) {
    const matches = listings.filter((listing) => matchesSavedSearchDdf(signal, listing));
    if (!matches.length) continue;
    groupedMatches.set(`${signal.userId}:${signal.signalKey}`, {
      userId: signal.userId,
      signal,
      matches,
    });
  }

  let queued = 0;
  for (const grouped of groupedMatches.values()) {
    if (!(await recipientAllows(grouped.userId, "listing"))) continue;
    const recipient = await getRecipient(grouped.userId);
    if (!recipient?.email) continue;

    const searchArea = getSignalSearchArea(grouped.signal) || grouped.matches[0]?.city || "your market";
    const propertyType = getSignalPropertyType(grouped.signal) || grouped.matches[0]?.propertySubType || grouped.matches[0]?.structureType || "investment";
    const payload = await buildSavedSearchMatchPayload({
      email: recipient.email,
      firstName: recipient.firstName || "there",
      searchArea,
      propertyType,
      matchCount: grouped.matches.length,
      ctaUrl: buildMarketSearchUrl(searchArea, propertyType),
    });

    await enqueueForRecipients({
      eventType: "saved_search_match",
      city: grouped.matches[0]?.city || null,
      rawPayload: {
        signalKey: grouped.signal.signalKey,
        matches: grouped.matches.map((listing) => ({
          listingKey: listing.listingKey,
          mlsNumber: listing.mlsNumber,
          city: listing.city,
          propertyType: listing.propertySubType || listing.structureType,
        })),
      },
      recipients: [{
        userId: grouped.userId,
        payload: {
          ...payload,
          ghlTags: Array.from(new Set([
            ...payload.ghlTags,
            ...(searchArea ? [`city-${searchArea.toLowerCase().replace(/\s+/g, "-")}`] : []),
            ...(getSignalStrategy(grouped.signal) ? [`strategy-${getSignalStrategy(grouped.signal)!.toLowerCase().replace(/\s+/g, "_")}`] : []),
          ])),
        },
        dedupeKey: `saved_search_match:${grouped.userId}:${grouped.signal.signalKey}:${grouped.matches.map((listing) => listing.listingKey).join(",")}`,
      }],
    });
    queued++;
  }

  return queued;
}

export async function queueDdfListingChangeNotifications(changes: Array<{
  previous: DdfListingSnapshot;
  current: DdfListingSnapshot;
}>): Promise<number> {
  let queued = 0;

  for (const change of changes) {
    const listingMlsNumber = change.current.mlsNumber || change.current.listingKey;
    const watchers = await storage.getListingWatchersByListing(listingMlsNumber);
    const watcherIds = Array.from(new Set(
      watchers
        .filter((watcher) => watcher.userId && (watcher.watchPriceUpdates || watcher.watchStatusUpdates))
        .map((watcher) => watcher.userId),
    ));

    const priceReason = buildDdfPriceChangeReason(change.previous, change.current);
    const statusReason = buildDdfStatusChangeReason(change.previous, change.current);
    const events: Array<{ eventType: "listing_price_changed" | "listing_status_changed"; reasonText: string }> = [];
    if (priceReason) events.push({ eventType: "listing_price_changed", reasonText: priceReason });
    if (statusReason) events.push({ eventType: "listing_status_changed", reasonText: statusReason });

    for (const event of events) {
      const recipients: Array<{
        userId: string;
        payload: Omit<GhlNotificationPayload, "sendEmail" | "eventId" | "eventTs">;
        dedupeKey: string;
      }> = [];

      for (const userId of watcherIds) {
        if (!(await recipientAllows(userId, "listing"))) continue;
        const recipient = await getRecipient(userId);
        if (!recipient?.email) continue;

        recipients.push({
          userId,
          payload: buildPayload({
            recipient,
            eventType: event.eventType,
            reasonText: event.reasonText,
            ctaLabel: "See listing",
            ctaUrl: buildCanadianListingUrl(change.current),
            subjectLine: `Update on ${change.current.mlsNumber || change.current.listingKey}`,
            previewText: "A listing you are watching just changed.",
            listingMlsNumber,
            listingAddress: change.current.mlsNumber || change.current.listingKey,
            listingCity: change.current.city,
            listingProvince: change.current.province,
            listingPrice: change.current.listPrice,
            propertyType: change.current.propertySubType || change.current.structureType,
            ghlTags: ["realist-user", event.eventType],
            leadScoreDelta: event.eventType === "listing_price_changed" ? 5 : 4,
          }),
          dedupeKey: `${event.eventType}:${userId}:${listingMlsNumber}:${event.eventType === "listing_price_changed" ? change.current.listPrice : safeString((change.current.rawJson as Record<string, unknown> | undefined)?.StandardStatus) || "status"}`,
        });
      }

      if (!recipients.length) continue;

      await enqueueForRecipients({
        eventType: event.eventType,
        listingMlsNumber,
        city: change.current.city,
        rawPayload: {
          listingMlsNumber,
          previousPrice: change.previous.listPrice,
          currentPrice: change.current.listPrice,
          previousStatus: safeString((change.previous.rawJson as Record<string, unknown> | undefined)?.StandardStatus),
          currentStatus: safeString((change.current.rawJson as Record<string, unknown> | undefined)?.StandardStatus),
        },
        recipients,
      });
      queued += recipients.length;
    }
  }

  return queued;
}

export async function queueDdfListingRemovedNotifications(listings: DdfListingSnapshot[]): Promise<number> {
  let queued = 0;

  for (const listing of listings) {
    const listingMlsNumber = listing.mlsNumber || listing.listingKey;
    const watchers = await storage.getListingWatchersByListing(listingMlsNumber);
    const watcherIds = Array.from(new Set(
      watchers
        .filter((watcher) => watcher.userId && watcher.watchStatusUpdates)
        .map((watcher) => watcher.userId),
    ));

    if (!watcherIds.length) continue;

    const recipients: Array<{
      userId: string;
      payload: Omit<GhlNotificationPayload, "sendEmail" | "eventId" | "eventTs">;
      dedupeKey: string;
    }> = [];

    for (const userId of watcherIds) {
      if (!(await recipientAllows(userId, "listing"))) continue;
      const recipient = await getRecipient(userId);
      if (!recipient?.email) continue;

      recipients.push({
        userId,
        payload: buildPayload({
          recipient,
          eventType: "listing_status_changed",
          reasonText: "This listing no longer appears in the active CREA DDF feed and may be off market, sold, or otherwise inactive.",
          ctaLabel: "Review listing",
          ctaUrl: buildCanadianListingUrl(listing),
          subjectLine: `Update on ${listing.mlsNumber || listing.listingKey}`,
          previewText: "A listing you are watching may no longer be active.",
          listingMlsNumber,
          listingAddress: listing.mlsNumber || listing.listingKey,
          listingCity: listing.city,
          listingProvince: listing.province,
          listingPrice: listing.listPrice,
          propertyType: listing.propertySubType || listing.structureType,
          ghlTags: ["realist-user", "listing_status_changed", "off-market"],
          leadScoreDelta: 4,
        }),
        dedupeKey: `listing_status_changed:${userId}:${listingMlsNumber}:off-market:${listing.snapshotMonth}`,
      });
    }

    if (!recipients.length) continue;

    await enqueueForRecipients({
      eventType: "listing_status_changed",
      listingMlsNumber,
      city: listing.city,
      rawPayload: {
        listingMlsNumber,
        previousStatus: safeString((listing.rawJson as Record<string, unknown> | undefined)?.StandardStatus),
        currentStatus: "off_market",
        inferredFromMissingSnapshot: true,
        snapshotMonth: listing.snapshotMonth,
      },
      recipients,
    });
    queued += recipients.length;
  }

  return queued;
}

export async function queueDailyDigestNotifications(): Promise<number> {
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sentQueue = await db.select().from(notificationQueue).where(and(
    eq(notificationQueue.channel, "ghl_webhook"),
    eq(notificationQueue.status, "sent"),
    gte(notificationQueue.sentAt, since),
  ));

  const grouped = new Map<string, typeof sentQueue>();
  for (const item of sentQueue) {
    if (item.templateKey === "daily_digest_ready") continue;
    if (!item.recipientUserId) continue;
    const current = grouped.get(item.recipientUserId) || [];
    current.push(item);
    grouped.set(item.recipientUserId, current);
  }

  let queued = 0;
  for (const [userId, items] of grouped.entries()) {
    if (items.length < 2) continue;
    if (!(await recipientAllows(userId, "digest"))) continue;

    const existing = await db.select({ id: notificationQueue.id }).from(notificationQueue).where(and(
      eq(notificationQueue.recipientUserId, userId),
      eq(notificationQueue.templateKey, "daily_digest_ready"),
      gte(notificationQueue.createdAt, since),
    )).limit(1);
    if (existing.length) continue;

    const recipient = await getRecipient(userId);
    if (!recipient?.email) continue;

    const topReasons = items.slice(0, 3).map((item) => {
      const payload = (item.payloadJson || {}) as Record<string, unknown>;
      return safeString(payload.subjectLine) || safeString(payload.reasonText) || "New activity on Realist";
    }).filter(Boolean);
    if (!topReasons.length) continue;

    const payload = buildPayload({
      recipient,
      eventType: "daily_digest_ready",
      reasonText: topReasons.join(" | "),
      ctaLabel: "Open Realist",
      ctaUrl: "https://realist.ca",
      subjectLine: "Your Realist daily update",
      previewText: "New activity relevant to your workflow.",
      ghlTags: ["realist-user", "daily-digest"],
      leadScoreDelta: 1,
    });

    await enqueueForRecipients({
      eventType: "daily_digest_ready",
      rawPayload: {
        itemCount: items.length,
        highlights: topReasons,
      },
      recipients: [{
        userId,
        payload,
        dedupeKey: `daily_digest_ready:${userId}:${now.toISOString().slice(0, 10)}`,
      }],
    });
    queued++;
  }

  return queued;
}

export async function queueInactiveHighIntentNotifications(): Promise<number> {
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const lookbackThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const weeklyThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const staleWatchers = await db.select().from(listingWatchers).where(and(
    lte(listingWatchers.lastSeenAt, staleThreshold),
    gte(listingWatchers.lastSeenAt, lookbackThreshold),
  ));

  const latestWatcherByUser = new Map<string, typeof staleWatchers[number]>();
  for (const watcher of staleWatchers) {
    const existing = latestWatcherByUser.get(watcher.userId);
    if (!existing || existing.lastSeenAt < watcher.lastSeenAt) {
      latestWatcherByUser.set(watcher.userId, watcher);
    }
  }

  let queued = 0;
  for (const [userId, watcher] of latestWatcherByUser.entries()) {
    if (!(await recipientAllows(userId, "listing"))) continue;

    const recentAnalysis = await db.select({ id: analyses.id }).from(analyses).where(and(
      eq(analyses.userId, userId),
      gte(analyses.createdAt, staleThreshold),
    )).limit(1);
    if (recentAnalysis.length) continue;

    const recentNotification = await db.select({ id: notificationQueue.id }).from(notificationQueue).where(and(
      eq(notificationQueue.recipientUserId, userId),
      eq(notificationQueue.templateKey, "inactive_high_intent"),
      gte(notificationQueue.createdAt, weeklyThreshold),
    )).limit(1);
    if (recentNotification.length) continue;

    const recipient = await getRecipient(userId);
    if (!recipient?.email) continue;

    const userSignals = await db.select().from(discoverySignals).where(eq(discoverySignals.userId, userId));
    const savedSearch = userSignals.find((signal) => signal.signalType === "saved_search");
    const savedListing = userSignals.find((signal) => signal.signalType === "saved_listing");
    const latestAnalysis = await getLatestAnalysisForUser(userId);
    const city = getSignalSearchArea(savedSearch) || safeString((savedListing?.payloadJson as Record<string, unknown> | undefined)?.city) || latestAnalysis?.city || "your market";
    const strategy = getSignalStrategy(savedSearch)
      || safeString((savedListing?.payloadJson as Record<string, unknown> | undefined)?.strategy)
      || latestAnalysis?.strategyType
      || "real estate";

    const payload = buildPayload({
      recipient,
      eventType: "inactive_high_intent",
      reasonText: `You were actively looking at ${strategy} opportunities in ${city} and have not been back.`,
      ctaLabel: "Pick up where you left off",
      ctaUrl: buildMarketSearchUrl(city, safeString((savedSearch?.payloadJson as Record<string, unknown> | undefined)?.propertyType) || latestAnalysis?.strategyType || null),
      subjectLine: "Pick up where you left off",
      previewText: "Your next best move is waiting.",
      listingMlsNumber: watcher.listingMlsNumber,
      listingCity: city,
      strategyType: strategy,
      ghlTags: ["realist-user", "reactivation"],
      leadScoreDelta: 0,
    });

    await enqueueForRecipients({
      eventType: "inactive_high_intent",
      listingMlsNumber: watcher.listingMlsNumber,
      city,
      rawPayload: {
        listingMlsNumber: watcher.listingMlsNumber,
        lastSeenAt: watcher.lastSeenAt,
      },
      recipients: [{
        userId,
        payload,
        dedupeKey: `inactive_high_intent:${userId}:${now.toISOString().slice(0, 10)}`,
      }],
    });
    queued++;
  }

  return queued;
}

export async function getLatestAnalysisForUser(userId: string) {
  const [analysis] = await db.select().from(analyses)
    .where(eq(analyses.userId, userId))
    .orderBy(desc(analyses.createdAt))
    .limit(1);
  return analysis;
}

export async function getAggregateByMls(mlsNumber: string): Promise<ListingAnalysisAggregate | undefined> {
  const [aggregate] = await db.select().from(listingAnalysisAggregates)
    .where(eq(listingAnalysisAggregates.listingMlsNumber, mlsNumber))
    .limit(1);
  return aggregate;
}

// ---------------------------------------------------------------------------
// Co-analysis social proof
// ---------------------------------------------------------------------------

/**
 * When a user posts an analysis, notify all OTHER users who previously
 * analyzed the same MLS number. One email per user per MLS per day cap.
 */
export async function queueCoAnalysisNotifications(params: {
  newAnalysis: PropertyAnalysis;
  actorUserId: string;
}): Promise<number> {
  const { newAnalysis, actorUserId } = params;
  if (!newAnalysis.listingMlsNumber) return 0;

  // Find distinct users who previously analyzed this listing (exclude the actor)
  const priorAnalysts = await db
    .selectDistinct({ userId: propertyAnalyses.userId })
    .from(propertyAnalyses)
    .where(and(
      eq(propertyAnalyses.listingMlsNumber, newAnalysis.listingMlsNumber),
      ne(propertyAnalyses.userId, actorUserId),
      isNotNull(propertyAnalyses.userId),
      eq(propertyAnalyses.isDeleted, false),
    ));

  if (!priorAnalysts.length) return 0;

  const address = newAnalysis.listingMlsNumber;
  const city = newAnalysis.city || "";
  const metricsRaw = (newAnalysis.calculatedMetrics || {}) as Record<string, unknown>;
  const capRate = typeof metricsRaw.capRate === "number" ? metricsRaw.capRate : null;
  const cashOnCash = typeof metricsRaw.cashOnCash === "number" ? metricsRaw.cashOnCash : null;

  const capRateText = capRate != null ? ` — ${capRate.toFixed(1)}% cap rate` : "";
  const cocText = cashOnCash != null ? `, ${cashOnCash.toFixed(1)}% CoC` : "";
  const listingUrl = `https://realist.ca/listings/${newAnalysis.listingMlsNumber}?source=co-analysis-email`;

  let queued = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const { userId } of priorAnalysts) {
    if (!userId) continue;
    if (!(await recipientAllows(userId, "community"))) continue;

    const recipient = await getRecipient(userId);
    if (!recipient?.email) continue;

    const dedupeKey = `co_analysis_alert:${userId}:${newAnalysis.listingMlsNumber}:${today}`;

    const reasonText = `Another investor just underwrote ${address}${city ? ` in ${city}` : ""}${capRateText}${cocText}.`;
    const emailBody = buildEmailBody(recipient.firstName || "there", [
      `Someone else just analyzed a property you've looked at:`,
      ``,
      `${address}${city ? ` — ${city}` : ""}`,
      capRate != null ? `Their cap rate: ${capRate.toFixed(1)}%` : "",
      cashOnCash != null ? `Their cash-on-cash: ${cashOnCash.toFixed(1)}%` : "",
      ``,
      `Market consensus is forming on this listing. See how your numbers compare:`,
      listingUrl,
    ].filter(Boolean));

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;background:#fff;">
        <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:24px;border-radius:8px 8px 0 0;">
          <p style="margin:0;font-size:11px;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;">Realist.ca</p>
          <h2 style="margin:4px 0 0;font-size:18px;color:#fff;font-weight:700;">Another investor just underwrote this deal</h2>
        </div>
        <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;">
          <p style="margin:0 0 16px;font-size:15px;color:#111827;">Hey ${recipient.firstName || "there"},</p>
          <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
            Another investor just ran their numbers on <strong>${address}</strong>${city ? ` in <strong>${city}</strong>` : ""} — a listing you've analyzed before.
          </p>
          ${capRate != null ? `
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:0 0 16px;">
            <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;">Their underwriting</p>
            <p style="margin:0;font-size:22px;font-weight:700;color:#7c3aed;">${capRate.toFixed(1)}% cap rate${cashOnCash != null ? ` · ${cashOnCash.toFixed(1)}% CoC` : ""}</p>
          </div>` : ""}
          <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">
            Market consensus is starting to form. See how your assumptions stack up.
          </p>
          <div style="text-align:center;">
            <a href="${listingUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">
              Compare Your Analysis
            </a>
          </div>
        </div>
        <div style="padding:12px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;background:#f9fafb;text-align:center;">
          <p style="margin:0;font-size:11px;color:#9ca3af;">Realist.ca — Canada's Real Estate Deal Analyzer</p>
        </div>
      </div>
    `;

    await enqueueForRecipients({
      eventType: "co_analysis_alert",
      listingMlsNumber: newAnalysis.listingMlsNumber,
      city: newAnalysis.city || null,
      rawPayload: {
        listingMlsNumber: newAnalysis.listingMlsNumber,
        newAnalysisId: newAnalysis.id,
        actorUserId,
        capRate,
        cashOnCash,
      },
      recipients: [{
        userId,
        payload: buildPayload({
          recipient,
          eventType: "co_analysis_alert",
          reasonText,
          ctaLabel: "Compare your analysis",
          ctaUrl: listingUrl,
          subjectLine: `Another investor just underwrote ${address}`,
          previewText: `See how your numbers compare on this listing.`,
          listingMlsNumber: newAnalysis.listingMlsNumber,
          listingCity: city,
          capRate,
          cashOnCash,
          ghlTags: ["realist-user", "co-analysis-alert"],
          leadScoreDelta: 7,
          emailHtml: html,
        }),
        dedupeKey,
      }],
    });
    queued++;
  }

  return queued;
}

// ---------------------------------------------------------------------------
// Milestone emails
// ---------------------------------------------------------------------------

const MILESTONES = [1, 5, 10, 25, 50, 100, 250, 500] as const;

const MILESTONE_COPY: Record<number, { subject: string; body: string }> = {
  1:   { subject: "You just analyzed your first deal on Realist", body: "Welcome to the community. Every serious investor starts with deal #1 — you've done it. The edge compounds from here." },
  5:   { subject: "5 deals analyzed on Realist.ca", body: "Five deals in. That's more underwriting than most people do in a full year of 'looking'. You're building the right habit." },
  10:  { subject: "10 deals analyzed — you're in the top tier", body: "Ten clean underwritings. The math muscle is real now. Most investors quit after one or two — you're in a different category." },
  25:  { subject: "25 deals analyzed on Realist.ca", body: "Twenty-five deals. At this point you have genuine market pattern recognition — you know what a real number looks like before the calculator confirms it." },
  50:  { subject: "50 deals analyzed — certified deal nerd", body: "Fifty analyses. The average Canadian 'real estate investor' has looked at maybe three deals in their life. You've done fifty. That's not a hobby, that's an edge." },
  100: { subject: "100 deals analyzed on Realist.ca", body: "One hundred deal analyses. Elite territory. The platform has learned from your inputs, and so have you. This is the kind of volume that separates operators from observers." },
  250: { subject: "250 deals — Realist power user", body: "Two hundred and fifty analyses. You're one of the most active underwriters on the platform. Your data is literally training the market benchmarks other investors see." },
  500: { subject: "500 deals on Realist.ca — hall of fame", body: "Five hundred. There are maybe a handful of people on the platform at this number. You're not just using realist.ca — you're shaping it." },
};

/**
 * Check if userId has crossed a milestone with their latest analysis
 * and queue a milestone email if so. Call after every new analysis is saved.
 */
export async function queueMilestoneNotification(userId: string): Promise<boolean> {
  if (!(await recipientAllows(userId, "community"))) return false;

  const [countRow] = await db
    .select({ total: count() })
    .from(propertyAnalyses)
    .where(and(eq(propertyAnalyses.userId, userId), eq(propertyAnalyses.isDeleted, false)));

  const total = Number(countRow?.total ?? 0);
  const milestone = MILESTONES.find(m => m === total);
  if (!milestone) return false;

  const copy = MILESTONE_COPY[milestone];
  if (!copy) return false;

  const recipient = await getRecipient(userId);
  if (!recipient?.email) return false;

  // Unified governor: this is now the SINGLE milestone producer (the duplicate
  // deal-analyzer sweep in retentionEmails.sweepMilestones was disabled in the
  // email-governor consolidation). Gate it through the shared rolling cap +
  // community preference + CASL consent. The per-milestone dedupeKey preserves
  // one-email-per-milestone; the governor adds the global cap.
  const milestoneGate = await governMarketingSend({
    userId,
    stream: "community",
    emailType: "milestone_reached",
    dedupeKey: `milestone_reached:${userId}:${milestone}`,
  });
  if (!milestoneGate.ok) return false;

  const ctaUrl = `https://realist.ca/tools/cap-rates?source=milestone-email`;
  const emailBody = buildEmailBody(recipient.firstName || "there", [copy.body, "", `Keep going: ${ctaUrl}`]);
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;background:#fff;">
      <div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:24px;border-radius:8px 8px 0 0;">
        <p style="margin:0;font-size:11px;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;">Realist.ca</p>
        <h2 style="margin:4px 0 0;font-size:20px;color:#fff;font-weight:700;">${milestone} deals analyzed</h2>
      </div>
      <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;">
        <p style="margin:0 0 16px;font-size:15px;color:#111827;">Hey ${recipient.firstName || "there"},</p>
        <div style="background:linear-gradient(135deg,#fef3c7,#fde68a);border:1px solid #f59e0b;border-radius:8px;padding:16px;margin:0 0 20px;text-align:center;">
          <p style="margin:0;font-size:36px;font-weight:800;color:#92400e;">${milestone}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#78350f;font-weight:600;">deals analyzed on Realist.ca</p>
        </div>
        <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">${copy.body}</p>
        <div style="text-align:center;">
          <a href="${ctaUrl}" style="display:inline-block;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">
            Analyze Another Deal
          </a>
        </div>
      </div>
      <div style="padding:12px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;background:#f9fafb;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9ca3af;">Realist.ca — Canada's Real Estate Deal Analyzer</p>
      </div>
    </div>
  `;

  const dedupeKey = `milestone_reached:${userId}:${milestone}`;

  await enqueueForRecipients({
    eventType: "milestone_reached",
    rawPayload: { milestone, totalAnalyses: total },
    recipients: [{
      userId,
      payload: buildPayload({
        recipient,
        eventType: "milestone_reached",
        reasonText: `You've analyzed ${milestone} deals on Realist.ca.`,
        ctaLabel: "Analyze another deal",
        ctaUrl,
        subjectLine: copy.subject,
        previewText: copy.body.slice(0, 90),
        ghlTags: ["realist-user", "milestone", `milestone-${milestone}`],
        leadScoreDelta: milestone >= 50 ? 10 : milestone >= 10 ? 6 : 3,
        emailHtml: html,
      }),
      dedupeKey,
    }],
  });

  return true;
}

// ---------------------------------------------------------------------------
// Field-note vote notifications
// ---------------------------------------------------------------------------

/**
 * Notify a field-note author when the note's NET score crosses a threshold
 * (first upvote, +5, +10, or first downvote). Milestone detection happens at
 * the vote endpoint via decideNoteVoteMilestone; this function handles
 * consent, batching, and delivery.
 *
 * Email-first by design: there is no user-facing in-app notification surface
 * on this branch, so this rides the existing notification queue (GHL email
 * pipeline). Batched to max ONE email per note per UTC day — the dedupe key
 * intentionally omits the milestone, and the notification_queue unique index
 * drops later inserts (createNotificationQueueItem is onConflictDoNothing).
 * Consent-gated by notificationPreferences.communityAlertsEnabled (plus the
 * productUpdatesEnabled kill-switch).
 */
export async function queueFieldNoteVoteNotification(params: {
  note: ExpertFieldNote;
  milestone: NoteVoteMilestone;
  newScore: number;
}): Promise<boolean> {
  const { note, milestone, newScore } = params;
  if (!(await recipientAllows(note.userId, "community"))) return false;

  const recipient = await getRecipient(note.userId);
  if (!recipient?.email) return false;

  // Unified governor: rolling marketing cap + community preference toggle +
  // CASL consent, on top of the recipientAllows() check above. The per-note
  // dedupeKey (max one email per note per UTC day) is preserved as the
  // governor's dedupe key, so a note-vote email consumes one shared cap slot
  // and won't fire when the user's weekly marketing quota is spent.
  const voteGate = await governMarketingSend({
    userId: note.userId,
    stream: "community",
    emailType: "note_vote_update",
    dedupeKey: noteVoteDedupeKey(note.id),
  });
  if (!voteGate.ok) return false;

  // Best-effort listing label enrichment (city from the DDF snapshot).
  let city: string | null = null;
  try {
    const [snapshot] = await db
      .select({ city: ddfListingSnapshots.city })
      .from(ddfListingSnapshots)
      .where(eq(ddfListingSnapshots.mlsNumber, note.listingMlsNumber))
      .orderBy(desc(ddfListingSnapshots.capturedAt))
      .limit(1);
    city = snapshot?.city || null;
  } catch {
    city = null;
  }
  const listingLabel = city ? `MLS ${note.listingMlsNumber} (${city})` : `MLS ${note.listingMlsNumber}`;

  const copy = buildNoteVoteCopy({
    milestone,
    score: newScore,
    listingLabel,
    noteExcerpt: noteExcerpt(note.body),
  });
  const ctaUrl = `https://realist.ca/listings/${encodeURIComponent(note.listingMlsNumber)}?source=note-vote-email#field-notes`;

  await enqueueForRecipients({
    eventType: "note_vote_update",
    listingMlsNumber: note.listingMlsNumber,
    city,
    rawPayload: { fieldNoteId: note.id, milestone, score: newScore },
    recipients: [{
      userId: note.userId,
      payload: buildPayload({
        recipient,
        eventType: "note_vote_update",
        reasonText: copy.reasonText,
        ctaLabel: "See your note on the listing",
        ctaUrl,
        subjectLine: copy.subjectLine,
        previewText: copy.previewText,
        listingMlsNumber: note.listingMlsNumber,
        listingCity: city,
        ghlTags: ["realist-user", "field-note", `note-vote-${milestone}`],
        leadScoreDelta: milestone === "first_downvote" ? 0 : 2,
      }),
      dedupeKey: noteVoteDedupeKey(note.id),
    }],
  });

  return true;
}

/**
 * FN-3: tell a Power Team pro a lead just landed in their CRM from one of
 * their field notes. Transactional like the comment notifications above —
 * user-directed, so it gets the central unsubscribe/CASL gate (inside
 * enqueueForRecipients) and the community preference toggle, but NOT the
 * rolling weekly marketing cap: a pro must not miss a lead because a digest
 * already spent their quota. lead_cta_enabled on the profile is the explicit
 * opt-in for receiving these. Deduped per note+lead-email per UTC day so a
 * double-submit can't double-email.
 */
export async function queueFieldNoteLeadNotification(params: {
  note: ExpertFieldNote;
  leadName: string;
  leadEmail: string;
  message?: string | null;
  crmContactId: string;
}): Promise<boolean> {
  const { note, leadName, leadEmail, message, crmContactId } = params;
  if (!(await recipientAllows(note.userId, "community"))) return false;

  const recipient = await getRecipient(note.userId);
  if (!recipient?.email) return false;

  // Best-effort listing label enrichment (city from the DDF snapshot).
  let city: string | null = null;
  try {
    const [snapshot] = await db
      .select({ city: ddfListingSnapshots.city })
      .from(ddfListingSnapshots)
      .where(eq(ddfListingSnapshots.mlsNumber, note.listingMlsNumber))
      .orderBy(desc(ddfListingSnapshots.capturedAt))
      .limit(1);
    city = snapshot?.city || null;
  } catch {
    city = null;
  }
  const listingLabel = city ? `MLS ${note.listingMlsNumber} (${city})` : `MLS ${note.listingMlsNumber}`;

  const copy = buildFieldNoteLeadCopy({ leadName, listingLabel, message });
  const ctaUrl = `https://realist.ca/crm/contacts/${encodeURIComponent(crmContactId)}?source=field-note-lead-email`;
  const day = new Date().toISOString().slice(0, 10);
  const dedupeKey = `field_note_lead:${note.id}:${leadEmail.toLowerCase()}:${day}`;

  await enqueueForRecipients({
    eventType: "field_note_lead",
    listingMlsNumber: note.listingMlsNumber,
    city,
    rawPayload: { fieldNoteId: note.id, crmContactId, listingMlsNumber: note.listingMlsNumber },
    recipients: [{
      userId: note.userId,
      payload: buildPayload({
        recipient,
        eventType: "field_note_lead",
        reasonText: copy.reasonText,
        ctaLabel: "Open the lead in your CRM",
        ctaUrl,
        subjectLine: copy.subjectLine,
        previewText: copy.previewText,
        listingMlsNumber: note.listingMlsNumber,
        listingCity: city,
        ghlTags: ["realist-user", "power-team", "field-note-lead"],
        leadScoreDelta: 0,
      }),
      dedupeKey,
    }],
  });

  return true;
}
