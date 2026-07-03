/**
 * Live Deal Room — weekly one-to-many deal-review call (Mondays 11:30am ET,
 * Google Meet). Registration is owned on Realist rails; Skool stays the
 * community home. Replays are hosted free on realist.ca behind a lightweight
 * email capture (no account, no Skool signup).
 *
 * Public:
 *   GET  /api/deal-room/next                 next scheduled session + count
 *   POST /api/deal-room/register             register (email is the gate)
 *   GET  /api/deal-room/replays              completed sessions (no embed URL)
 *   POST /api/deal-room/replays/:id/unlock   email capture → embed URL + email
 * Admin:
 *   GET   /api/deal-room/sessions            list with registration counts
 *   POST  /api/deal-room/sessions            create (defaults next Mon 11:30 ET)
 *   PATCH /api/deal-room/sessions/:id        update / attach replay assets
 *   POST  /api/deal-room/sessions/:id/send-replay   blast replay email
 * Cron (x-api-key: DEAL_DESK_API_KEY, mirrors deal-desk sweep):
 *   POST /api/deal-room/sweep                reminders + auto-schedule + ingest
 */

import type { Express, Request, Response } from "express";
import "express-session";
import { and, asc, desc, eq, gte, isNull, lte, sql as dsql } from "drizzle-orm";
import { db } from "./db";
import { isAdmin } from "./auth";
import { logUserActivity } from "./userActivity";
import {
  dealRoomSessions,
  dealRoomRegistrations,
  dealRoomRegisterRequestSchema,
  dealRoomReplayUnlockSchema,
  DEAL_ROOM_SESSION_STATUSES,
} from "@shared/schema";
import { upsertPlatformCrmContact } from "./crmIngest";
import {
  sendDealRoomConfirmation,
  sendDealRoomReminder,
  sendDealRoomReplay,
} from "./dealRoomEmails";
import { ingestDealRoomRecordings } from "./dealRoomIngest";

// ---------------------------------------------------------------------------
// Scheduling — next Monday 11:30 America/Toronto, DST-safe.

function torontoOffsetMinutes(utcDate: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(dtf.formatToParts(utcDate).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour) % 24, Number(parts.minute), Number(parts.second),
  );
  return (asUtc - utcDate.getTime()) / 60_000;
}

export function nextDealRoomSlotUtc(from: Date = new Date()): Date {
  for (let i = 0; i <= 7; i++) {
    const candidate = new Date(from.getTime() + i * 86_400_000);
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Toronto",
        weekday: "short", year: "numeric", month: "2-digit", day: "2-digit",
      }).formatToParts(candidate).map((p) => [p.type, p.value]),
    );
    if (parts.weekday !== "Mon") continue;
    // 11:30 Toronto wall time → UTC (offset sampled near the target instant)
    const guess = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 16, 30));
    const offset = torontoOffsetMinutes(guess);
    const utc = new Date(
      Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 11, 30) - offset * 60_000,
    );
    if (utc.getTime() > from.getTime()) return utc;
  }
  return new Date(from.getTime() + 7 * 86_400_000); // unreachable fallback
}

async function getNextSession() {
  const [session] = await db
    .select()
    .from(dealRoomSessions)
    .where(and(
      eq(dealRoomSessions.status, "scheduled"),
      // Keep the session addressable while it's live (90-minute grace).
      gte(dealRoomSessions.scheduledAt, new Date(Date.now() - 90 * 60_000)),
    ))
    .orderBy(asc(dealRoomSessions.scheduledAt))
    .limit(1);
  return session ?? null;
}

/** Ensure a session exists for the coming Monday; used by sweep + register. */
export async function ensureUpcomingSession(): Promise<typeof dealRoomSessions.$inferSelect> {
  const existing = await getNextSession();
  if (existing) return existing;
  const [created] = await db
    .insert(dealRoomSessions)
    .values({
      scheduledAt: nextDealRoomSlotUtc(),
      meetUrl: process.env.DEAL_ROOM_MEET_URL ?? null,
    })
    .returning();
  console.log(`[deal-room] auto-scheduled session ${created.id} for ${created.scheduledAt.toISOString()}`);
  return created;
}

