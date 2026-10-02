import { UNDERWRITING_SKILL } from "@/lib/public-underwriting/skill";
import { PUBLIC_HEADERS, options } from "@/lib/public-underwriting/http";
export function GET() { return new Response(UNDERWRITING_SKILL, { headers: { ...PUBLIC_HEADERS, "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "public, max-age=300" } }); }
export const OPTIONS = options;
