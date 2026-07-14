export type RealistEventSpeaker = {
  id?: string;
  expertUserId?: string | null;
  expertProfileSlug?: string | null;
  name: string;
  title?: string | null;
  company?: string | null;
  bio?: string | null;
  imageUrl?: string | null;
  sortOrder?: number;
};

export type RealistEventTicketType = {
  id?: string;
  name: string;
  description?: string | null;
  priceCents: number;
  currency: string;
  quantityTotal?: number | null;
  quantitySold?: number;
  salesStartAt?: string | null;
  salesEndAt?: string | null;
  isActive: boolean;
};

export type AgendaSection = {
  title: string;
  description?: string;
  time?: string;
};

export type RealistEventPayload = {
  id?: string;
  slug: string;
  title: string;
  shortDescription?: string | null;
  longDescription?: string | null;
  headerImageUrl?: string | null;
  eventType: "IN_PERSON" | "WEBINAR" | "HYBRID";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  startsAt: string;
  endsAt?: string | null;
  timezone: string;
  venueName?: string | null;
  venueAddress?: string | null;
  onlineUrl?: string | null;
  agendaSections: AgendaSection[];
  capacity?: number | null;
  refundPolicy?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  kind?: "flagship" | "meetup";
  city?: string | null;
  isFeatured?: boolean;
  isRecurring?: boolean;
  recurrenceNote?: string | null;
  hostUserId?: string | null;
  minPriceCents?: number | null;
  rsvpCount?: number;
  createdByEmail?: string;
  speakers: RealistEventSpeaker[];
  ticketTypes: RealistEventTicketType[];
  sponsors: RealistEventSponsor[];
};

export type RealistEventSponsor = {
  id?: string;
  name: string;
  logoUrl?: string | null;
  websiteUrl?: string | null;
  tier?: string;
  sortOrder?: number;
};

export type RealistSponsor = {
  id: string;
  name: string;
  logoUrl?: string | null;
  websiteUrl?: string | null;
  blurb?: string | null;
  tier: string;
  isActive: boolean;
  sortOrder: number;
};
