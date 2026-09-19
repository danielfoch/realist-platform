import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { beginSession } from "@/lib/auth/http";
import { consumeMagicLink } from "@/lib/auth/magicLink";
import { crossOriginResponse, isSameOrigin, safeNextPath } from "@/lib/auth/origin";
import { createUser, findUserByEmail } from "@/lib/auth/users";

export const dynamic = "force-dynamic";

/** Reading a link never signs anyone in; it only leads to the confirm button. */
export function GET(request: NextRequest) {
  const confirm = new URL("/login/confirm", request.url);
  confirm.search = request.nextUrl.search;
  return NextResponse.redirect(confirm);
}

/** The confirm page's form posts here. This is the only place a link token is spent. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return crossOriginResponse();
  const form = await request.formData().catch(() => null);
  const token = String(form?.get("token") ?? "");
  const next = safeNextPath(String(form?.get("next") ?? ""));
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);

  try {
    const email = token ? await consumeMagicLink(token) : null;
    if (!email) return to("/login?error=link_expired");

    // Opening the link proves the address.
    let user = await findUserByEmail(email);
    if (!user) {
      user = await createUser({ email, emailVerified: true });
    } else if (!user.emailVerifiedAt) {
      await getDb().update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, user.id));
    }
    await beginSession(user.id, request, "magic_link");
    return to(next);
  } catch (error) {
    console.error("[auth/magic/verify]", (error as Error).message);
    return to("/login?error=unavailable");
  }
}
