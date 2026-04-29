import crypto from "crypto";
import type { Request } from "express";
import { db } from "./db";
import { userActivityEvents } from "@shared/schema";

function shortHash(value?: string | null): string | null {
  if (!value) return null;
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 32);
}

export async function logUserActivity(req: Request | null, event: {
  userId?: string | null;
  sessionId?: string | null;
  eventName: string;
  listingId?: string | null;
  listingKey?: string | null;
  analysisId?: string | null;
  sourcePage?: string | null;
  component?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    const ip = req
      ? ((req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || null)
      : null;
    const userAgent = req ? req.headers["user-agent"] || null : null;
    await db.insert(userActivityEvents).values({
      userId: event.userId || null,
      sessionId: event.sessionId || null,
      eventName: event.eventName,
      listingId: event.listingId || null,
      listingKey: event.listingKey || null,
      analysisId: event.analysisId || null,
      sourcePage: event.sourcePage || null,
      component: event.component || null,
      metadata: event.metadata || null,
      hashedIp: shortHash(ip),
      userAgentHash: shortHash(userAgent),
      eventTimestamp: new Date(),
    });
  } catch (error) {
    console.error("Failed to log user activity:", error);
  }
}
