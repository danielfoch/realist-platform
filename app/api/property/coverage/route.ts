import { coverage } from "@/lib/property/service";
import { PUBLIC_HEADERS } from "@/lib/property/route";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET() { return Response.json(await coverage(), { headers: { ...PUBLIC_HEADERS, "Cache-Control": "public, max-age=300" } }); }
