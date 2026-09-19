import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getCurrentSession } from "@/lib/auth/current";
import { UNAVAILABLE, fail, readJson } from "@/lib/auth/http";
import { crossOriginResponse, isSameOrigin } from "@/lib/auth/origin";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/passwords";

const schema = z.object({
  current: z.string().max(200).optional(),
  next: z.string().max(200),
});

/** How long after opening an emailed link a password may be set without the old one. */
const FRESH_LINK_WINDOW_MS = 30 * 60 * 1000;

/**
 * Set or change the password. Knowing the current password is required unless
 * there is none yet, or the person just proved they own the inbox by signing
 * in through an emailed link — which is the "forgot my password" path.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return crossOriginResponse();
  const session = await getCurrentSession();
  if (!session) return fail(401, "Sign in to change your password.");

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return fail(400, "Enter a new password.");
  const problem = passwordProblem(parsed.data.next);
  if (problem) return fail(400, problem);

  const { user } = session;
  const freshLink =
    session.via === "magic_link" && Date.now() - session.openedAt.getTime() < FRESH_LINK_WINDOW_MS;
  if (user.passwordHash && !freshLink) {
    const ok = await verifyPassword(parsed.data.current ?? "", user.passwordHash);
    if (!ok) return fail(401, "Your current password doesn't match.");
  }

  try {
    await getDb()
      .update(users)
      .set({ passwordHash: await hashPassword(parsed.data.next), updatedAt: new Date() })
      .where(eq(users.id, user.id));
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[account/password]", (error as Error).message);
    return fail(503, UNAVAILABLE);
  }
}
