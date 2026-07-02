/**
 * Public contributor profiles — the core primitive for the "find each other"
 * half of the platform. A profile exists only for users with public activity
 * (analyses or comments); registering an account alone never exposes one.
 *
 * GET /api/profiles/:userId → public-safe profile + contribution stats
 */

import type { Express, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "./db";

const BADGES: Array<{ id: string; name: string; threshold: number }> = [
  { id: "legend", name: "Legend", threshold: 500 },
  { id: "veteran", name: "Veteran", threshold: 250 },
  { id: "deal-hunter", name: "Deal Hunter", threshold: 100 },
  { id: "power-user", name: "Power User", threshold: 50 },
  { id: "analyst", name: "Analyst", threshold: 10 },
];

export function registerPublicProfileRoutes(app: Express): void {
  app.get("/api/profiles/:userId", async (req: Request, res: Response) => {
    try {
      const userId = String(req.params.userId || "").trim();
      if (!userId) {
        res.status(400).json({ error: "userId is required" });
        return;
      }

      const userResult: any = await db.execute(sql`
        SELECT id, first_name, last_name, profile_image_url, role, created_at
        FROM users WHERE id = ${userId} LIMIT 1
      `);
      const user = userResult.rows?.[0];
      if (!user) {
        res.status(404).json({ error: "Profile not found" });
        return;
      }

      const [analysisResult, marketsResult, commentResult]: any[] = await Promise.all([
        db.execute(sql`
          SELECT
            COUNT(*)::int AS deal_count,
            MAX(created_at) AS last_active_at,
            AVG(CASE WHEN (results_json->>'capRate') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                      AND (results_json->>'capRate')::numeric BETWEEN -20 AND 100
                 THEN (results_json->>'capRate')::numeric END) AS avg_cap_rate
          FROM analyses
          WHERE user_id = ${userId} AND deleted_at IS NULL
        `),
        db.execute(sql`
          SELECT INITCAP(TRIM(city)) AS city, COUNT(*)::int AS n
          FROM analyses
          WHERE user_id = ${userId} AND deleted_at IS NULL AND city IS NOT NULL AND TRIM(city) != ''
          GROUP BY 1 ORDER BY n DESC LIMIT 3
        `),
        db.execute(sql`
          SELECT COUNT(*)::int AS comment_count, COALESCE(SUM(helpful_count), 0)::int AS helpful_count
          FROM listing_comments
          WHERE user_id = ${userId} AND visibility = 'public' AND status = 'active' AND deleted_at IS NULL
        `),
      ]);

      const analysisStats = analysisResult.rows?.[0] ?? {};
      const commentStats = commentResult.rows?.[0] ?? {};
      const dealCount = Number(analysisStats.deal_count || 0);
      const commentCount = Number(commentStats.comment_count || 0);

      // No public activity → no public profile.
      if (dealCount === 0 && commentCount === 0) {
        res.status(404).json({ error: "Profile not found" });
        return;
      }

      const badge = BADGES.find((b) => dealCount >= b.threshold) ?? null;
      const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || "Community investor";

      res.json({
        userId: user.id,
        name,
        role: user.role || "investor",
        profileImageUrl: user.profile_image_url || null,
        memberSince: user.created_at,
        badge,
        stats: {
          dealCount,
          avgCapRate: analysisStats.avg_cap_rate != null ? Number(analysisStats.avg_cap_rate) : null,
          lastActiveAt: analysisStats.last_active_at || null,
          commentCount,
          helpfulCount: Number(commentStats.helpful_count || 0),
        },
        markets: (marketsResult.rows || []).map((r: any) => ({ city: r.city, analyses: Number(r.n) })),
      });
    } catch (err: any) {
      console.error("[profiles] lookup failed:", err);
      res.status(500).json({ error: "Failed to load profile" });
    }
  });
}