function requireSweepKey(req: Request, res: Response): boolean {
  const apiKey = req.headers["x-api-key"] || req.query.api_key;
  const configured = process.env.DEAL_DESK_API_KEY;
  if (!configured || apiKey !== configured) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------

export function registerDealRoomRoutes(app: Express): void {
  /** Next upcoming session — public, powers the /deal-room hero. */
  app.get("/api/deal-room/next", async (_req: Request, res: Response) => {
    try {
      const session = await ensureUpcomingSession();
      const [{ count }] = await db
        .select({ count: dsql<number>`count(*)::int` })
        .from(dealRoomRegistrations)
        .where(eq(dealRoomRegistrations.sessionId, session.id));
      res.json({
        id: session.id,
        title: session.title,
        scheduledAt: session.scheduledAt,
        durationMinutes: session.durationMinutes,
        registrationCount: count,
      });
    } catch (err) {
      console.error("[deal-room] next failed:", err instanceof Error ? err.message : err);
      res.status(500).json({ success: false, error: "Failed to load the next session" });
    }
  });

  /**
   * Register — public, idempotent per (session, email). Email is the gate;
   * phone + SMS consent are optional. Creates the CRM contact and sends the
   * confirmation best-effort.
   */
  app.post("/api/deal-room/register", async (req: Request, res: Response) => {
    try {
      const parsed = dealRoomRegisterRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: "Invalid request", details: parsed.error.issues });
        return;
      }
      const input = parsed.data;
      const userId = req.session?.userId ?? null;

      const session = input.sessionId
        ? (await db.select().from(dealRoomSessions).where(eq(dealRoomSessions.id, input.sessionId)).limit(1))[0]
        : await ensureUpcomingSession();
      if (!session || session.status === "canceled") {
        res.status(404).json({ success: false, error: "Session not found" });
        return;
      }

      const email = input.email.toLowerCase();
      const [registration] = await db
        .insert(dealRoomRegistrations)
        .values({
          sessionId: session.id,
          userId,
          name: input.name,
          email,
          phone: input.phone ?? null,
          smsConsent: input.smsConsent ?? false,
          recordingConsentAt: new Date(), // disclosure shown on the form
          source: input.source ?? "deal-room",
        })
        .onConflictDoNothing()
        .returning();
      const alreadyRegistered = !registration;

      if (!alreadyRegistered) {
        const crmContactId = await upsertPlatformCrmContact({
          name: input.name,
          email,
          phone: input.phone ?? null,
          linkedUserId: userId,
          source: "deal_room",
          sourceDetail: input.source ?? "deal-room",
          consentEmail: true,
          consentSms: input.smsConsent ?? false,
          activityBody: `Registered for ${session.title} (${session.scheduledAt.toISOString().slice(0, 10)}).`,
          activityMetadata: { dealRoomSessionId: session.id, registrationSource: input.source ?? "deal-room" },
        });
        if (crmContactId) {
          await db
            .update(dealRoomRegistrations)
            .set({ crmContactId })
            .where(eq(dealRoomRegistrations.id, registration.id));
        }
        sendDealRoomConfirmation({ to: email, name: input.name, session })
          .catch((err) => console.error("[deal-room] confirmation email failed:", err?.message ?? err));
        if (userId) {
          logUserActivity(req, {
            userId,
            eventName: "deal_room_registered",
            sourcePage: input.source ?? "deal-room",
            metadata: { sessionId: session.id },
          }).catch(() => {});
        }
      }

      res.status(alreadyRegistered ? 200 : 201).json({
        success: true,
        alreadyRegistered,
        session: { id: session.id, title: session.title, scheduledAt: session.scheduledAt, meetUrl: session.meetUrl },
      });
    } catch (err) {
      console.error("[deal-room] register failed:", err instanceof Error ? err.message : err);
      res.status(500).json({ success: false, error: "Failed to register — please try again." });
    }
  });

  /**
   * Replay library — public. Embed URLs are intentionally omitted; the
   * unlock endpoint below trades an email for the link (free, no account).
   */
  app.get("/api/deal-room/replays", async (_req: Request, res: Response) => {
    try {
      const sessions = await db
        .select({
          id: dealRoomSessions.id,
          title: dealRoomSessions.title,
          scheduledAt: dealRoomSessions.scheduledAt,
          aiSummary: dealRoomSessions.aiSummary,
          aiChapters: dealRoomSessions.aiChapters,
        })
        .from(dealRoomSessions)
        .where(and(
          eq(dealRoomSessions.status, "completed"),
          dsql`${dealRoomSessions.replayEmbedUrl} IS NOT NULL`,
        ))
        .orderBy(desc(dealRoomSessions.scheduledAt))
        .limit(24);
      res.json(sessions);
    } catch (err) {
      console.error("[deal-room] replays failed:", err instanceof Error ? err.message : err);
      res.status(500).json({ success: false, error: "Failed to load replays" });
    }
  });

  /** Email capture → replay embed URL + replay email. */
  app.post("/api/deal-room/replays/:id/unlock", async (req: Request, res: Response) => {
    try {
      const parsed = dealRoomReplayUnlockSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: "Invalid request", details: parsed.error.issues });
        return;
      }
      const [session] = await db
        .select()
        .from(dealRoomSessions)
        .where(eq(dealRoomSessions.id, req.params.id))
        .limit(1);
      if (!session?.replayEmbedUrl) {
        res.status(404).json({ success: false, error: "Replay not found" });
        return;
      }

      const email = parsed.data.email.toLowerCase();
      const name = parsed.data.name?.trim() || email.split("@")[0];

      await db
        .insert(dealRoomRegistrations)
        .values({
          sessionId: session.id,
          userId: req.session?.userId ?? null,
          name,
          email,
          source: "replay",
          watchedReplayAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [dealRoomRegistrations.sessionId, dealRoomRegistrations.email],
          set: { watchedReplayAt: new Date() },
        });

      await upsertPlatformCrmContact({
        name,
        email,
        source: "deal_room_replay",
        sourceDetail: session.title,
        consentEmail: true,
        activityBody: `Watched the ${session.title} replay (${session.scheduledAt.toISOString().slice(0, 10)}).`,
        activityMetadata: { dealRoomSessionId: session.id },
      });
      sendDealRoomReplay({ to: email, name, session })
        .catch((err) => console.error("[deal-room] replay email failed:", err?.message ?? err));

      res.json({ success: true, embedUrl: session.replayEmbedUrl });
    } catch (err) {
      console.error("[deal-room] unlock failed:", err instanceof Error ? err.message : err);
      res.status(500).json({ success: false, error: "Failed to unlock replay" });
    }
  });

  // -------------------------------------------------------------------------
  // Admin

  app.get("/api/deal-room/sessions", isAdmin, async (_req: Request, res: Response) => {
    try {
      const sessions = await db
        .select({
          session: dealRoomSessions,
          registrationCount: dsql<number>`(
            SELECT count(*)::int FROM deal_room_registrations r
            WHERE r.session_id = ${dealRoomSessions.id}
          )`,
        })
        .from(dealRoomSessions)
        .orderBy(desc(dealRoomSessions.scheduledAt))
        .limit(52);
      res.json(sessions);
    } catch (err) {
      console.error("[deal-room] sessions list failed:", err instanceof Error ? err.message : err);
      res.status(500).json({ success: false, error: "Failed to list sessions" });
    }
  });

  app.post("/api/deal-room/sessions", isAdmin, async (req: Request, res: Response) => {
    try {
      const { title, scheduledAt, meetUrl, durationMinutes } = (req.body ?? {}) as Record<string, unknown>;
      const [created] = await db
        .insert(dealRoomSessions)
        .values({
          title: typeof title === "string" && title.trim() ? title.trim() : undefined,
          scheduledAt: typeof scheduledAt === "string" ? new Date(scheduledAt) : nextDealRoomSlotUtc(),
          meetUrl: typeof meetUrl === "string" ? meetUrl : process.env.DEAL_ROOM_MEET_URL ?? null,
          durationMinutes: typeof durationMinutes === "number" ? durationMinutes : undefined,
        })
        .returning();
      res.status(201).json({ success: true, session: created });
    } catch (err) {
      console.error("[deal-room] create session failed:", err instanceof Error ? err.message : err);
      res.status(500).json({ success: false, error: "Failed to create session" });
    }
  });

  app.patch("/api/deal-room/sessions/:id", isAdmin, async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (body.status !== undefined && !DEAL_ROOM_SESSION_STATUSES.includes(body.status as never)) {
        res.status(400).json({ success: false, error: `Invalid status — expected one of: ${DEAL_ROOM_SESSION_STATUSES.join(", ")}` });
        return;
      }
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      for (const key of ["title", "meetUrl", "status", "recordingUrl", "replayEmbedUrl", "aiSummary", "transcriptText"] as const) {
        if (typeof body[key] === "string") patch[key] = body[key];
      }
      if (typeof body.scheduledAt === "string") patch.scheduledAt = new Date(body.scheduledAt);
      if (Array.isArray(body.aiChapters)) patch.aiChapters = body.aiChapters;

      const [updated] = await db
        .update(dealRoomSessions)
        .set(patch)
        .where(eq(dealRoomSessions.id, req.params.id))
        .returning();
      if (!updated) {
        res.status(404).json({ success: false, error: "Session not found" });
        return;
      }
      res.json({ success: true, session: updated });
    } catch (err) {
      console.error("[deal-room] update session failed:", err instanceof Error ? err.message : err);
      res.status(500).json({ success: false, error: "Failed to update session" });
    }
  });

  /** Blast the replay email to registrants who have not received it. */
  app.post("/api/deal-room/sessions/:id/send-replay", isAdmin, async (req: Request, res: Response) => {
    try {
      const result = await sendReplayBlast(req.params.id);
      if ("error" in result) {
        res.status(result.status).json({ success: false, error: result.error });
        return;
      }
      res.json({ success: true, ...result });
    } catch (err) {
      console.error("[deal-room] send-replay failed:", err instanceof Error ? err.message : err);
      res.status(500).json({ success: false, error: "Failed to send replay emails" });
    }
  });

  // -------------------------------------------------------------------------
  // Cron sweep — reminders, recurring auto-schedule, recording ingest.
  // Schedule: every 30 minutes. Idempotent.

  app.post("/api/deal-room/sweep", async (req: Request, res: Response) => {
    if (!requireSweepKey(req, res)) return;
    const report: Record<string, unknown> = {};
    try {
      // 1. Keep a session on the calendar (recurring Mondays).
      const next = await ensureUpcomingSession();
      report.nextSession = { id: next.id, scheduledAt: next.scheduledAt };

      // 2. 24-hour reminders (single send per registration).
      const dueSessions = await db
        .select()
        .from(dealRoomSessions)
        .where(and(
          eq(dealRoomSessions.status, "scheduled"),
          gte(dealRoomSessions.scheduledAt, new Date()),
          lte(dealRoomSessions.scheduledAt, new Date(Date.now() + 24 * 3_600_000)),
        ));
      let reminded = 0;
      for (const session of dueSessions) {
        const pending = await db
          .select()
          .from(dealRoomRegistrations)
          .where(and(
            eq(dealRoomRegistrations.sessionId, session.id),
            isNull(dealRoomRegistrations.remindedAt),
          ))
          .limit(500);
        for (const reg of pending) {
          try {
            await sendDealRoomReminder({ to: reg.email, name: reg.name, session });
            await db
              .update(dealRoomRegistrations)
              .set({ remindedAt: new Date() })
              .where(eq(dealRoomRegistrations.id, reg.id));
            reminded++;
          } catch (err) {
            console.error(`[deal-room] reminder to ${reg.email} failed:`, err instanceof Error ? err.message : err);
          }
        }
      }
      report.remindersSent = reminded;

      // 3. Ingest recordings for sessions that have ended (env-gated).
      report.ingest = await ingestDealRoomRecordings().catch((err) => ({
        error: err instanceof Error ? err.message : String(err),
      }));

      // 4. Auto-send replay emails when configured.
      if (process.env.DEAL_ROOM_AUTO_SEND_REPLAY === "true") {
        const readySessions = await db
          .select()
          .from(dealRoomSessions)
          .where(and(
            eq(dealRoomSessions.status, "completed"),
            isNull(dealRoomSessions.replayEmailedAt),
            dsql`${dealRoomSessions.replayEmbedUrl} IS NOT NULL`,
          ))
          .limit(4);
        const blasts: unknown[] = [];
        for (const session of readySessions) {
          blasts.push({ sessionId: session.id, ...(await sendReplayBlast(session.id)) });
        }
        report.replayBlasts = blasts;
      }

      res.json({ success: true, ...report });
    } catch (err) {
      console.error("[deal-room] sweep failed:", err instanceof Error ? err.message : err);
      res.status(500).json({ success: false, error: "Sweep failed", partial: report });
    }
  });
}

