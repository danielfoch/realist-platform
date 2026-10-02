import { PROPERTY_SKILL } from "@/lib/property/skill";
import { PUBLIC_HEADERS } from "@/lib/property/route";
export function GET() { return new Response(PROPERTY_SKILL, { headers: { ...PUBLIC_HEADERS, "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "public, max-age=300" } }); }
