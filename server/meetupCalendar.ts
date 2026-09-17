/**
 * One merged community calendar for /meetups and the homepage strip.
 *
 * Pulls the three event sources the site already has — the Meetup.com Pro
 * network feed (meetupNetwork.ts), the Eventbrite organizer feed
 * (eventbrite.ts) and native realist_events — and hands them to the pure
 * merge in shared/meetupCalendar.ts. Each source is fetched independently so
 * one failing feed never blanks the page.
 */
import type { Express, Request, Response } from "express";
import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { realistEvents, realistEventRsvps } from "@shared/schema";
import { getEvents as getEventbriteEvents } from "./eventbrite";
import { getMeetupNetwork } from "./meetupNetwork";
import {
  buildCalendar,
  normalizeCity,
  type CalendarEvent,
  type EventbriteEventLike,
  type MeetupEventLike,
  type RealistEventLike,
} from "@shared/meetupCalendar";

export interface MeetupCalendarResponse {
  events: CalendarEvent[];
  sources: {
    meetup: string;
    eventbrite: string;
    realist: string;
  };
  fetchedAt: string;
}

const GRACE_MS = 4 * 60 * 60 * 1000;

async function loadNativeMeetups(now: Date): Promise<RealistEventLike[]> {
  const events = await db
    .select()
    .from(realistEvents)
    .where(
      and(
        eq(realistEvents.status, "PUBLISHED"),
        eq(realistEvents.kind, "meetup"),
        gte(realistEvents.startsAt, new Date(now.getTime() - GRACE_MS)),
      ),
    )
    .orderBy(asc(realistEvents.startsAt))
    .limit(200);
  if (events.length === 0) return [];
  const ids = events.map((event) => event.id);
  const rsvps = await db
    .select({ eventId: realistEventRsvps.eventId, going: sql<number>`COUNT(*)` })
    .from(realistEventRsvps)
    .where(and(inArray(realistEventRsvps.eventId, ids), eq(realistEventRsvps.status, "GOING")))
    .groupBy(realistEventRsvps.eventId);
  const going = new Map(rsvps.map((row) => [row.eventId, Number(row.going)]));
  return events.map((event) => ({
    id: event.id,
    slug: event.slug,
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    timezone: event.timezone,
    venueName: event.venueName,
    venueAddress: event.venueAddress,
    city: event.city,
    kind: event.kind,
    rsvpCount: going.get(event.id) ?? 0,
    minPriceCents: 0,
  }));
}

export async function getMeetupCalendar(now: Date = new Date()): Promise<MeetupCalendarResponse> {
  const [network, eventbrite, native] = await Promise.allSettled([
    getMeetupNetwork(),
    getEventbriteEvents(),
    loadNativeMeetups(now),
  ]);

  const meetup: MeetupEventLike[] = network.status === "fulfilled" ? network.value.events : [];
  const meetupSource = network.status === "fulfilled" ? network.value.source : "error";

  // The Eventbrite module serves hand-written placeholder events when it has
  // no token; those must never reach a public calendar.
  let eventbriteEvents: EventbriteEventLike[] = [];
  let eventbriteSource = "error";
  if (eventbrite.status === "fulfilled") {
    const source = eventbrite.value.source || "";
    const isPlaceholder = /placeholder|fallback/i.test(source);
    eventbriteSource = isPlaceholder ? "placeholder" : "ok";
    eventbriteEvents = isPlaceholder
      ? []
      : eventbrite.value.events
          .filter((event) => event.status === "live" || !event.status)
          .map((event) => ({
            id: event.id,
            name: event.name,
            startDate: event.startDate,
            endDate: event.endDate,
            timezone: event.timezone,
            venueName: event.venueName,
            venueAddress: event.venueAddress,
            eventUrl: event.eventUrl,
          }));
  }

  const realist = native.status === "fulfilled" ? native.value : [];
  if (native.status === "rejected") console.error("[meetup-calendar] native meetups failed:", native.reason);

  return {
    events: buildCalendar({ meetup, eventbrite: eventbriteEvents, realist, now }),
    sources: {
      meetup: meetupSource,
      eventbrite: eventbriteSource,
      realist: native.status === "fulfilled" ? "ok" : "error",
    },
    fetchedAt: now.toISOString(),
  };
}

export function registerMeetupCalendarRoutes(app: Express): void {
  app.get("/api/meetups/calendar", async (req: Request, res: Response) => {
    try {
      const calendar = await getMeetupCalendar();
      const city = typeof req.query.city === "string" ? normalizeCity(req.query.city) : null;
      const limit = Math.min(Math.max(Number(req.query.limit) || 0, 0), 100);
      let events = city ? calendar.events.filter((event) => event.city === city) : calendar.events;
      if (limit > 0) events = events.slice(0, limit);
      res.set("Cache-Control", "public, max-age=300");
      res.json({ ...calendar, events });
    } catch (error) {
      console.error("[meetup-calendar] failed:", error);
      res.status(500).json({ error: "Failed to load the meetup calendar" });
    }
  });
}
