/**
 * Weekly admin CRM summary — replaces per-lead instant alert emails.
 *
 * Every Monday ~8am ET, Dan + Nick get ONE email: new leads, analyses, and
 * Deal Desk submissions from the past 7 days, the hottest leads by intent
 * score, and links into the CRM / Deal Desk to work them. Instant per-lead
 * alerts are now opt-in via ADMIN_INSTANT_LEAD_ALERTS=true (see emailQueue).
 */

import { desc, gt, sql } from "drizzle-orm";
import { db } from "./db";
import { sendNotificationEmail } from "./resend";
import { storage } from "./storage";
import { analyses, leads, opportunities, users } from "@shared/schema";

async function recipients(): Promise<string[]> {
  const dbEmail = await storage.getAppSetting("deal_desk_notify_email").catch(() => null);
  const raw = dbEmail || process.env.DEAL_DESK_NOTIFY_EMAIL || process.env.PODCAST_NOTIFY_EMAIL || "";
  return raw.split(",").map((e: string) => e.trim()).filter(Boolean);
}

export async function sendAdminWeeklySummary(): Promise<boolean> {
  const to = await recipients();
  if (!to.length) return false;

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [[leadRow], [analysisRow], [oppRow]] = await Promise.all([
    db.select({ n: sql<number>`COUNT(*)` }).from(leads).where(gt(leads.createdAt, weekAgo)),
    db.select({ n: sql<number>`COUNT(*)` }).from(analyses).where(gt(analyses.createdAt, weekAgo)),
    db.select({ n: sql<number>`COUNT(*)` }).from(opportunities).where(gt(opportunities.createdAt, weekAgo)),
  ]);

  const hot = await db
    .select({
      intentScore: opportunities.intentScore,
      status: opportunities.status,
      market: opportunities.market,
      address: opportunities.propertyAddress,
      financingHelp: opportunities.financingHelp,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(opportunities)
    .leftJoin(users, sql`${users.id} = ${opportunities.userId}`)
    .where(gt(opportunities.createdAt, weekAgo))
    .orderBy(desc(opportunities.intentScore))
    .limit(10);

  const rows = hot.map((o) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #f3f4f6;"><strong>${[o.firstName, o.lastName].filter(Boolean).join(" ") || o.email || "—"}</strong><br><span style="color:#6b7280;font-size:12px;">${o.email || ""}</span></td>
      <td style="padding:8px;border-bottom:1px solid #f3f4f6;">${o.intentScore}pts${o.financingHelp ? " 💰" : ""}</td>
      <td style="padding:8px;border-bottom:1px solid #f3f4f6;">${o.address || o.market || "—"}</td>
      <td style="padding:8px;border-bottom:1px solid #f3f4f6;">${o.status}</td>
    </tr>`).join("");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#111827;">
      <h1 style="font-size:22px;">📬 Realist — Weekly CRM Summary</h1>
      <table style="width:100%;text-align:center;margin:16px 0;">
        <tr>
          <td style="padding:14px;background:#f0fdf4;border-radius:8px;"><div style="font-size:26px;font-weight:700;">${Number(leadRow?.n || 0)}</div><div style="color:#6b7280;font-size:13px;">new leads</div></td>
          <td style="width:10px;"></td>
          <td style="padding:14px;background:#eff6ff;border-radius:8px;"><div style="font-size:26px;font-weight:700;">${Number(oppRow?.n || 0)}</div><div style="color:#6b7280;font-size:13px;">deal desk submissions</div></td>
          <td style="width:10px;"></td>
          <td style="padding:14px;background:#fefce8;border-radius:8px;"><div style="font-size:26px;font-weight:700;">${Number(analysisRow?.n || 0)}</div><div style="color:#6b7280;font-size:13px;">deals analyzed</div></td>
        </tr>
      </table>
      ${rows ? `<h2 style="font-size:16px;">Hottest leads this week</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr style="text-align:left;color:#6b7280;font-size:12px;"><th style="padding:8px;">Lead</th><th style="padding:8px;">Intent</th><th style="padding:8px;">Property/Market</th><th style="padding:8px;">Status</th></tr>
        ${rows}
      </table>` : `<p style="color:#6b7280;">No Deal Desk submissions this week.</p>`}
      <p style="margin:24px 0;">
        <a href="https://realist.ca/crm" style="background:#16a34a;color:#fff;padding:11px 20px;border-radius:6px;text-decoration:none;font-weight:600;margin-right:10px;">Work leads in the CRM</a>
        <a href="https://realist.ca/admin/deal-desk" style="background:#111827;color:#fff;padding:11px 20px;border-radius:6px;text-decoration:none;font-weight:600;">Deal Desk board</a>
      </p>
      <p style="color:#9ca3af;font-size:12px;">Instant per-lead alerts are off (set ADMIN_INSTANT_LEAD_ALERTS=true to re-enable). This summary sends every Monday.</p>
    </div>`;

  for (const email of to) {
    await sendNotificationEmail({
      to: email,
      subject: `📬 Weekly CRM summary: ${Number(leadRow?.n || 0)} new leads, ${Number(oppRow?.n || 0)} deal desk submissions`,
      html,
    }).catch((e) => console.error("[admin-summary] send failed:", e.message));
  }
  return true;
}

/** Monday ~8am ET, deduped via app settings so restarts don't double-send. */
export function scheduleAdminWeeklySummary(): void {
  setInterval(async () => {
    try {
      const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Toronto" }));
      if (now.getDay() !== 1 || now.getHours() !== 8) return;
      const weekKey = `${now.getFullYear()}-W${Math.ceil(((+now - +new Date(now.getFullYear(), 0, 1)) / 86400000 + 1) / 7)}`;
      const last = await storage.getAppSetting("admin_weekly_summary_last").catch(() => null);
      if (last === weekKey) return;
      await storage.setAppSetting("admin_weekly_summary_last", weekKey);
      await sendAdminWeeklySummary();
      console.log(`[admin-summary] sent for ${weekKey}`);
    } catch (error: any) {
      console.error("[admin-summary] schedule tick failed:", error.message);
    }
  }, 30 * 60 * 1000);
}
