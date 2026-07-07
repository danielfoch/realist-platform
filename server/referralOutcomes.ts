import crypto from "crypto";
import type { Express, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { appBaseUrl } from "./auth";
import {
  referralOutcomes,
  realtorIntroductions,
  realtorLeadNotifications,
  type ReferralOutcome,
  type RealtorIntroduction,
  type RealtorLeadNotification,
} from "@shared/schema";

export const REFERRAL_OUTCOME_STATUSES = [
  "pending",
  "responded",
  "showing_booked",
  "offer_submitted",
  "closed",
  "lost",
] as const;
export type ReferralOutcomeStatus = (typeof REFERRAL_OUTCOME_STATUSES)[number];

export const REFERRAL_OUTCOME_ACTIONS = [
  "responded",
  "showing_booked",
  "offer_submitted",
  "closed",
  "lost",
] as const;
export type ReferralOutcomeAction = (typeof REFERRAL_OUTCOME_ACTIONS)[number];

const TERMINAL_STATUSES = new Set<ReferralOutcomeStatus>(["closed", "lost"]);
const STATUS_RANK: Record<ReferralOutcomeStatus, number> = {
  pending: 0,
  responded: 1,
  showing_booked: 2,
  offer_submitted: 3,
  closed: 4,
  lost: 4,
};

const updateReferralOutcomeSchema = z.object({
  action: z.enum(REFERRAL_OUTCOME_ACTIONS),
  closePrice: z.coerce.number().finite().nonnegative().optional(),
  gci: z.coerce.number().finite().positive().optional(),
  lostReason: z.string().trim().min(1).max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
  reportedBy: z.string().trim().max(160).optional(),
}).strict();

export function isReferralOutcomeStatus(value: unknown): value is ReferralOutcomeStatus {
  return typeof value === "string" && (REFERRAL_OUTCOME_STATUSES as readonly string[]).includes(value);
}

export function isReferralOutcomeAction(value: unknown): value is ReferralOutcomeAction {
  return typeof value === "string" && (REFERRAL_OUTCOME_ACTIONS as readonly string[]).includes(value);
}

export function computeReferralFee(gci: number, referralFeePercent = 25): number {
  if (!Number.isFinite(gci) || gci < 0) throw new Error("Invalid GCI");
  if (!Number.isFinite(referralFeePercent) || referralFeePercent < 0 || referralFeePercent > 100) {
    throw new Error("Invalid referral fee percent");
  }
  return Math.round(gci * referralFeePercent) / 100;
}

export function validateOutcomeTransition(input: {
  currentStatus: ReferralOutcomeStatus;
  action: ReferralOutcomeAction;
  gci?: number;
  lostReason?: string | null;
}): { ok: true; nextStatus: ReferralOutcomeStatus } | { ok: false; error: string } {
  const { currentStatus, action } = input;
  if (TERMINAL_STATUSES.has(currentStatus)) {
    return { ok: false, error: "This outcome is already terminal" };
  }

  const nextStatus = action;
  if (STATUS_RANK[nextStatus] < STATUS_RANK[currentStatus]) {
    return { ok: false, error: "Referral outcomes cannot move backward" };
  }
  if (nextStatus === "lost" && !input.lostReason?.trim()) {
    return { ok: false, error: "lostReason is required when marking a referral lost" };
  }
  if (nextStatus === "closed" && (!Number.isFinite(input.gci) || Number(input.gci) <= 0)) {
    return { ok: false, error: "gci greater than 0 is required when marking a referral closed" };
  }

  return { ok: true, nextStatus };
}

function generateOutcomeToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

function moneyToDb(value: number | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value)) return null;
  return value.toFixed(2);
}

function dbMoneyToNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export function buildReferralOutcomeUrl(token: string, baseUrl = appBaseUrl()): string {
  return `${baseUrl.replace(/\/$/, "")}/api/referral-outcome/${token}`;
}

type OutcomeJoinedRow = {
  outcome: ReferralOutcome;
  notification: RealtorLeadNotification | null;
  introduction: RealtorIntroduction | null;
};

function toSafeOutcomeResponse(row: OutcomeJoinedRow) {
  const { outcome, notification, introduction } = row;
  return {
    success: true,
    outcomeUrl: buildReferralOutcomeUrl(outcome.token),
    outcome: {
      status: outcome.status,
      lastAction: outcome.lastAction,
      referralFeePercent: outcome.referralFeePercent,
      closePrice: dbMoneyToNumber(outcome.closePrice),
      gci: dbMoneyToNumber(outcome.gci),
      referralFeeAmount: dbMoneyToNumber(outcome.referralFeeAmount),
      lostReason: outcome.lostReason,
      notes: outcome.notes,
      reportedBy: outcome.reportedBy,
      reportedAt: outcome.reportedAt,
      createdAt: outcome.createdAt,
      updatedAt: outcome.updatedAt,
      context: {
        dealAddress: notification?.dealAddress ?? null,
        dealCity: notification?.dealCity ?? null,
        dealRegion: notification?.dealRegion ?? null,
        dealStrategy: notification?.dealStrategy ?? null,
        realtorName: introduction?.realtorName ?? null,
        realtorCompany: introduction?.realtorCompany ?? null,
        introSentAt: introduction?.sentAt ?? null,
      },
    },
    allowedActions: REFERRAL_OUTCOME_ACTIONS,
  };
}

