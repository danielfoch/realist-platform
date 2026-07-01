/**
 * Events community layer — the meetup.com replacement pieces that sit on top
 * of the events growth engine:
 *
 * - Discussion threads on event pages (one nesting level, owner/admin
 *   moderation), logged to user_activity_events for the engagement dataset.
 * - The recurrence sweep: a daily job that clones an ended recurring event
 *   into its next occurrence (shared/eventRecurrence.ts does the date math),
 *   so recurring Realist meetups are always present without manual re-posting.
 */

import type { Express, Request, Response } from "express";
import "express-session";
import { z } from "zod";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "./db";
import { getSessionUser, isEventAdminRequest } from "./eventsModule";
import { logUserActivity } from "./userActivity";
import { realistEventComments, realistEvents, users } from "@shared/schema";
import { nextSpawnStart, occurrenceSlug, seriesBaseSlug } from "@shared/eventRecurrence";

const commentSchema = z.object({
  body: z.string().trim().min(1, "Say something first").max(2000, "Keep it under 2000 characters"),
  parentCommentId: z.string().optional().nullable(),
});

export function registerEventsCommunityRoutes(app: Express): void {
  // Public read: visible comments with author display names.
  app.get("/api/realist-events/:slug/comments", async (req: Request, res: Response) => {
    try {
      const [event] = await db
        .select({ id: realistEvents.id })
        .from(realistEvents)
        .where(eq(realistEvents.slug, req.params.slug))
        .limit(1);
      if (!event) return res.status(404).json({ error: "Event not found" });

      const rows = await db
        .select({
          id: realistEventComments.id,
          parentCommentId: realistEventComments.parentCommentId,
          body: realistEventComments.body,
          createdAt: realistEventComments.createdAt,
          userId: realistEventComments.userId,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(realistEventComments)
        .leftJoin(users, eq(realistEventComments.userId, users.id))
        .where(and(eq(realistEventComments.eventId, event.id), eq(realistEventComments.status, "visible")))
        .orderBy(asc(realistEventComments.createdAt));

      const sessionUser = await getSessionUser(req);
      res.json(
        rows.map((row) => ({
          id: row.id,
          parentCommentId: row.parentCommentId,
          body: row.body,
          createdAt: row.createdAt,
          authorName: `${row.firstName || ""} ${(row.lastName || "").charAt(0)}`.trim() || "Realist member",
          isMine: sessionUser?.id === row.userId,
        })),
      );
    } catch (error) {
      console.error("[events-community] list comments failed:", error);
      res.status(500).json({ error: "Failed to load discussion" });
    }
  });

  // Post a comment (any logged-in member; the login wall is the capture funnel).
  app.post("/api/realist-events/:slug/comments", async (req: Request, res: Response) => {
    try {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ error: "Create a free account to join the discussion" });

      const parsed = commentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid comment" });
      }

      const [event] = await db
        .select({ id: realistEvents.id, status: realistEvents.status, city: realistEvents.city })
        .from(realistEvents)
        .where(eq(realistEvents.slug, req.params.slug))
        .limit(1);
      if (!event || event.status !== "PUBLISHED") return res.status(404).json({ error: "Event not found" });

      if (parsed.data.parentCommentId) {
        const [parent] = await db
          .select({ id: realistEventComments.id, parentCommentId: realistEventComments.parentCommentId })
          .from(realistEventComments)
          .where(and(eq(realistEventComments.id, parsed.data.parentCommentId), eq(realistEventComments.eventId, event.id)))
          .limit(1);
        if (!parent) return res.status(400).json({ error: "Reply target not found" });
        if (parent.parentCommentId) return res.status(400).json({ error: "Replies go one level deep" });
      }

      const [comment] = await db
        .insert(realistEventComments)
        .values({
          eventId: event.id,
          userId: user.id,
          parentCommentId: parsed.data.parentCommentId || null,
          body: parsed.data.body,
        })
        .returning();

      logUserActivity(req, {
        userId: user.id,
        eventName: "event.comment_posted",
        source: "events_community",
        metadata: { eventId: event.id, commentId: comment.id, city: event.city, isReply: Boolean(comment.parentCommentId) },
      }).catch((err) => console.error("event comment activity log failed:", err));

      res.status(201).json(comment);
    } catch (error) {
      console.error("[events-community] post comment failed:", error);
      res.status(500).json({ error: "Failed to post comment" });
    }
  });

  // Soft-delete: comment owner, event host, or event admin.
  app.delete("/api/realist-events/comments/:id", async (req: Request, res: Response) => {
    try {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ error: "Sign in required" });

      const [comment] = await db
        .select()
        .from(realistEventComments)
        .where(eq(realistEventComments.id, req.params.id))
        .limit(1);
      if (!comment) return res.status(404).json({ error: "Comment not found" });

      let allowed = comment.userId === user.id;
      if (!allowed) {
        const [event] = await db
          .select({ hostUserId: realistEvents.hostUserId })
          .from(realistEvents)
          .where(eq(realistEvents.id, comment.eventId))
          .limit(1);
        allowed = event?.hostUserId === user.id || (await isEventAdminRequest(req));
      }
      if (!allowed) return res.status(403).json({ error: "Not allowed" });

      await db
        .update(realistEventComments)
        .set({ status: "removed", updatedAt: new Date() })
        .where(eq(realistEventComments.id, comment.id));
      res.json({ success: true });
    } catch (error) {
      console.error("[events-community] delete comment failed:", error);
      res.status(500).json({ error: "Failed to remove comment" });
    }
  });
}

