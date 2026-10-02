import { createHash } from "node:crypto";
import { clientIp, takeToken } from "@/lib/auth/throttle";
import { requestSchema } from "./model";
import { enrichProperty } from "./service";

export const PUBLIC_HEADERS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Expose-Headers": "Retry-After", "X-Content-Type-Options": "nosniff" };
export const DOC = {
  name: "Homies property enrichment", apiVersion: "1.0", authentication: "none",
  starterPrompt: "Enrich a property for me.",
  instructions: "Ask for a Canadian civic address and city if missing, then GET /api/property with URL-encoded address. Optional city, province, lat and lng. Read field availability and source information in layers.",
  example: "/api/property?address=15%20Deermeade%20Pl%20SE%2C%20Calgary%2C%20AB",
  coverage: "/api/property/coverage", openapi: "/api/property/openapi.json", skill: "/api/property/skill",
};
function reply(data: unknown, status = 200, headers: Record<string, string> = {}) { return Response.json(data, { status, headers: { ...PUBLIC_HEADERS, "Cache-Control": "no-store", ...headers } }); }
export async function propertyGet(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  if (![...params].length) return reply(DOC, 200, { "Cache-Control": "public, max-age=300" });
  const input: Record<string, unknown> = {};
  for (const [key, value] of params) {
    if (params.getAll(key).length !== 1) return reply({ success: false, error: { code: "invalid_query", message: `Duplicate parameter: ${key}` } }, 400);
    input[key] = ["lat", "lng"].includes(key) && value.trim() ? Number(value) : value;
  }
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return reply({ success: false, error: { code: "invalid_query", message: "Supply a Canadian civic address and city, or a valid coordinate pair.", issues: parsed.error.issues.map(i => ({ field: i.path.join("."), message: i.message })) } }, 400);
  const ip = createHash("sha256").update(clientIp(request)).digest("hex").slice(0, 32);
  const day = new Date().toISOString().slice(0, 10);
  if (!(await takeToken(`property:global:${day}`, 120, { windowMs: 60_000 }))) return reply({ success: false, error: { code: "rate_limited", message: "Property lookup is temporarily at capacity. Retry in a minute." } }, 429, { "Retry-After": "60" });
  if (!(await takeToken(`property:client:${day}:${ip}`, 30, { windowMs: 60_000 }))) return reply({ success: false, error: { code: "rate_limited", message: "Too many property lookups. Retry in a minute." } }, 429, { "Retry-After": "60" });
  try {
    const result = await enrichProperty(parsed.data);
    return reply(result, result.success ? 200 : 422);
  } catch {
    return reply({ success: false, error: { code: "lookup_unavailable", message: "Property enrichment is temporarily unavailable." } }, 503);
  }
}
