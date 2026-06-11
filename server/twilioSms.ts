/**
 * Twilio SMS for the native CRM — outbound sends + inbound reply webhook.
 *
 * Uses Twilio's REST API directly (no SDK dependency). Configure in env:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER  (+1XXXXXXXXXX)
 *
 * Inbound: point the Twilio phone number's "A message comes in" webhook at
 *   POST https://realist.ca/api/crm/sms/inbound
 * Replies are matched to CRM contacts by phone and logged to the timeline;
 * STOP/UNSUBSCRIBE flips consentSms off (Twilio also enforces carrier-level
 * opt-out independently).
 */

import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { crmActivities, crmContacts } from "@shared/schema";

export function smsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER,
  );
}

/** Normalize to last-10-digits for matching CA/US numbers across formats. */
export function phoneKey(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

export async function sendSms(to: string, body: string): Promise<{ sid: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) throw new Error("Twilio is not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER)");

  const digits = to.replace(/\D/g, "");
  const e164 = to.startsWith("+") ? to : `+${digits.length === 10 ? "1" + digits : digits}`;

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: e164, From: from, Body: body.slice(0, 1600) }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `Twilio send failed (${res.status})`);
  return { sid: data.sid };
}

/**
 * Validate X-Twilio-Signature: base64(HMAC-SHA1(url + sorted form params)).
 * https://www.twilio.com/docs/usage/security#validating-requests
 */
export function validateTwilioSignature(req: Request, fullUrl: string): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return false;
  const signature = req.headers["x-twilio-signature"];
  if (typeof signature !== "string") return false;

  const params = (req.body && typeof req.body === "object") ? req.body : {};
  const data = fullUrl + Object.keys(params).sort().map((key) => key + params[key]).join("");
  const expected = crypto.createHmac("sha1", token).update(Buffer.from(data, "utf-8")).digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function registerSmsWebhookRoutes(app: Express): void {
  // Twilio posts application/x-www-form-urlencoded; express.urlencoded is
  // already mounted globally in this app.
  app.post("/api/crm/sms/inbound", async (req: Request, res: Response) => {
    try {
      const base = (process.env.PUBLIC_BASE_URL || "https://realist.ca").replace(/\/$/, "");
      const url = `${base}/api/crm/sms/inbound`;
      if (!validateTwilioSignature(req, url)) {
        res.status(403).send("invalid signature");
        return;
      }

      const from = String(req.body?.From || "");
      const body = String(req.body?.Body || "").slice(0, 2000);
      if (!from) {
        res.type("text/xml").send("<Response></Response>");
        return;
      }

      const key = phoneKey(from);
      // Match the most recently touched contact with this phone (any owner).
      const candidates = await db.select().from(crmContacts)
        .where(sql`regexp_replace(coalesce(${crmContacts.phone}, ''), '\\D', '', 'g') LIKE ${"%" + key}`)
        .orderBy(desc(crmContacts.updatedAt))
        .limit(1);
      const contact = candidates[0];

      const isStop = /^\s*(stop|unsubscribe|end|quit|cancel)\s*$/i.test(body);

      if (contact) {
        await db.insert(crmActivities).values({
          contactId: contact.id,
          userId: null,
          kind: "sms",
          body: `⬅️ Inbound: ${body}`,
          metadata: { direction: "inbound", from, twilioSid: req.body?.MessageSid || null },
        });
        const updates: Record<string, unknown> = { lastTouchAt: new Date(), updatedAt: new Date() };
        if (isStop) updates.consentSms = false;
        await db.update(crmContacts).set(updates).where(eq(crmContacts.id, contact.id));
      } else {
        console.log(`[sms] inbound from unmatched number ${from}: ${body.slice(0, 80)}`);
      }

      // Empty TwiML — no auto-reply; the human follows up from the CRM.
      res.type("text/xml").send("<Response></Response>");
    } catch (error) {
      console.error("[sms] inbound webhook failed:", error);
      res.type("text/xml").send("<Response></Response>");
    }
  });
}
