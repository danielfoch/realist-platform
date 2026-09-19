import { z } from "zod";
import { UNAVAILABLE, beginSession, fail, readJson } from "@/lib/auth/http";
import { crossOriginResponse, isSameOrigin } from "@/lib/auth/origin";
import { verifyPassword } from "@/lib/auth/passwords";
import { clearFailures, clientIp, isThrottled, recordFailure } from "@/lib/auth/throttle";
import { toViewer } from "@/lib/auth/current";
import { findUserByEmail, normalizeEmail } from "@/lib/auth/users";

const schema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(200),
});

const WRONG = "That email and password don't match.";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return crossOriginResponse();
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return fail(400, "Enter your email and password.");

  const emailKey = `login:${normalizeEmail(parsed.data.email)}`;
  const ipKey = `login-ip:${clientIp(request)}`;
  if ((await isThrottled(emailKey)) || (await isThrottled(ipKey))) {
    return fail(429, "Too many attempts. Try again in a few minutes, or use a sign-in link.");
  }

  try {
    const user = await findUserByEmail(parsed.data.email);
    // Always runs a bcrypt comparison, account or not, so timing says nothing.
    const matches = await verifyPassword(parsed.data.password, user?.passwordHash);
    if (!user || !matches) {
      await Promise.all([recordFailure(emailKey), recordFailure(ipKey)]);
      // Accounts that came over without a password (Google or link sign-in).
      if (user && !user.passwordHash) {
        return fail(401, "This account signs in with Google or an emailed link — no password is set.");
      }
      return fail(401, WRONG);
    }
    await clearFailures(emailKey);
    await beginSession(user.id, request);
    return Response.json({ ok: true, user: toViewer(user) });
  } catch (error) {
    console.error("[auth/login]", (error as Error).message);
    return fail(503, UNAVAILABLE);
  }
}
