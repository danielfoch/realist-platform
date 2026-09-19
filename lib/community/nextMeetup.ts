import { cityFromLocation, getUpcomingMeetupEvents, type MeetupEvent } from "./meetup";

/**
 * The meetup worth mentioning to someone looking at a deal: the next one in
 * their market if there is one, otherwise nothing — a Vancouver event is no
 * use to someone underwriting a triplex in Hamilton.
 */

/** Places that share a meetup: someone in Etobicoke goes to the Toronto one. */
const METRO: Record<string, string> = {
  etobicoke: "toronto", scarborough: "toronto", "north york": "toronto", york: "toronto", "east york": "toronto",
  mississauga: "toronto", brampton: "toronto", markham: "toronto", "richmond hill": "toronto", woodbridge: "vaughan",
  burnaby: "vancouver", surrey: "vancouver", richmond: "vancouver", "north vancouver": "vancouver", coquitlam: "vancouver",
  waterloo: "kitchener", cambridge: "kitchener", dieppe: "moncton", riverview: "moncton", dartmouth: "halifax",
  gatineau: "ottawa", kanata: "ottawa", nepean: "ottawa", laval: "montreal", longueuil: "montreal",
  "st. albert": "edmonton", "sherwood park": "edmonton", airdrie: "calgary",
};

const normalize = (value: string | null | undefined) => (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const metroOf = (city: string) => METRO[city] ?? city;

export function pickMeetupFor(events: MeetupEvent[], city: string | null | undefined, now: Date = new Date()): MeetupEvent | null {
  const wanted = normalize(city);
  if (!wanted) return null;
  const upcoming = events
    .filter((event) => new Date(event.startsAt).getTime() > now.getTime())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return (
    upcoming.find((event) => {
      const where = normalize(cityFromLocation(event.location));
      const text = `${normalize(event.title)} ${normalize(event.location)}`;
      return (where && metroOf(where) === metroOf(wanted)) || text.includes(metroOf(wanted));
    }) ?? null
  );
}

export async function nextMeetupFor(city: string | null | undefined): Promise<MeetupEvent | null> {
  try {
    return pickMeetupFor(await getUpcomingMeetupEvents(), city);
  } catch {
    return null;
  }
}
