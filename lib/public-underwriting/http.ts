import { createHash } from "node:crypto";
import { clientIp, takeToken } from "@/lib/auth/throttle";
import { PublicApiError, parseQuery, parseRental, readJson } from "./model";
import { calculateRental, PUBLIC_BASE, SAMPLE, type RentalResult } from "./service";

export const PUBLIC_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id",
  "Access-Control-Expose-Headers": "Retry-After",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};
export const DISCOVERY = {
  name: "Realist public underwriting", apiVersion: "1.0", authentication: "none",
  skill: `${PUBLIC_BASE}/api/underwriting/skill`, openapi: `${PUBLIC_BASE}/api/underwriting/openapi.json`, mcp: `${PUBLIC_BASE}/api/underwriting/mcp`,
  rental: `${PUBLIC_BASE}/api/underwriting`, multiplex: `${PUBLIC_BASE}/api/underwriting/multiplex`,
  sample: `${PUBLIC_BASE}/api/underwriting?${new URLSearchParams(Object.entries(SAMPLE).map(([key, value]) => [key, String(value)]))}`,
  instructions: "Read the skill. Supply price and total monthlyRent as query parameters or JSON; optional assumptions use percentages, not fractions. Results include shareable PNG/SVG/report links. GET supports clients that can only fetch URLs. No account, cookie or API key is needed.",
};
export function reply(value: unknown, status = 200, extra: Record<string, string> = {}) {
  return Response.json(value, { status, headers: { ...PUBLIC_HEADERS, "Cache-Control": "no-store", ...extra } });
}
export function apiError(error: unknown) {
  if (error instanceof PublicApiError) return reply({ success: false, error: { code: error.code, message: error.message } }, error.status, error.status === 429 ? { "Retry-After": "60" } : {});
  console.error("[public-underwriting]", error instanceof Error ? error.name : "Unexpected failure");
  return reply({ success: false, error: { code: "temporarily_unavailable", message: "Underwriting is temporarily unavailable. Retry later." } }, 503);
}
export async function enforceLimit(request: Request, lane = "rental") {
  const client = createHash("sha256").update(clientIp(request)).digest("hex").slice(0, 32);
  const limit = lane === "multiplex" ? 6 : 60;
  if (!await takeToken(`public-underwrite:${lane}:global`, limit * 10, { windowMs: 60000 }) || !await takeToken(`public-underwrite:${lane}:${client}`, limit, { windowMs: 60000 })) {
    throw new PublicApiError(429, "rate_limited", "Underwriting is temporarily at capacity. Retry in a minute.");
  }
}
export async function rentalForRequest(request: Request): Promise<RentalResult> {
  const input = parseRental(request.method === "POST" ? await readJson(request) : parseQuery(request));
  await enforceLimit(request);
  return calculateRental(input);
}
export async function rentalRoute(request: Request) {
  if (request.method === "GET" && !new URL(request.url).search) return reply(DISCOVERY, 200, { "Cache-Control": "public, max-age=300" });
  try { return reply(await rentalForRequest(request)); }
  catch (error) { return apiError(error); }
}
export function options() { return new Response(null, { status: 204, headers: PUBLIC_HEADERS }); }
