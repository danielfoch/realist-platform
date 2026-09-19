import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { JoinForm } from "@/components/community/JoinForm";
import { RsvpButton } from "@/components/community/RsvpButton";
import { breadcrumbNode, eventNode, jsonLdDocument } from "@/lib/seo/jsonld";
import {
  cityFromLocation,
  getMeetupGroupUrl,
  getUpcomingMeetupEvents,
  type MeetupEvent,
} from "@/lib/community/meetup";
import { PODCAST_NAME } from "@/lib/brand";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Community — investor meetups across Canada",
  description:
    "The Canadian Real Estate Investor podcast community meets in person: monthly investor meetups across Canada, with live RSVP counts from the Meetup network. See upcoming events and get invites.",
  alternates: { canonical: "/community" },
};

const FALLBACK_TZ = "America/Toronto";

function dateParts(event: MeetupEvent) {
  const timeZone = event.timezone ?? FALLBACK_TZ;
  const date = new Date(event.startsAt);
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-CA", { timeZone, ...options }).format(date);
  try {
    return {
      day: part({ day: "numeric" }),
      month: part({ month: "short" }),
      weekday: part({ weekday: "long" }),
      time: part({ hour: "numeric", minute: "2-digit", timeZoneName: "short" }),
    };
  } catch {
    return { day: "", month: "", weekday: "", time: "" };
  }
}

/**
 * A host who posts a recurring series a year out would bury every other city.
 * Keep each series (same title, same city) to its next few dates.
 */
function capRecurringSeries(events: MeetupEvent[], maxPerSeries = 2): MeetupEvent[] {
  const seen = new Map<string, number>();
  return events.filter((event) => {
    const key = `${event.title}|${cityFromLocation(event.location) ?? ""}`;
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    return count < maxPerSeries;
  });
}

export default async function CommunityPage() {
  const allEvents = await getUpcomingMeetupEvents().catch(() => []);
  const events = capRecurringSeries(allEvents);
  const hiddenCount = allEvents.length - events.length;
  const meetupGroupUrl = getMeetupGroupUrl();

  return (
    <>
      <JsonLd
        json={jsonLdDocument(
          breadcrumbNode([
            { name: "Home", path: "/" },
            { name: "Community", path: "/community" },
          ]),
          ...events.map((event) =>
            eventNode({
              id: event.uid,
              name: event.title,
              startDate: event.startsAt,
              endDate: event.endsAt,
              url: event.url,
              location: event.location,
              description: event.description,
            }),
          ),
        )}
      />

      {/* Hero */}
      <section className="border-b border-hairline bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand">
            {PODCAST_NAME} community
          </p>
          <h1 className="font-display mt-3 max-w-3xl text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl lg:text-5xl">
            The podcast community, in person.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-soft">
            Twice a week you hear us argue about the Canadian market. Once a
            month, the community does it face to face — investor meetups in
            Toronto, Vancouver, Calgary and beyond, organized on Meetup and open
            to anyone who owns doors or wants to.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href="#events"
              className="rounded-md bg-brand px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-deep"
            >
              See upcoming events
            </a>
            {meetupGroupUrl && (
              <a
                href={meetupGroupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-hairline-strong bg-surface px-5 py-3 text-sm font-semibold text-ink transition-colors hover:border-brand hover:text-brand"
              >
                Join the group on Meetup ↗
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Upcoming events */}
      <section id="events" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6">
        <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Upcoming meetups
        </h2>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Save your spot here in ten seconds. The head-count lives on Meetup so
          venues know how many chairs to set up — we hand you over to finish.
        </p>

        {events.length > 0 ? (
          <div className="mt-8 divide-y divide-hairline border-t border-hairline">
            {events.map((event) => {
              const parts = dateParts(event);
              const city = cityFromLocation(event.location);
              return (
                <article
                  key={event.uid}
                  className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center"
                >
                  <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-lg border border-hairline bg-surface">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-brand">
                      {parts.month}
                    </span>
                    <span className="tnum font-display text-2xl font-semibold leading-none">
                      {parts.day}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-lg font-semibold leading-snug">
                      {event.url ? (
                        <a
                          href={event.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-brand"
                        >
                          {event.title}
                        </a>
                      ) : (
                        event.title
                      )}
                    </h3>
                    <p className="mt-1 text-sm text-ink-soft">
                      {parts.weekday}
                      {parts.time && <> · {parts.time}</>}
                      {city && (
                        <>
                          {" "}
                          ·{" "}
                          <span className="font-medium text-ink">{city}</span>
                        </>
                      )}
                    </p>
                    {typeof event.rsvpCount === "number" && event.rsvpCount > 0 && (
                      <p className="tnum mt-0.5 text-xs text-ink-faint">
                        {event.rsvpCount} going
                      </p>
                    )}
                  </div>
                  <RsvpButton
                    event={{
                      uid: event.uid,
                      title: event.title,
                      url: event.url,
                      whenLabel: [parts.weekday, `${parts.month} ${parts.day}`, parts.time]
                        .filter(Boolean)
                        .join(" · "),
                      city,
                    }}
                    fallbackUrl={meetupGroupUrl}
                  />
                </article>
              );
            })}
            {hiddenCount > 0 && (
              <p className="pt-5 text-sm text-ink-faint">
                Showing the next two dates of each recurring meetup —{" "}
                <span className="tnum">{hiddenCount}</span> later dates are on Meetup.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-8 rounded-xl border border-hairline bg-surface p-8">
            <h3 className="font-display text-lg font-semibold">
              The next round of dates is being locked in.
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
              Meetups run monthly across the network. {meetupGroupUrl
                ? "Events post to the Meetup group first — join it and you'll see new dates the moment hosts publish them."
                : "Drop your email below and we'll send the invite as soon as each date is live."}
            </p>
            {meetupGroupUrl && (
              <a
                href={meetupGroupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block text-sm font-semibold text-brand hover:text-brand-deep"
              >
                Open the Meetup group ↗
              </a>
            )}
          </div>
        )}
      </section>

      {/* Email capture */}
      <section className="border-t border-hairline bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Get event invites.
            </h2>
            <p className="mt-2 max-w-xl leading-relaxed text-ink-soft">
              One email when a meetup is announced in your part of the country,
              and first call on seats for the Toronto flagship. No drip
              campaign, no &ldquo;final warning&rdquo; countdown emails.
            </p>
          </div>
          <div className="rounded-xl border border-hairline bg-paper p-5">
            <JoinForm
              source="event"
              variant="inline"
              submitLabel="Get event invites"
              successMessage="You're on the invite list. Watch your inbox for the next date."
            />
          </div>
        </div>
      </section>
    </>
  );
}
