import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { GOOGLE_STATE_COOKIE, exchangeGoogleCode, googleConfigured } from "@/lib/auth/google";
import { beginSession } from "@/lib/auth/http";
import { safeNextPath } from "@/lib/auth/origin";
import { createUser, findUserByEmail, findUserByGoogleId } from "@/lib/auth/users";
import { announceNewMember } from "@/lib/leads/member";

export const dynamic = "force-dynamic";

function fail(request: NextRequest, code: string) {
  return NextResponse.redirect(new URL(`/login?error=${code}`, request.url));
}

export async function GET(request: NextRequest) {
  if (!googleConfigured()) return fail(request, "google_unavailable");

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state") ?? "";
  const [nonce, encodedNext] = state.split(".");
  const store = await cookies();
  const expected = store.get(GOOGLE_STATE_COOKIE)?.value;
  store.delete(GOOGLE_STATE_COOKIE);
  if (!code || !nonce || !expected || nonce !== expected) return fail(request, "google_state");

  let next = "/account";
  try {
    next = safeNextPath(Buffer.from(encodedNext ?? "", "base64url").toString("utf8"));
  } catch {
    // Keep the default landing page.
  }

  try {
    const profile = await exchangeGoogleCode(code);

    // 1) Already linked. 2) Same verified email — link it (this is how
    // accounts migrated from the legacy app pick their Google login back up).
    // 3) New person.
    let user = await findUserByGoogleId(profile.sub);
    if (!user && profile.emailVerified) {
      const byEmail = await findUserByEmail(profile.email);
      if (byEmail) {
        await getDb()
          .update(users)
          .set({
            googleId: profile.sub,
            emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(),
            updatedAt: new Date(),
          })
          .where(eq(users.id, byEmail.id));
        user = byEmail;
      }
    }
    if (!user) {
      if (!profile.emailVerified) return fail(request, "google_unverified");
      user = await createUser({
        email: profile.email,
        googleId: profile.sub,
        name: profile.name,
        emailVerified: true,
      });
      await announceNewMember(user, "google", request);
    }

    await beginSession(user.id, request, "google");
    return NextResponse.redirect(new URL(next, request.url));
  } catch (error) {
    console.error("[auth/google]", (error as Error).message);
    return fail(request, "google_failed");
  }
}
