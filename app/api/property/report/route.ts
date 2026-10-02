import { propertyGet, PUBLIC_HEADERS } from "@/lib/property/route";
import { renderReport } from "@/lib/property/report";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function GET(request: Request) {
  const response = await propertyGet(request);
  const result = await response.clone().json();
  if (!response.ok || result.success !== true) return response;
  return new Response(renderReport(result), { headers: { ...PUBLIC_HEADERS, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'" } });
}
export function OPTIONS() { return new Response(null, { status: 204, headers: PUBLIC_HEADERS }); }
