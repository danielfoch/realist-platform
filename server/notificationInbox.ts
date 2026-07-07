/**
 * In-app notification inbox — read-side API over notification_queue.
 *
 * The queue already records every notification a user receives by email
 * (retention audit: "a rendering problem, not a schema problem"); these
 * routes render those same rows for the nav bell. Kept separate from
 * server/notifications.ts on purpose: that file owns the producer/drain and
 * is being rewired by another task, so the inbox must not live there.
 *
 * Auth matches the sibling modules (server/watchlists.ts, server/crm.ts):
 * the isAuthenticated session guard plus req.session.userId scoping.
 */

import type { Express, Request, Response } from "express";
import "express-session";
import { and, count, desc, eq, inArray, isNull, lte, notInArray, or } from "drizzle-orm";
import { db } from "./db";
import { isAuthenticated } from "./auth";
import { notificationQueue } from "@shared/schema";
import { renderNotification } from "@shared/notificationRender";

export function registerNotificationInboxRoutes(app: Express): void {
  // Latest 50 queue rows for the session user (all channels), rendered to
  // human lines, plus the user's total unread count for the bell badge.
  app.get("/api/notifications", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId as string;

      // Visible = not failed/cancelled (a failed send is delivery plumbing;
      // cancelled means the governor or a consent check blocked it — a
      // consent-revoked user must not keep seeing nudge entries) and not
      // scheduled for the future (digests must not appear in-app before
      // their send window).
      const visible = and(
        eq(notificationQueue.recipientUserId, userId),
        notInArray(notificationQueue.status, ["failed", "cancelled"]),
        or(
          isNull(notificationQueue.scheduledFor),
          lte(notificationQueue.scheduledFor, new Date()),
        ),
      );
      const [rows, [unread]] = await Promise.all([
        db
          .select()
          .from(notificationQueue)
          .where(visible)
          .orderBy(desc(notificationQueue.createdAt))
          .limit(50),
        db
          .select({ count: count() })
          .from(notificationQueue)
          .where(and(visible, isNull(notificationQueue.readAt))),
      ]);

      const notifications = rows.map((row) => {
        const rendered = renderNotification(row.templateKey, row.payloadJson);
        return {
          id: row.id,
          title: rendered.title,
          body: rendered.body,
          link: rendered.link,
          createdAt: row.createdAt,
          readAt: row.readAt,
        };
      });

      res.json({ notifications, unreadCount: unread?.count ?? 0 });
    } catch (error) {
      console.error("[notification-inbox] list failed:", error);
      res.status(500).json({ message: "Failed to load notifications" });
    }
  });

  // Mark notifications read. Body {ids?: string[]}: with ids, marks those
  // rows (scoped to the session user); without, marks all the user's unread.
  // Only ever fills a null read_at — a read notification stays read.
  app.post("/api/notifications/read", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId as string;

      const rawIds = (req.body ?? {}).ids;
      if (rawIds !== undefined && (!Array.isArray(rawIds) || rawIds.some((id) => typeof id !== "string"))) {
        return res.status(400).json({ message: "ids must be an array of strings" });
      }
      const ids = rawIds as string[] | undefined;
      if (ids && ids.length === 0) {
        return res.json({ updated: 0 });
      }

      const conditions = [
        eq(notificationQueue.recipientUserId, userId),
        isNull(notificationQueue.readAt),
      ];
      if (ids) conditions.push(inArray(notificationQueue.id, ids));

      const updated = await db
        .update(notificationQueue)
        .set({ readAt: new Date() })
        .where(and(...conditions))
        .returning({ id: notificationQueue.id });

      res.json({ updated: updated.length });
    } catch (error) {
      console.error("[notification-inbox] mark-read failed:", error);
      res.status(500).json({ message: "Failed to mark notifications read" });
    }
  });
}
