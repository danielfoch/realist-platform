import { UNDERWRITING_OPENAPI } from "@/lib/public-underwriting/openapi";
import { reply, options } from "@/lib/public-underwriting/http";
export function GET() { return reply(UNDERWRITING_OPENAPI, 200, { "Cache-Control": "public, max-age=300" }); }
export const OPTIONS = options;
