/**
 * RSVP intent for meetups whose RSVP lives on another system.
 *
 * The free monthly meetups take RSVPs on Meetup.com (and, for some cities,
 * Eventbrite). Realist still wants to own the relationship, so the RSVP
 * button on /meetups does three things in order:
 *
 *   1. captures the person (lead row + free account, same as a native RSVP),
 *   2. when the visitor has connected their Meetup account and the RSVP
 *      mutation is configured, places the RSVP through Meetup's API,
 *   3. otherwise hands them the event page to finish in one tap.
 *
 * "notify" is the same capture for a city with no date posted yet.
 */
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { ensureUserByEmail } from "./eventsGrowth";
import { getSessionUser, baseUrlFromRequest } from "./eventsModule";
import { logUserActivity } from "./userActivity";
import { sendNotificationEmail } from "./resend";
import { getMeetupSessionAccessToken, rsvpViaMeetupApi } from "./meetupOAuth";
import { normalizeCity } from "@shared/meetupCalendar";

const rsvpSchema = z.object({
  source: z.enum(["meetup", "eventbrite", "realist", "notify"]),
  eventId: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  city: z.string().max(80).nullable().optional(),
  startsAt: z.string().max(40).nullable().optional(),
  url: z.string().max(500).nullable().optional(),
  name: z.string().max(120).optional(),
  email: z.string().email().max(200).optional(),
});

/**
 * The URL we echo back (and email) must belong to a system we actually send
 * people to; otherwise the endpoint could be used to mail strangers a link.
 */
export function isAllowedRsvpUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.startsWith("/events/")) return true;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return /(^|\.)(meetup\.com|eventbrite\.(ca|com)|realist\.ca)$/i.test(parsed.hostname);
  } catch {
    return false;
  }
}

function slugifyCity(city: string | null): string {
  return (city || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] as string));
}

// Same person, same event, inside ten minutes → one lead row, one email.
const recent = new Map<string, number>();
const THROTTLE_MS = 10 * 60 * 1000;
function throttled(key: string): boolean {
  const now = Date.now();
  for (const [k, at] of recent) if (now - at > THROTTLE_MS) recent.delete(k);
  if (recent.has(key)) return true;
  recent.set(key, now);
  return false;
}

export function registerMeetupRsvpRoutes(app: Express): void {
  app.post("/api/meetups/rsvp", async (req: Request, res: Response) => {
    try {
      const payload = rsvpSchema.parse(req.body || {});
      const sessionUser = await getSessionUser(req);
      const email = (sessionUser?.email || payload.email || "").trim().toLowerCase();
      if (!email) return res.status(400).json({ error: "Email is required" });

      const name = sessionUser
        ? [sessionUser.firstName, sessionUser.lastName].filter(Boolean).join(" ") || null
        : payload.name?.trim() || null;
      const city = normalizeCity(payload.city);
      const isNotify = payload.source === "notify";
      const url = isNotify ? null : isAllowedRsvpUrl(payload.url) ? payload.url! : null;
      if (!isNotify && !url) return res.status(400).json({ error: "That event link is not one we can send you to" });

      const surface = isNotify ? `meetup_notify_${slugifyCity(city)}` : `meetup_rsvp_${slugifyCity(city)}`;
      const duplicate = throttled(`${email}|${payload.source}|${payload.eventId}`);

      const user = sessionUser ?? (await ensureUserByEmail(email, name, `Meetup RSVP: ${city || payload.title}`));

      if (!duplicate) {
        await storage
          .createLead({
            name: name || email.split("@")[0],
            email,
            consent: true,
            leadSource: surface,
            userId: user?.id ?? null,
          })
          .catch((error: Error) => console.error("[meetup-rsvp] lead insert failed:", error.message));
      }

      await logUserActivity(req, {
        userId: user?.id || null,
        eventName: isNotify ? "meetup.notify_requested" : "meetup.rsvp_intent",
        sourcePage: "/meetups",
        metadata: { source: payload.source, eventId: payload.eventId, city, title: payload.title, url, startsAt: payload.startsAt ?? null },
      });

      // Try to place the RSVP on Meetup for a connected member.
      let placed = false;
      if (payload.source === "meetup") {
        const token = await getMeetupSessionAccessToken(req);
        if (token) {
          const result = await rsvpViaMeetupApi(token, payload.eventId);
          placed = result.attempted && result.ok;
        }
      }

      if (!duplicate) {
        const baseUrl = baseUrlFromRequest(req);
        const first = escapeHtml(name?.split(" ")[0] || "there");
        const title = escapeHtml(payload.title);
        const body = isNotify
          ? `<p>Hi ${first},</p><p>We'll email you as soon as the ${escapeHtml(city || "")} meetup date is posted. In the meantime, the deal analyzer is free at <a href="${baseUrl}/tools/analyzer">${baseUrl}/tools/analyzer</a>.</p>`
          : placed
            ? `<p>Hi ${first},</p><p>You're RSVP'd to <strong>${title}</strong>. See you there.</p><p><a href="${escapeHtml(url!)}">Event details</a></p>`
            : `<p>Hi ${first},</p><p>One more tap: confirm your spot for <strong>${title}</strong> on the event page so the host can plan for you.</p><p><a href="${escapeHtml(url!)}">Confirm my RSVP</a></p><p>Your free Realist account is ready at <a href="${baseUrl}/meetups">${baseUrl}/meetups</a>.</p>`;
        await sendNotificationEmail({
          to: email,
          subject: isNotify ? `We'll let you know: ${city || "your"} meetup` : placed ? `You're in: ${payload.title}` : `Confirm your spot: ${payload.title}`,
          html: body,
        }).catch((error: Error) => console.error("[meetup-rsvp] email failed:", error.message));
      }

      res.json({ ok: true, placed, url, accountCreated: !sessionUser, duplicate });
    } catch (error: any) {
      res.status(400).json({ error: error.errors?.[0]?.message || error.message || "Failed to RSVP" });
    }
  });
}
