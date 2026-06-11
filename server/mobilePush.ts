/**
 * Mobile push-token registry for the Capacitor apps (mobile/).
 *
 * The native shells load realist.ca; Capacitor injects its bridge into the
 * page, and client/src/lib/capacitorPush.ts registers for push and posts the
 * device token here. Sending (FCM/APNs) is wired later — registering tokens
 * from day one means the audience exists the moment we turn sending on, and
 * it strengthens the App Store "more than a website" review answer.
 */

import type { Express, Request, Response } from "express";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { pushDeviceTokens } from "@shared/schema";

const tokenSchema = z.object({
  token: z.string().min(8).max(512),
  platform: z.enum(["ios", "android", "web"]),
});

export async function ensurePushTokenTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "push_device_tokens" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" varchar REFERENCES "users"("id") ON DELETE SET NULL,
      "token" text NOT NULL UNIQUE,
      "platform" varchar(10) NOT NULL,
      "is_active" boolean NOT NULL DEFAULT true,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "last_seen_at" timestamp NOT NULL DEFAULT now()
    )
  `);
}

export function registerMobilePushRoutes(app: Express): void {
  ensurePushTokenTable().catch((error) =>
    console.error("[mobile-push] failed to ensure table:", error.message),
  );

  app.post("/api/mobile/push-token", async (req: Request, res: Response) => {
    try {
      const payload = tokenSchema.parse(req.body);
      const userId = req.session?.userId ?? null;
      await db.insert(pushDeviceTokens)
        .values({ token: payload.token, platform: payload.platform, userId })
        .onConflictDoUpdate({
          target: pushDeviceTokens.token,
          set: {
            isActive: true,
            lastSeenAt: new Date(),
            // Keep the strongest identity we have seen for this device.
            ...(userId ? { userId } : {}),
          },
        });
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.errors?.[0]?.message || "Invalid token" });
    }
  });

  app.delete("/api/mobile/push-token", async (req: Request, res: Response) => {
    try {
      const token = String(req.body?.token || "");
      if (!token) return res.status(400).json({ success: false, error: "token required" });
      await db.update(pushDeviceTokens)
        .set({ isActive: false, lastSeenAt: new Date() })
        .where(eq(pushDeviceTokens.token, token));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: "Failed to unregister" });
    }
  });
}
