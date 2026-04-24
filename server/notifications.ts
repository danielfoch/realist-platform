import { desc, eq } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { analyses, listingAnalysisAggregates, type DiscoverySignal, type ListingAnalysisAggregate, type ListingComment, type PropertyAnalysis, type SavedDeal } from "@shared/schema";
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
  eventId: string;
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
    eventId: input.eventId,
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
  const listingRecipientIds = [...new Set(
    watchers
      .filter((watcher) => watcher.userId !== params.actorUserId && watcher.watchAnalysisUpdates)
      .map((watcher) => watcher.userId),
  )];

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
  for (const userId of [...new Set(
    watchers
      .filter((watcher) => watcher.userId !== params.actorUserId && watcher.watchConsensusUpdates)
      .map((watcher) => watcher.userId),
  )]) {
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
  const watcherIds = [...new Set(
    watchers
      .filter((watcher) => watcher.userId !== params.actorUserId && watcher.watchCommentUpdates)
      .map((watcher) => watcher.userId),
  )];

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
  for (const userId of [...new Set(
    watchers
      .filter((watcher) => watcher.userId !== params.actorUserId && watcher.watchConsensusUpdates)
      .map((watcher) => watcher.userId),
  )]) {
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
