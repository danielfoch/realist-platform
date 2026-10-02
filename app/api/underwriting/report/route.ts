import { apiError, rentalForRequest, PUBLIC_HEADERS, options } from "@/lib/public-underwriting/http";
import { rentalReport } from "@/lib/public-underwriting/visuals";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try { return new Response(rentalReport(await rentalForRequest(request)), { headers: { ...PUBLIC_HEADERS, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors 'self'" } }); }
  catch (error) { return apiError(error); }
}
export const OPTIONS = options;
