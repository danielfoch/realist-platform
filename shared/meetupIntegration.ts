import { createHmac, timingSafeEqual } from "crypto";

export const MEETUP_OAUTH_STATE_MAX_AGE_MS = 15 * 60 * 1000;

export type MeetupEventNode = {
  id?: string | number | null;
  title?: string | null;
  eventUrl?: string | null;
  description?: string | null;
  dateTime?: string | null;
  duration?: string | null;
  eventHosts?: Array<{ name?: string | null }> | null;
  featuredEventPhoto?: { id?: string | number | null; baseUrl?: string | null } | null;
  group?: { id?: string | number | null; name?: string | null; urlname?: string | null } | null;
  rsvps?: { totalCount?: number | null } | null;
};

export type NormalizedMeetupEvent = {
  externalEventId: string;
  externalUrl: string;
  externalGroupUrlname: string | null;
  externalGroupName: string | null;
  externalRsvpCount: number;
  slug: string;
  title: string;
  shortDescription: string;
  longDescription: string;
  startsAt: Date;
  endsAt: Date | null;
  eventType: "IN_PERSON" | "WEBINAR" | "HYBRID";
  city: string | null;
  timezone: string;
  hostNames: string[];
  headerImageUrl: string | null;
};

const CANADIAN_CITIES = [
  "Toronto",
  "Vaughan",
  "Hamilton",
  "Barrie",
  "Ottawa",
  "Kitchener",
  "Waterloo",
  "London",
  "Windsor",
  "Kingston",
  "Montreal",
  "Moncton",
  "Halifax",
  "Charlottetown",
  "Fredericton",
  "Saint John",
  "Winnipeg",
  "Regina",
  "Saskatoon",
  "Calgary",
  "Edmonton",
  "Vancouver",
  "Victoria",
  "Kelowna",
  "Surrey",
] as const;

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export function stripMeetupHtml(value: string | null | undefined): string {
  if (!value) return "";
  return decodeEntities(
    value
      .replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, "")
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6])\s*>/gi, "\n\n")
      .replace(/<[^>]*>/g, ""),
  )
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function meetupEventSlug(eventId: string, groupUrlname?: string | null): string {
  const group = (groupUrlname || "network")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "network";
  const id = eventId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `meetup-${group}-${id}`.slice(0, 150);
}

export function parseIsoDurationMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (!match) return null;
  const [, days = "0", hours = "0", minutes = "0", seconds = "0"] = match;
  const milliseconds = (
    Number(days) * 86_400 +
    Number(hours) * 3_600 +
    Number(minutes) * 60 +
    Number(seconds)
  ) * 1000;
  return Number.isFinite(milliseconds) && milliseconds >= 0 ? milliseconds : null;
}

function inferCity(...parts: Array<string | null | undefined>): string | null {
  const haystack = parts.filter(Boolean).join(" ").toLocaleLowerCase("en-CA");
  return CANADIAN_CITIES.find((city) => haystack.includes(city.toLocaleLowerCase("en-CA"))) || null;
}

function timezoneForCity(city: string | null): string {
  if (["Vancouver", "Victoria", "Kelowna", "Surrey"].includes(city || "")) return "America/Vancouver";
  if (["Calgary", "Edmonton"].includes(city || "")) return "America/Edmonton";
  if (["Regina", "Saskatoon"].includes(city || "")) return "America/Regina";
  if (city === "Winnipeg") return "America/Winnipeg";
  if (["Halifax", "Charlottetown"].includes(city || "")) return "America/Halifax";
  if (["Moncton", "Fredericton", "Saint John"].includes(city || "")) return "America/Moncton";
  return "America/Toronto";
}

function safeMeetupUrl(value: string | null | undefined): string | null {
  try {
    const url = new URL(value || "");
    if (url.protocol !== "https:" || !/(^|\.)meetup\.com$/i.test(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function photoUrl(photo: MeetupEventNode["featuredEventPhoto"]): string | null {
  if (!photo?.id || !photo.baseUrl) return null;
  try {
    const base = new URL(photo.baseUrl);
    if (base.protocol !== "https:" || !/(^|\.)meetupstatic\.com$/i.test(base.hostname)) return null;
    const root = base.toString().replace(/\/$/, "");
    return `${root}/${encodeURIComponent(String(photo.id))}/676x380.webp`;
  } catch {
    return null;
  }
}

export function normalizeMeetupEvent(node: MeetupEventNode): NormalizedMeetupEvent | null {
  const externalEventId = String(node.id || "").trim();
  const title = String(node.title || "").trim();
  const externalUrl = safeMeetupUrl(node.eventUrl);
  const startsAt = new Date(String(node.dateTime || ""));
  if (!externalEventId || !title || !externalUrl || Number.isNaN(startsAt.getTime())) return null;

  const longDescription = stripMeetupHtml(node.description);
  const shortDescription = (longDescription || `${title} — a Canadian real estate investor meetup.`).slice(0, 300);
  const durationMs = parseIsoDurationMs(node.duration);
  const signal = `${title} ${longDescription}`.toLowerCase();
  const mentionsOnline = /\b(online|virtual|zoom|webinar)\b/.test(signal);
  const mentionsInPerson = /\b(in person|in-person|venue|pub|brewery|restaurant)\b/.test(signal);
  const eventType = mentionsOnline && mentionsInPerson ? "HYBRID" : mentionsOnline ? "WEBINAR" : "IN_PERSON";
  const hostNames = (node.eventHosts || [])
    .map((host) => String(host?.name || "").trim())
    .filter(Boolean)
    .slice(0, 8);
  const externalGroupUrlname = node.group?.urlname ? String(node.group.urlname) : null;
  const externalGroupName = node.group?.name ? String(node.group.name) : null;
  const city = inferCity(title, externalGroupName, externalGroupUrlname, longDescription);

  return {
    externalEventId,
    externalUrl,
    externalGroupUrlname,
    externalGroupName,
    externalRsvpCount: Math.max(0, Math.floor(Number(node.rsvps?.totalCount) || 0)),
    slug: meetupEventSlug(externalEventId, externalGroupUrlname),
    title,
    shortDescription,
    longDescription,
    startsAt,
    endsAt: durationMs && durationMs > 0 ? new Date(startsAt.getTime() + durationMs) : null,
    eventType,
    city,
    timezone: timezoneForCity(city),
    hostNames,
    headerImageUrl: photoUrl(node.featuredEventPhoto),
  };
}

function stateSignature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function signMeetupOAuthState(userId: string, secret: string, now = Date.now()): string {
  if (!userId || userId.includes(".")) throw new Error("A valid user id is required");
  if (secret.length < 16) throw new Error("Meetup OAuth state secret is too short");
  const payload = `${userId}.${now}`;
  return Buffer.from(`${payload}.${stateSignature(payload, secret)}`).toString("base64url");
}

export function verifyMeetupOAuthState(state: string, secret: string, now = Date.now()): string | null {
  try {
    const decodedBuffer = Buffer.from(state, "base64url");
    if (decodedBuffer.toString("base64url") !== state) return null;
    const [userId, timestampText, signature, ...rest] = decodedBuffer.toString("utf8").split(".");
    if (!userId || !timestampText || !signature || rest.length) return null;
    const timestamp = Number(timestampText);
    if (!Number.isFinite(timestamp) || now - timestamp > MEETUP_OAUTH_STATE_MAX_AGE_MS || timestamp - now > 60_000) return null;
    const expected = stateSignature(`${userId}.${timestampText}`, secret);
    const actualBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
    return userId;
  } catch {
    return null;
  }
}
