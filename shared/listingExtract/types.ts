import { z } from "zod";
import {
  extractedListingSchema,
  extractedPropertySchema,
  listingExtractInputSchema,
} from "../agentSpine";

export { listingExtractInputSchema };
export const listingExtractInput = listingExtractInputSchema;
export type ListingExtractInput = z.infer<typeof listingExtractInputSchema>;

export const EXTRACT_ERROR_CODES = [
  "unsupported_host",
  "extract_failed",
  "listing_not_found",
  "blocked_or_login_wall",
  "invalid_url",
] as const;
export type ExtractErrorCode = (typeof EXTRACT_ERROR_CODES)[number];

export const extractResultSchema = z.object({
  property: extractedPropertySchema.default({}),
  listing: extractedListingSchema.default({}),
  confidence: z.enum(["high", "medium", "low", "none"]),
  missingFields: z.array(z.string()),
  warnings: z.array(z.string()),
  sourceHost: z.string().nullable(),
  extractorId: z.string(),
  raw: z.record(z.unknown()).optional(),
});
export type ExtractResult = z.infer<typeof extractResultSchema>;

export interface ExtractContext {
  url: string | null;
  host: string | null;
  html: string;
  hints: {
    country?: string;
    currency?: string;
    mlsNumber?: string;
  };
}

export interface ListingExtractor {
  id: string;
  hosts: string[];
  countries?: string[];
  implemented: boolean;
  extract(ctx: ExtractContext): ExtractResult;
}

export class ListingExtractError extends Error {
  constructor(
    public code: ExtractErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ListingExtractError";
  }
}