async function sendReplayBlast(
  sessionId: string,
): Promise<{ sent: number; skipped: number } | { error: string; status: number }> {
  const [session] = await db
    .select()
    .from(dealRoomSessions)
    .where(eq(dealRoomSessions.id, sessionId))
    .limit(1);
  if (!session) return { error: "Session not found", status: 404 };
  if (!session.replayEmbedUrl && !session.recordingUrl) {
    return { error: "Session has no replay attached yet", status: 400 };
  }

  const pending = await db
    .select()
    .from(dealRoomRegistrations)
    .where(and(
      eq(dealRoomRegistrations.sessionId, session.id),
      isNull(dealRoomRegistrations.replayEmailedAt),
    ))
    .limit(1000);

  let sent = 0;
  let skipped = 0;
  for (const reg of pending) {
    try {
      await sendDealRoomReplay({ to: reg.email, name: reg.name, session });
      await db
        .update(dealRoomRegistrations)
        .set({ replayEmailedAt: new Date() })
        .where(eq(dealRoomRegistrations.id, reg.id));
      sent++;
    } catch (err) {
      skipped++;
      console.error(`[deal-room] replay email to ${reg.email} failed:`, err instanceof Error ? err.message : err);
    }
  }
  await db
    .update(dealRoomSessions)
    .set({ replayEmailedAt: new Date(), updatedAt: new Date() })
    .where(eq(dealRoomSessions.id, session.id));
  return { sent, skipped };
}
