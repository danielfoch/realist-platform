import { propertyGet, PUBLIC_HEADERS } from "@/lib/property/route";
export const runtime = "nodejs";
export const maxDuration = 60;
export const GET = propertyGet;
export function OPTIONS() { return new Response(null, { status: 204, headers: PUBLIC_HEADERS }); }
