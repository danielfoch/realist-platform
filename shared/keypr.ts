import { z } from "zod";

export const keyprConsentVersion = "realist-keypr-cashback-v1";
export const keyprConsentText = "I agree that Realist.ca may share my name, email and phone number with Keypr, its cashback partner, so they can contact me about this request.";
export const keyprOfferText = "Keep 80% of the buyer’s agent commission, paid at closing. That’s about $20,000 on a $1M Toronto home, assuming a 2.5% buyer’s agent commission.";
export const keyprServiceText = "Find your home. Get help with showings, offer strategy, negotiation and closing from RECO-licensed REALTORS®. Nothing owed unless you buy.";
export const keyprEstimateNote = "Estimate based on a 2.5% buyer’s agent commission. Actual cashback depends on the commission offered and your agreement with Keypr.";

export function normalizeKeyprPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return value.trim();
}
export const keyprContactSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name").max(128),
  lastName: z.string().trim().min(1, "Enter your last name").max(128),
  email: z.string().trim().email("Enter a valid email address").max(254),
  phone: z.string().trim().refine(value => /^\+[1-9]\d{7,14}$/.test(normalizeKeyprPhone(value)), "Enter a valid phone number"),
  consent: z.boolean().refine(value => value === true, "Please agree to share your request with our cashback partner"),
});
export type KeyprContact = z.infer<typeof keyprContactSchema>;

// Only the Ontario cashback offer carries this partner disclosure. Never route
// mortgage, general inquiry, partner recruitment, or out-of-province leads.
export function isKeyprCashbackRequest(body: Record<string, unknown>): boolean {
  return body.formTag === "cashback_request" &&
    (body.province === "ON" || body.province === "Ontario") &&
    body.country !== "usa";
}
