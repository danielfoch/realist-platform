import { getLearnedDefaults } from "@/lib/analyses/learn";

export const dynamic = "force-dynamic";

/** GET /api/analyses/defaults?city=&province= — what members in that market underwrite with, where there's evidence. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const city = params.get("city")?.slice(0, 120) ?? null;
  const province = params.get("province")?.slice(0, 60) ?? null;
  const learned = await getLearnedDefaults(city, province);
  return Response.json({ learned }, { headers: { "Cache-Control": "public, max-age=300" } });
}
