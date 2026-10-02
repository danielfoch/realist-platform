import { PROPERTY_OPENAPI } from "@/lib/property/openapi";
import { PUBLIC_HEADERS } from "@/lib/property/route";
export function GET() { return Response.json(PROPERTY_OPENAPI, { headers: { ...PUBLIC_HEADERS, "Cache-Control": "public, max-age=300" } }); }
