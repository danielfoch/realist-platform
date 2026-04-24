import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import {
  analyses,
  discoverySignals,
  listingAnalysisAggregates,
  listingWatchers,
  notificationQueue,
  type DiscoverySignal,
  type ListingAnalysisAggregate,
  type ListingComment,
  type PropertyAnalysis,
  type SavedDeal,
  type UsListing,
} from "@shared/schema";
import { users } from "@shared/models/auth";

type WatchedListingSignal = {
  listingId?: string;
  address?: string;
  city?: string;
};

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
  | "daily_digest_ready";

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
  reasonText: string;
  ctaLabel: string;
  ctaUrl: string;
  subjectLine: string;
  previewText: string;
  emailBody: string;
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
    ghlTags: input.ghlTags,
    leadScoreDelta: input.leadScoreDelta,
  };
}

export async function upsertWatcherFromSavedDeal(userId: string, deal: SavedDeal): Promise<void> {
  if (!deal.mlsNumber) return;
  await storage.upsertListingWatcher({
    userId,
    listingMlsNumber: deal.mlsNumber,
    sourceType: "saved_deal",
    sourceId: deal.id,
    lastSeenAt: new Date(),
  });
}

export async function syncWatchersFromDiscoverySignals(params: {
  userId: string;
  savedListings: WatchedListingSignal[];
  recentViewedListings: WatchedListingSignal[];
}): Promise<void> {
  const tasks = [...params.savedListings.map((signal) => ({
    signal,
    sourceType: "saved_listing",
    sourceId: signal.listingId || signal.address || null,
  })), ...params.recentViewedListings.map((signal) => ({
    signal,
    sourceType: "view",
    sourceId: signal.listingId || signal.address || null,
  }))];

  await Promise.all(tasks.map(async ({ signal, sourceType, sourceId }) => {
    if (!signal.listingId) return;
    await storage.upsertListingWatcher({
      userId: params.userId,
      listingMlsNumber: signal.listingId,
      sourceType,
      sourceId,
      lastSeenAt: new Date(),
    });
  }));
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
  const event = await storage.createNotificationEvent({
    eventType: args.eventType,
    listingMlsNumber: args.listingMlsNumber || null,
    analysisId: args.analysisId || null,
    commentId: args.commentId || null,
    city: args.city || null,
    payloadJson: args.rawPayload,
  });

  await Promise.all(args.recipients.map(async (recipient) => {
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
  const webhookUrl = process.env.GHL_WEBHOOK_URL;
  if (!webhookUrl) {
    return { sent: 0, failed: 0, skipped: 0 };
  }

  const queue = await storage.getPendingNotificationQueue(limit);
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const item of queue) {
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
