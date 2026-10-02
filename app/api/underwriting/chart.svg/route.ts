import { apiError, rentalForRequest, PUBLIC_HEADERS, options } from "@/lib/public-underwriting/http";
import { rentalSvg } from "@/lib/public-underwriting/visuals";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try { return new Response(rentalSvg(await rentalForRequest(request)), { headers: { ...PUBLIC_HEADERS, "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox" } }); }
  catch (error) { return apiError(error); }
}
export const OPTIONS = options;
