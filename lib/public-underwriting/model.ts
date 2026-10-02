import { z } from "zod";
import { INPUT_LIMITS, type UnderwriterField } from "@/lib/underwriting/underwriter";

const integerFields = new Set(["units", "holdPeriodYears", "amortizationYears"]);
export const numericFields = Object.keys(INPUT_LIMITS) as UnderwriterField[];
const fields = Object.fromEntries(numericFields.map(field => {
  const [min, max] = INPUT_LIMITS[field];
  let schema = z.number().finite().min(min).max(max);
  if (integerFields.has(field)) schema = schema.int();
  if (field === "monthlyRent") schema = schema.positive();
  return [field, field === "price" || field === "monthlyRent" ? schema : schema.optional()];
})) as unknown as Record<UnderwriterField, z.ZodType<number | undefined>>;

export const rentalSchema = z.object({
  ...fields,
  price: z.number().finite().min(INPUT_LIMITS.price[0]).max(INPUT_LIMITS.price[1]),
  monthlyRent: z.number().finite().positive().max(INPUT_LIMITS.monthlyRent[1]),
  address: z.string().trim().min(2).max(240).optional(),
  city: z.string().trim().min(2).max(80).optional(),
  province: z.string().trim().min(2).max(40).optional(),
  // Snapshots retain which of the numeric inputs were model assumptions.
  assumedFields: z.string().max(600).optional(),
}).strict().superRefine((input, ctx) => {
  if (input.assumedFields && input.assumedFields.split(",").some(field => !numericFields.includes(field as UnderwriterField) || ["price", "monthlyRent"].includes(field))) {
    ctx.addIssue({ code: "custom", path: ["assumedFields"], message: "Unknown or required assumed field." });
  }
});
export type RentalRequest = z.infer<typeof rentalSchema>;
export const offerTargetSchema = z.object({
  metric: z.enum(["cash_flow", "cash_on_cash", "cap_rate", "dscr"]),
  value: z.number().finite().min(0).max(1_000_000),
}).strict();

export class PublicApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export function parseQuery(request: Request, numbers: readonly string[] = numericFields, booleans: readonly string[] = []): Record<string, unknown> {
  if (request.url.length > 8000) throw new PublicApiError(414, "url_too_long", "Use POST for a request larger than 8 KB.");
  const params = new URL(request.url).searchParams;
  const out: Record<string, unknown> = {};
  for (const [key, value] of params) {
    if (params.getAll(key).length !== 1) throw new PublicApiError(400, "invalid_query", `Duplicate parameter: ${key}`);
    if (numbers.includes(key)) {
      if (!value.trim() || !/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) throw new PublicApiError(400, "invalid_query", `${key} must be a number.`);
      out[key] = Number(value);
    } else if (booleans.includes(key)) {
      if (!["true", "false"].includes(value)) throw new PublicApiError(400, "invalid_query", `${key} must be true or false.`);
      out[key] = value === "true";
    } else out[key] = value;
  }
  return out;
}

export async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new PublicApiError(415, "invalid_content_type", "Send application/json.");
  const reader = request.body?.getReader();
  if (!reader) throw new PublicApiError(400, "invalid_json", "Send a JSON body.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 32768) throw new PublicApiError(413, "body_too_large", "Request body exceeds 32 KB.");
      chunks.push(value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { throw new PublicApiError(400, "invalid_json", "Send a valid JSON body."); }
  } finally { await reader.cancel(); }
}

export function parseRental(value: unknown): RentalRequest {
  const parsed = rentalSchema.safeParse(value);
  if (!parsed.success) throw new PublicApiError(400, "invalid_input", parsed.error.issues.map(issue => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; "));
  return parsed.data;
}