/**
 * Spawn next occurrences for recurring events that have ended.
 * Series identity: parentEventId (root) — only the latest occurrence in a
 * series spawns, and only when no future occurrence already exists.
 */
export async function runEventRecurrenceSweep(): Promise<{ examined: number; spawned: number }> {
  const now = new Date();
  const candidates = await db
    .select()
    .from(realistEvents)
    .where(and(eq(realistEvents.isRecurring, true), eq(realistEvents.status, "PUBLISHED")));

  let spawned = 0;
  // newest occurrence per series
  const bySeries = new Map<string, (typeof candidates)[number]>();
  for (const event of candidates) {
    const seriesId = event.parentEventId || event.id;
    const current = bySeries.get(seriesId);
    if (!current || event.startsAt.getTime() > current.startsAt.getTime()) {
      bySeries.set(seriesId, event);
    }
  }

  for (const [seriesId, latest] of bySeries) {
    const next = nextSpawnStart(latest, now);
    if (!next) continue;

    const slug = occurrenceSlug(latest.slug, next);
    const [collision] = await db
      .select({ id: realistEvents.id })
      .from(realistEvents)
      .where(eq(realistEvents.slug, slug))
      .limit(1);
    if (collision) continue;

    const durationMs = latest.endsAt ? latest.endsAt.getTime() - latest.startsAt.getTime() : null;
    await db.insert(realistEvents).values({
      slug,
      title: latest.title,
      shortDescription: latest.shortDescription,
      longDescription: latest.longDescription,
      headerImageUrl: latest.headerImageUrl,
      eventType: latest.eventType,
      status: "PUBLISHED",
      startsAt: next,
      endsAt: durationMs ? new Date(next.getTime() + durationMs) : null,
      timezone: latest.timezone,
      venueName: latest.venueName,
      venueAddress: latest.venueAddress,
      onlineUrl: latest.onlineUrl,
      agendaSections: latest.agendaSections || [],
      capacity: latest.capacity,
      seoTitle: latest.seoTitle,
      seoDescription: latest.seoDescription,
      kind: latest.kind,
      city: latest.city,
      isRecurring: true,
      recurrenceNote: latest.recurrenceNote,
      recurrenceRule: latest.recurrenceRule,
      recurrenceUntil: latest.recurrenceUntil,
      parentEventId: seriesId,
      hostUserId: latest.hostUserId,
      createdByEmail: latest.createdByEmail,
    });
    spawned++;
    console.log(`[events-community] spawned next occurrence ${slug} (series ${seriesBaseSlug(latest.slug)})`);
  }

  return { examined: bySeries.size, spawned };
}

/** Daily recurrence sweep, mirroring the other in-process interval jobs. */
export function scheduleEventsCommunityJobs(log: (msg: string, tag?: string) => void): void {
  const sweep = async () => {
    try {
      const { examined, spawned } = await runEventRecurrenceSweep();
      if (spawned > 0) log(`Recurrence sweep: ${spawned} occurrence(s) spawned of ${examined} series`, "events");
    } catch (err: any) {
      log(`Recurrence sweep error: ${err.message}`, "events");
    }
  };
  setTimeout(sweep, 3 * 60 * 1000);
  setInterval(sweep, 24 * 60 * 60 * 1000);
}
