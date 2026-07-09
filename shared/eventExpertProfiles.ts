import type { ExpertCategory } from "./contributorReputation";

export type EventExpertRelatedEvent = {
  eventId?: string;
  title: string;
  slug: string;
  path?: string;
  startsAt?: string | null;
  timezone?: string | null;
  speakerTitle?: string | null;
  role: "speaker" | "moderator" | "panelist";
};

export type EventExpertProfile = {
  userId: string;
  slug: string;
  name: string;
  category: ExpertCategory;
  companyName: string | null;
  title?: string | null;
  bio: string | null;
  headshotUrl: string | null;
  serviceAreas: string[];
  socialLinks: { website?: string; linkedin?: string; instagram?: string } | null;
  publicEmail: string | null;
  phone: string | null;
  relatedEvents: EventExpertRelatedEvent[];
};

const TORONTO_MULTIPLEX_EVENT: Omit<EventExpertRelatedEvent, "speakerTitle"> = {
  title: "Unpacking Multiplexes: Toronto",
  slug: "unpacking-multiplexes-toronto",
  path: "/community/events/unpacking-multiplexes-toronto",
  startsAt: "2026-09-15T21:00:00.000Z",
  timezone: "America/Toronto",
  role: "speaker",
};

export const EVENT_EXPERT_PROFILES: EventExpertProfile[] = [
  {
    userId: "aled-ab-iorwerth",
    slug: "aled-ab-iorwerth",
    name: "Aled Ab Iorwerth",
    category: "other",
    companyName: "CMHC",
    title: "Deputy Chief Economist",
    bio: "Leading housing economics research at Canada's national housing agency, focused on affordability, supply, and policy.",
    headshotUrl: null,
    serviceAreas: ["Canada"],
    socialLinks: null,
    publicEmail: null,
    phone: null,
    relatedEvents: [{ ...TORONTO_MULTIPLEX_EVENT, speakerTitle: "Deputy Chief Economist" }],
  },
  {
    userId: "josh-findlay",
    slug: "josh-findlay",
    name: "Josh Findlay",
    category: "mortgage",
    companyName: "BLD Financial",
    title: "Principal",
    bio: "Specialist in construction financing and CMHC MLI Select programs for multiplex and purpose-built rental projects.",
    headshotUrl: null,
    serviceAreas: ["Ontario", "British Columbia"],
    socialLinks: null,
    publicEmail: null,
    phone: null,
    relatedEvents: [{ ...TORONTO_MULTIPLEX_EVENT, speakerTitle: "Principal" }],
  },
  {
    userId: "noam-hazan",
    slug: "noam-hazan",
    name: "Noam Hazan",
    category: "architecture",
    companyName: "Noam Hazan Design Studio",
    title: "Principal Architect",
    bio: "Award-winning architect with deep expertise in multiplex design, infill development, and cost-effective construction detailing.",
    headshotUrl: null,
    serviceAreas: ["Toronto", "GTA"],
    socialLinks: null,
    publicEmail: null,
    phone: null,
    relatedEvents: [{ ...TORONTO_MULTIPLEX_EVENT, speakerTitle: "Principal Architect" }],
  },
  {
    userId: "ryan-valente",
    slug: "ryan-valente",
    name: "Ryan Valente",
    category: "investor",
    companyName: "Reside Properties",
    title: "Founder",
    bio: "Active multiplex developer and investor building and operating multi-unit residential properties across the GTA.",
    headshotUrl: null,
    serviceAreas: ["Toronto", "GTA"],
    socialLinks: null,
    publicEmail: null,
    phone: null,
    relatedEvents: [{ ...TORONTO_MULTIPLEX_EVENT, speakerTitle: "Founder" }],
  },
  {
    userId: "hooman-tabesh",
    slug: "hooman-tabesh",
    name: "Hooman Tabesh",
    category: "investor",
    companyName: "Alliance REIT",
    title: "Founder & CEO",
    bio: "Over 20 years of experience developing and operating residential rental real estate, focusing on premium boutique multifamily residences across the Toronto core.",
    headshotUrl: null,
    serviceAreas: ["Toronto"],
    socialLinks: null,
    publicEmail: null,
    phone: null,
    relatedEvents: [{ ...TORONTO_MULTIPLEX_EVENT, speakerTitle: "Founder & CEO" }],
  },
  {
    userId: "ben-singer",
    slug: "ben-singer",
    name: "Ben Singer",
    category: "legal",
    companyName: "SR Law",
    title: "Lawyer",
    bio: "Commercial real estate lawyer with experience in acquisitions, dispositions, financing, and a focus on condominium and subdivision development.",
    headshotUrl: null,
    serviceAreas: ["Ontario"],
    socialLinks: null,
    publicEmail: null,
    phone: null,
    relatedEvents: [{ ...TORONTO_MULTIPLEX_EVENT, speakerTitle: "Lawyer" }],
  },
];

export function getEventExpertProfile(identifier: string): EventExpertProfile | undefined {
  return EVENT_EXPERT_PROFILES.find((profile) => profile.slug === identifier || profile.userId === identifier);
}

export function expertProfilePath(identifier?: string | null): string | null {
  return identifier ? `/experts/${identifier}` : null;
}
