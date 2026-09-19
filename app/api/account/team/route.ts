import { eq } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current";
import { UNAVAILABLE, fail, readJson } from "@/lib/auth/http";
import { crossOriginResponse, isSameOrigin } from "@/lib/auth/origin";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { POWER_TEAM_ROLES } from "@/lib/team/roles";

const schema = z.object({ team: z.record(z.string().max(40), z.enum(["have", "need"])) });

/** PUT /api/account/team — replace the member's power-team checklist. */
export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return crossOriginResponse();
  const user = await getCurrentUser();
  if (!user) return fail(401, "Sign in to keep a checklist.");
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return fail(400, "That checklist couldn't be read.");

  const known = new Set(POWER_TEAM_ROLES.map((role) => role.key));
  const team = Object.fromEntries(Object.entries(parsed.data.team).filter(([key]) => known.has(key)));
  try {
    await getDb().update(users).set({ powerTeam: team, updatedAt: new Date() }).where(eq(users.id, user.id));
    return Response.json({ ok: true, team });
  } catch (error) {
    console.error("[account/team]", (error as Error).message);
    return fail(503, UNAVAILABLE);
  }
}
