import { z } from "zod";
import { UNAVAILABLE, beginSession, fail, readJson } from "@/lib/auth/http";
import { crossOriginResponse, isSameOrigin } from "@/lib/auth/origin";
import { hashPassword, passwordProblem } from "@/lib/auth/passwords";
import { clientIp, isThrottled, recordFailure } from "@/lib/auth/throttle";
import { toViewer } from "@/lib/auth/current";
import { recordConsent } from "@/lib/auth/consent";
import { createUser, findUserByEmail } from "@/lib/auth/users";
import { announceNewMember } from "@/lib/leads/member";

const schema = z.object({
  email: z.email().max(254),
  password: z.string().max(200),
  name: z.string().trim().max(200).optional(),
  consentMarketing: z.boolean().default(false),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return crossOriginResponse();
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return fail(400, "Enter a valid email and a password.");

  const problem = passwordProblem(parsed.data.password);
  if (problem) return fail(400, problem);

  const ipKey = `signup-ip:${clientIp(request)}`;
  if (await isThrottled(ipKey)) return fail(429, "Too many attempts. Try again in a few minutes.");

  try {
    if (await findUserByEmail(parsed.data.email)) {
      await recordFailure(ipKey);
      return fail(409, "An account with that email already exists. Sign in instead.");
    }
    const user = await createUser({
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
      name: parsed.data.name,
      consentMarketing: parsed.data.consentMarketing,
      consentSource: "signup",
    });
    if (parsed.data.consentMarketing) await recordConsent(user.id, true, "signup");
    await beginSession(user.id, request);
    await announceNewMember(user, "password", request);
    return Response.json({ ok: true, user: toViewer(user) });
  } catch (error) {
    console.error("[auth/signup]", (error as Error).message);
    return fail(503, UNAVAILABLE);
  }
}
