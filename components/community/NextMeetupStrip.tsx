import Link from "next/link";
import { nextMeetupFor } from "@/lib/community/nextMeetup";

/**
 * On a deal page: the next investor meetup in that market, if there is one.
 * The people who can tell you what that street really rents for are in that room.
 */
export async function NextMeetupStrip({ city }: { city: string | null }) {
  const meetup = await nextMeetupFor(city);
  if (!meetup) return null;
  const when = new Intl.DateTimeFormat("en-CA", {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    timeZone: meetup.timezone ?? "America/Toronto",
  }).format(new Date(meetup.startsAt));
  return (
    <Link
      href="/community"
      className="group mt-4 block rounded-xl border border-hairline bg-surface p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <p className="tnum text-[10px] font-medium uppercase tracking-[1.3px] text-ink-faint">Investors near this deal · {when}</p>
      <p className="mt-1.5 text-sm font-semibold text-ink">{meetup.title}</p>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
        The people who know what this street really rents for are in that room.
        {meetup.rsvpCount ? ` ${meetup.rsvpCount} going.` : ""}
      </p>
      <span className="mt-2 inline-block text-sm font-semibold text-brand group-hover:text-brand-deep">Save your spot →</span>
    </Link>
  );
}
