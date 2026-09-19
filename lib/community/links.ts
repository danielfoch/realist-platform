/**
 * Client-safe helpers for Meetup links. Event URLs arrive from an external
 * feed; only hand people off to a URL that is really on meetup.com.
 */

export function isMeetupUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === "meetup.com" || parsed.hostname.endsWith(".meetup.com"))
    );
  } catch {
    return false;
  }
}
