/**
 * Seed the 2026–2027 Realist event calendar + official recurring meetups.
 *
 * Idempotent: skips any slug that already exists. Flagship events are
 * created as DRAFT (admins fill venue/pricing then publish); official
 * recurring meetups are created as DRAFT too so hosts confirm dates first.
 *
 * Run: npx tsx scripts/seed-events-2026.ts
 */

import { eq } from "drizzle-orm";
import { db } from "../server/db";
import { realistEvents, realistEventTicketTypes } from "../shared/schema";

const ADMIN_EMAIL = "danielfoch@gmail.com";

interface FlagshipSeed {
  slug: string;
  title: string;
  city: string;
  startsAt: string; // placeholder date — admins adjust before publishing
  timezone: string;
}

const FLAGSHIPS: FlagshipSeed[] = [
  { slug: "multiplex-conference-toronto-2026", title: "Realist Multiplex Conference — Toronto 2026", city: "Toronto", startsAt: "2026-09-19T09:00:00-04:00", timezone: "America/Toronto" },
  { slug: "multiplex-conference-montreal-2026", title: "Realist Multiplex Conference — Montreal 2026", city: "Montreal", startsAt: "2026-11-14T09:00:00-05:00", timezone: "America/Toronto" },
  { slug: "multiplex-conference-halifax-2027", title: "Realist Multiplex Conference — Halifax 2027", city: "Halifax", startsAt: "2027-03-20T09:00:00-03:00", timezone: "America/Halifax" },
  { slug: "multiplex-conference-calgary-2027", title: "Realist Multiplex Conference — Calgary 2027", city: "Calgary", startsAt: "2027-05-15T09:00:00-06:00", timezone: "America/Edmonton" },
  { slug: "multiplex-conference-vancouver-2027", title: "Realist Multiplex Conference — Vancouver 2027", city: "Vancouver", startsAt: "2027-06-12T09:00:00-07:00", timezone: "America/Vancouver" },
  { slug: "multiplex-conference-toronto-2027", title: "Realist Multiplex Conference — Toronto 2027", city: "Toronto", startsAt: "2027-09-18T09:00:00-04:00", timezone: "America/Toronto" },
  { slug: "multiplex-conference-montreal-2027", title: "Realist Multiplex Conference — Montreal 2027", city: "Montreal", startsAt: "2027-11-13T09:00:00-05:00", timezone: "America/Toronto" },
];

const MEETUP_CITIES = [
  { city: "Toronto", host: "Daniel Foch" },
  { city: "Vancouver", host: "James Anderson" },
  { city: "Calgary", host: "Sylvia Castonguay" },
  { city: "Montreal", host: "LJ Aguinaga" },
  { city: "Moncton", host: "Cameron Biroux" },
];

async function main() {
  let created = 0;

  for (const seed of FLAGSHIPS) {
    const [existing] = await db.select({ id: realistEvents.id }).from(realistEvents).where(eq(realistEvents.slug, seed.slug)).limit(1);
    if (existing) {
      console.log(`skip (exists): ${seed.slug}`);
      continue;
    }
    const [event] = await db.insert(realistEvents).values({
      slug: seed.slug,
      title: seed.title,
      shortDescription: "Canada's leading multiplex investing event: live underwriting, missing-middle development, MLI Select financing, and the operators actually doing it.",
      eventType: "IN_PERSON",
      status: "DRAFT",
      startsAt: new Date(seed.startsAt),
      timezone: seed.timezone,
      kind: "flagship",
      city: seed.city,
      capacity: 300,
      createdByEmail: ADMIN_EMAIL,
      seoTitle: `${seed.title} | Multiplex & Missing Middle Investing`,
      seoDescription: `Tickets for ${seed.title}. Live multiplex deal analysis, missing middle development, MLI Select financing, and Canada's top investors.`,
    }).returning();
    await db.insert(realistEventTicketTypes).values([
      { eventId: event.id, name: "Early Bird", priceCents: 19900, currency: "cad", quantityTotal: 100 },
      { eventId: event.id, name: "General Admission", priceCents: 29900, currency: "cad", quantityTotal: 150 },
      { eventId: event.id, name: "VIP (front rows + dinner)", priceCents: 59900, currency: "cad", quantityTotal: 50 },
    ]);
    console.log(`created flagship: ${seed.slug}`);
    created += 1;
  }

  for (const meetup of MEETUP_CITIES) {
    const slug = `realist-investor-meetup-${meetup.city.toLowerCase()}`;
    const [existing] = await db.select({ id: realistEvents.id }).from(realistEvents).where(eq(realistEvents.slug, slug)).limit(1);
    if (existing) {
      console.log(`skip (exists): ${slug}`);
      continue;
    }
    await db.insert(realistEvents).values({
      slug,
      title: `Realist Investor Meetup — ${meetup.city}`,
      shortDescription: `Monthly free meetup for real estate investors in ${meetup.city}. Networking, a live deal analysis on Realist, and a local market update. Hosted by ${meetup.host}.`,
      eventType: "IN_PERSON",
      status: "DRAFT",
      startsAt: new Date("2026-07-07T18:30:00-04:00"),
      timezone: "America/Toronto",
      kind: "meetup",
      city: meetup.city,
      isRecurring: true,
      recurrenceNote: "Monthly",
      createdByEmail: ADMIN_EMAIL,
    });
    console.log(`created meetup series: ${slug}`);
    created += 1;
  }

  console.log(`done — ${created} events created (all DRAFT; set dates/venues then publish + announce).`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
