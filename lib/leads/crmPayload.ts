import type { Lead, LeadKind } from "@/lib/db/schema";
import { isE164, splitName } from "./phone";
import { provinceCode } from "./routing";
import { roleLabel } from "@/lib/team/roles";

/**
 * What the CRM sees. Tag names follow the ones the previous app sent, so the
 * smart lists and workflows already built in GoHighLevel keep matching.
 */

const KIND_TAGS: Record<LeadKind, string[]> = {
  signup: ["realist-user", "new-signup"],
  event_invites: ["event_invites"],
  meetup_rsvp: ["meetup_rsvp"],
  offer: ["offer_request", "cashback_request"],
  showing: ["showing_request"],
  financing: ["financing_consultation"],
  power_team: ["power_team_request"],
  underwriting_help: ["underwriting_help"],
  pro_application: ["expert_application"],
  first_underwrite: ["deal-analyzed"],
  active_underwriter: ["deal-analyzed", "active-underwriter"],
};

/** Human label, used in the team email subject and the CRM note. */
export const KIND_LABELS: Record<LeadKind, string> = {
  signup: "New member",
  event_invites: "Event invites",
  meetup_rsvp: "Meetup RSVP",
  offer: "Offer request",
  showing: "Showing request",
  financing: "Financing request",
  power_team: "Power team intro",
  underwriting_help: "Underwriting help",
  pro_application: "Professional application",
  first_underwrite: "First underwrite",
  active_underwriter: "Active underwriter",
};

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function crmTags(lead: Pick<Lead, "kind" | "city" | "province" | "routing" | "intent" | "context" | "createdAt">): string[] {
  const tags = new Set<string>(["realist.ca", ...KIND_TAGS[lead.kind]]);
  const month = lead.createdAt.toISOString().slice(0, 7);
  if (lead.kind === "signup") tags.add(`signup-${month}`);

  const city = lead.city ? slug(lead.city) : "";
  if (city) tags.add(`city-${city}`);
  if (city && lead.kind === "meetup_rsvp") tags.add(`MEETUP_${city.replace(/-/g, "_").toUpperCase()}`);
  const province = provinceCode(lead.province);
  if (province) tags.add(`LEAD_${province}`);

  tags.add(`intent-${lead.intent}`);
  tags.add(`route-${lead.routing.replace(/_/g, "-")}`);

  const roles = Array.isArray(lead.context?.roles) ? (lead.context.roles as unknown[]) : [];
  const prefix = lead.kind === "pro_application" ? "pro" : "needs";
  for (const role of roles) tags.add(`${prefix}-${slug(String(role))}`);
  return [...tags];
}

export interface CrmContact {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  city?: string;
  state?: string;
  country: "CA";
  source: "realist.ca";
}

export function crmContact(lead: Pick<Lead, "email" | "name" | "phone" | "city" | "province">): CrmContact {
  const { first, last } = splitName(lead.name, lead.email);
  const state = provinceCode(lead.province);
  return {
    email: lead.email,
    firstName: first,
    lastName: last,
    // A malformed number makes the CRM reject the whole contact; send it only when clean.
    ...(isE164(lead.phone) ? { phone: lead.phone as string } : {}),
    ...(lead.city ? { city: lead.city } : {}),
    ...(state ? { state } : {}),
    country: "CA",
    source: "realist.ca",
  };
}

function money(value: unknown): string | null {
  if (typeof value !== "number" || !isFinite(value)) return null;
  const rounded = Math.round(value);
  return `${rounded < 0 ? "-" : ""}$${Math.abs(rounded).toLocaleString("en-CA")}`;
}

/** Plain-text lines describing the lead — the CRM note and the email body share them. */
export function leadSummaryLines(lead: Lead): string[] {
  const lines: string[] = [`${KIND_LABELS[lead.kind]} via realist.ca`];
  const property = lead.property;
  if (property?.address || property?.mlsNumber) {
    const price = money(property.price);
    lines.push(
      `Property: ${[property.address, property.mlsNumber ? `MLS® ${property.mlsNumber}` : null, price].filter(Boolean).join(" · ")}`,
    );
    if (property.url) lines.push(`Listing: ${property.url}`);
  }
  if (lead.city || lead.province) lines.push(`Market: ${[lead.city, lead.province].filter(Boolean).join(", ")}`);
  if (lead.phone && !isE164(lead.phone)) lines.push(`Phone (as typed): ${lead.phone}`);

  const context = lead.context ?? {};
  const roles = Array.isArray(context.roles) ? (context.roles as unknown[]).map(String) : [];
  if (roles.length) lines.push(`${lead.kind === "pro_application" ? "Works as" : "Looking for"}: ${roles.map(roleLabel).join(", ")}`);
  if (typeof context.company === "string") lines.push(`Company: ${context.company}`);
  if (typeof context.licence === "string") lines.push(`Licence: ${context.licence}`);
  if (typeof context.eventTitle === "string") lines.push(`Event: ${context.eventTitle}`);
  if (typeof context.interest === "string") lines.push(`Buying: ${context.interest}`);
  if (typeof context.timeline === "string") lines.push(`Timeline: ${context.timeline}`);
  if (typeof context.dealsAnalyzed === "number") lines.push(`Deals underwritten: ${context.dealsAnalyzed}`);

  const numbers = context.numbers as Record<string, unknown> | undefined;
  if (numbers && typeof numbers === "object") {
    const parts = [
      typeof numbers.capRate === "number" ? `cap ${numbers.capRate.toFixed(1)}%` : null,
      typeof numbers.monthlyCashFlow === "number" ? `cash flow ${money(numbers.monthlyCashFlow)}/mo` : null,
      typeof numbers.dscr === "number" ? `DSCR ${numbers.dscr.toFixed(2)}` : null,
      typeof numbers.offerPrice === "number" ? `target offer ${money(numbers.offerPrice)}` : null,
    ].filter(Boolean);
    if (parts.length) lines.push(`Their numbers: ${parts.join(" · ")}`);
  }

  if (lead.message) lines.push(`Message: ${lead.message}`);
  lines.push(`Routing: ${lead.routing.replace(/_/g, " ")} · intent ${lead.intent}`);
  lines.push(`Marketing consent: ${lead.consentMarketing ? "yes" : "no"}${lead.consentPartner ? " · partner handoff consent: yes" : ""}`);
  if (lead.pagePath) lines.push(`Page: ${lead.pagePath}`);
  return lines;
}

/** Body for the inbound-webhook path — the field names the previous app's workflows read. */
export function webhookPayload(lead: Lead): Record<string, unknown> {
  const contact = crmContact(lead);
  return {
    email: contact.email,
    firstName: contact.firstName,
    lastName: contact.lastName,
    fullName: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
    phone: contact.phone ?? lead.phone ?? "",
    city: lead.city ?? "",
    province: provinceCode(lead.province) ?? "",
    consent: lead.consentMarketing,
    leadSource: `realist_${lead.kind}`,
    formTag: KIND_TAGS[lead.kind][0],
    tags: crmTags(lead),
    source: "realist.ca",
    leadId: lead.id,
    intent: lead.intent,
    routing: lead.routing,
    propertyAddress: lead.property?.address ?? "",
    propertyMls: lead.property?.mlsNumber ?? "",
    propertyUrl: lead.property?.url ?? "",
    message: lead.message ?? "",
    summary: leadSummaryLines(lead).join("\n"),
  };
}
