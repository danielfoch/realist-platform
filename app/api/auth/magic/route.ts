import { z } from "zod";
import { fail, readJson } from "@/lib/auth/http";
import { publicOrigin, sendMagicLink } from "@/lib/auth/magicLink";
import { crossOriginResponse, isSameOrigin, safeNextPath } from "@/lib/auth/origin";
import { clientIp, isThrottled, recordFailure } from "@/lib/auth/throttle";
import { normalizeEmail } from "@/lib/auth/users";
import { emailConfigured } from "@/lib/email";

const schema = z.object({
  email: z.email().max(254),
  next: z.string().max(300).optional(),
});

/**
 * Email a one-time sign-in link. The response is the same whether or not an
 * account exists; a first-time address simply becomes an account when the
 * link is opened.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return crossOriginResponse();
  if (!emailConfigured()) return fail(503, "Email sign-in isn't switched on yet. Use your password or Google.");

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return fail(400, "Enter a valid email address.");

  // Every request counts: this endpoint sends mail, so it is rate limited outright.
  const emailKey = `magic:${normalizeEmail(parsed.data.email)}`;
  const ipKey = `magic-ip:${clientIp(request)}`;
  if ((await isThrottled(emailKey)) || (await isThrottled(ipKey))) {
    return fail(429, "We've sent several links already. Check your inbox, or try again in a few minutes.");
  }
  await Promise.all([recordFailure(emailKey), recordFailure(ipKey)]);

  try {
    await sendMagicLink({
      email: parsed.data.email,
      next: safeNextPath(parsed.data.next),
      origin: publicOrigin(request),
    });
  } catch (error) {
    console.error("[auth/magic]", (error as Error).message);
    return fail(503, "We couldn't send the email just now. Please try again in a minute.");
  }
  return Response.json({ ok: true });
}