async function getOutcomeByToken(token: string): Promise<OutcomeJoinedRow | null> {
  const [row] = await db.select({
    outcome: referralOutcomes,
    notification: realtorLeadNotifications,
    introduction: realtorIntroductions,
  })
    .from(referralOutcomes)
    .leftJoin(realtorLeadNotifications, eq(referralOutcomes.notificationId, realtorLeadNotifications.id))
    .leftJoin(realtorIntroductions, eq(referralOutcomes.introductionId, realtorIntroductions.id))
    .where(eq(referralOutcomes.token, token))
    .limit(1);

  return row ?? null;
}

export async function createOrGetReferralOutcomeForIntroduction(input: {
  notification: RealtorLeadNotification;
  introduction: RealtorIntroduction;
  referralFeePercent?: number | null;
}): Promise<{ outcome: ReferralOutcome; outcomeToken: string; outcomeUrl: string; created: boolean }> {
  const [existing] = await db.select().from(referralOutcomes)
    .where(eq(referralOutcomes.notificationId, input.notification.id))
    .limit(1);
  if (existing) {
    return {
      outcome: existing,
      outcomeToken: existing.token,
      outcomeUrl: buildReferralOutcomeUrl(existing.token),
      created: false,
    };
  }

  const token = generateOutcomeToken();
  const [inserted] = await db.insert(referralOutcomes).values({
    token,
    notificationId: input.notification.id,
    introductionId: input.introduction.id,
    realtorUserId: input.notification.realtorUserId,
    realtorClaimId: input.notification.realtorClaimId,
    leadId: input.notification.leadId,
    analysisId: input.notification.analysisId ?? null,
    referralFeePercent: input.referralFeePercent ?? 25,
  }).onConflictDoNothing({
    target: referralOutcomes.notificationId,
  }).returning();

  const outcome = inserted ?? (await db.select().from(referralOutcomes)
    .where(eq(referralOutcomes.notificationId, input.notification.id))
    .limit(1))[0];

  if (!outcome) {
    throw new Error("Failed to create referral outcome");
  }

  return {
    outcome,
    outcomeToken: outcome.token,
    outcomeUrl: buildReferralOutcomeUrl(outcome.token),
    created: Boolean(inserted),
  };
}

export function registerReferralOutcomeRoutes(app: Express): void {
  app.get("/api/referral-outcome/:token", async (req: Request, res: Response) => {
    try {
      const row = await getOutcomeByToken(req.params.token);
      if (!row) {
        res.status(404).json({ success: false, error: "Referral outcome not found" });
        return;
      }
      res.json(toSafeOutcomeResponse(row));
    } catch (err) {
      console.error("[referral-outcomes] get failed:", err instanceof Error ? err.message : err);
      res.status(500).json({ success: false, error: "Failed to fetch referral outcome" });
    }
  });

  app.post("/api/referral-outcome/:token", async (req: Request, res: Response) => {
    try {
      const parsed = updateReferralOutcomeSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: "Invalid request", details: parsed.error.issues });
        return;
      }

      const row = await getOutcomeByToken(req.params.token);
      if (!row) {
        res.status(404).json({ success: false, error: "Referral outcome not found" });
        return;
      }

      const currentStatus = isReferralOutcomeStatus(row.outcome.status) ? row.outcome.status : "pending";
      const transition = validateOutcomeTransition({
        currentStatus,
        action: parsed.data.action,
        gci: parsed.data.gci,
        lostReason: parsed.data.lostReason,
      });
      if (!transition.ok) {
        res.status(400).json({ success: false, error: transition.error });
        return;
      }

      const referralFeeAmount = transition.nextStatus === "closed"
        ? computeReferralFee(parsed.data.gci!, row.outcome.referralFeePercent)
        : undefined;

      const [updated] = await db.update(referralOutcomes).set({
        status: transition.nextStatus,
        lastAction: parsed.data.action,
        closePrice: moneyToDb(parsed.data.closePrice),
        gci: moneyToDb(parsed.data.gci),
        referralFeeAmount: moneyToDb(referralFeeAmount),
        lostReason: parsed.data.lostReason ?? null,
        notes: parsed.data.notes ?? row.outcome.notes,
        reportedBy: parsed.data.reportedBy ?? row.outcome.reportedBy,
        reportedAt: new Date(),
        updatedAt: new Date(),
      }).where(and(
        eq(referralOutcomes.id, row.outcome.id),
        eq(referralOutcomes.token, req.params.token),
      )).returning();

      if (!updated) {
        res.status(409).json({ success: false, error: "Referral outcome update conflicted" });
        return;
      }

      res.json(toSafeOutcomeResponse({ ...row, outcome: updated }));
    } catch (err) {
      console.error("[referral-outcomes] update failed:", err instanceof Error ? err.message : err);
      res.status(500).json({ success: false, error: "Failed to update referral outcome" });
    }
  });
}
