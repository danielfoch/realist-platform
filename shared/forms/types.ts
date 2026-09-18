/**
 * Realist form field maps — metadata only.
 *
 * Official OREA/board PDF bodies are copyrighted and are NOT stored here.
 * Licensed users apply the JSON/XFDF-like `values` payload to their own
 * blank WEBForms / TransactionDesk copy. Never invent legal facts.
 */
import { z } from "zod";
import {
  dealSchema,
  listingSchema,
  propertySchema,
} from "../agentSpine";

export const FORM_FIELD_TYPES = [
  "text",
  "number",
  "currency",
  "date",
  "checkbox",
  "initials",
  "signature",
] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

export const FORM_PARTIES = [
  "buyer",
  "seller",
  "buyer_broker",
  "seller_broker",
  "buyer_lawyer",
  "seller_lawyer",
  "both",
] as const;
export type FormParty = (typeof FORM_PARTIES)[number];

export const MAP_CONFIDENCE = ["draft", "stable"] as const;
export type MapConfidence = (typeof MAP_CONFIDENCE)[number];

export interface FormFieldDef {
  key: string;
  label: string;
  type: FormFieldType;
  party?: FormParty;
  required: boolean;
  pageHint?: string;
  /** Structured input paths. First provided value wins. Never a default fact. */
  bind?: string[];
}

export interface FormMap {
  formId: string;
  title: string;
  board: "OREA";
  jurisdiction: "ON";
  mapVersion: string;
  mapConfidence: MapConfidence;
  copyrightNote: string;
  fields: FormFieldDef[];
}

export const FORM_COPYRIGHT_NOTE =
  "Field map only. Do not redistribute official board PDFs. Apply values to a licensed blank.";

export function field(def: FormFieldDef): FormFieldDef {
  return def;
}

export const formPartySchema = z.object({
  name: z.string().optional().nullable(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  phone: z.string().optional().nullable(),
  brokerage: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  role: z.enum([
    "buyer",
    "seller",
    "buyer_broker",
    "seller_broker",
    "buyer_lawyer",
    "seller_lawyer",
    "other",
  ]).optional(),
});
export type FormPartyInput = z.infer<typeof formPartySchema>;

/** Legal facts the caller must supply. The engine never invents these. */
export const formFactsSchema = z.object({
  purchasePrice: z.number().nonnegative().optional(),
  depositAmount: z.number().nonnegative().optional(),
  depositHeldBy: z.string().optional(),
  listPrice: z.number().nonnegative().optional(),
  offerDate: z.string().optional(),
  irrevocableDate: z.string().optional(),
  closingDate: z.string().optional(),
  agreementDate: z.string().optional(),
  requisitionDate: z.string().optional(),
  listingStartDate: z.string().optional(),
  listingExpiryDate: z.string().optional(),
  commission: z.string().optional(),
  cooperatingCommission: z.string().optional(),
  amendmentTerms: z.string().optional(),
  noticeType: z.string().optional(),
  conditionLabel: z.string().optional(),
  additionalTerms: z.string().optional(),
  inclusions: z.string().optional(),
  exclusions: z.string().optional(),
  scheduleLetter: z.string().optional(),
  representationType: z.string().optional(),
});
export type FormFacts = z.infer<typeof formFactsSchema>;

export const formsFillInputSchema = z.object({
  formId: z.string().trim().min(1),
  dealId: z.string().min(1).optional(),
  deal: dealSchema.partial().optional(),
  property: propertySchema.partial().optional(),
  listing: listingSchema.partial().optional(),
  contacts: z.array(formPartySchema).optional(),
  parties: z.object({
    buyer: formPartySchema.optional(),
    seller: formPartySchema.optional(),
    buyerBroker: formPartySchema.optional(),
    sellerBroker: formPartySchema.optional(),
    buyerLawyer: formPartySchema.optional(),
    sellerLawyer: formPartySchema.optional(),
  }).optional(),
  facts: formFactsSchema.optional(),
  overrides: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  /** @deprecated P0 alias — treated as overrides */
  fields: z.record(z.unknown()).optional(),
  locale: z.string().optional(),
});
export type FormsFillInput = z.infer<typeof formsFillInputSchema>;

export const filledFieldSchema = z.object({
  key: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]).nullable(),
  source: z.string().nullable(),
});

export const missingFieldSchema = z.object({
  key: z.string(),
  reason: z.string(),
});

export const formFillResultSchema = z.object({
  formId: z.string(),
  mapVersion: z.string(),
  mapConfidence: z.enum(MAP_CONFIDENCE),
  fields: z.array(filledFieldSchema),
  values: z.record(z.union([z.string(), z.number(), z.boolean()])),
  missingFields: z.array(missingFieldSchema),
  warnings: z.array(z.string()),
  completenessPct: z.number().min(0).max(100),
  draft: z.literal(true),
  specialistId: z.literal("realist.forms"),
});
export type FormFillResult = z.infer<typeof formFillResultSchema>;

export const formSummarySchema = z.object({
  formId: z.string(),
  title: z.string(),
  board: z.literal("OREA"),
  jurisdiction: z.literal("ON"),
  mapVersion: z.string(),
  mapConfidence: z.enum(MAP_CONFIDENCE),
  fieldCount: z.number(),
  copyrightNote: z.string(),
});
export type FormSummary = z.infer<typeof formSummarySchema>;
