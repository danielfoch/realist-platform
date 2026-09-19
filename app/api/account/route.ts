import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { recordConsent } from "@/lib/auth/consent";
import { getCurrentUser, toViewer } from "@/lib/auth/current";
import { UNAVAILABLE, fail, readJson } from "@/lib/auth/http";
import { crossOriginResponse, isSameOrigin } from "@/lib/auth/origin";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable()
    .optional();

const schema = z.object({
  name: optionalText(200),
  phone: optionalText(40),
  city: optionalText(120),
  province: optionalText(60),
  investorFocus: optionalText(600),
  consentMarketing: z.boolean().optional(),
  showOnLeaderboard: z.boolean().optional(),
});

/** What other people can see of a member: the board, the teaser and /u/<id> are all cached. */
const PUBLIC_FIELDS = ["name", "city", "showOnLeaderboard"] as const;

/** Update the signed-in member's profile. Only supplied fields change. */
export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return crossOriginResponse();
  const user = await getCurrentUser();
  if (!user) return fail(401, "Sign in to update your profile.");

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return fail(400, "Some of those fields are too long.");

  try {
    const { consentMarketing, ...profile } = parsed.data;
    const changes = Object.fromEntries(Object.entries(profile).filter(([, value]) => value !== undefined));
    if (Object.keys(changes).length > 0) {
      await getDb()
        .update(users)
        .set({ ...changes, updatedAt: new Date() })
        .where(eq(users.id, user.id));
    }
    if (consentMarketing !== undefined && consentMarketing !== user.consentMarketing) {
      await recordConsent(user.id, consentMarketing, "account_settings");
    }
    // Stepping off the board (or changing the name on it) takes effect now, not when a cache expires.
    if (PUBLIC_FIELDS.some((field) => profile[field] !== undefined && profile[field] !== user[field])) {
      revalidateTag("leaderboard", { expire: 0 });
      revalidatePath(`/u/${user.id}`);
      revalidatePath("/community");
    }
    const [fresh] = await getDb().select().from(users).where(eq(users.id, user.id)).limit(1);
    return Response.json({ ok: true, user: toViewer(fresh) });
  } catch (error) {
    console.error("[account]", (error as Error).message);
    return fail(503, UNAVAILABLE);
  }
}
