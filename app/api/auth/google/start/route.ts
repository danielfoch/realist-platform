import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { GOOGLE_STATE_COOKIE, googleAuthorizeUrl, googleConfigured } from "@/lib/auth/google";
import { safeNextPath } from "@/lib/auth/origin";
import { generateToken } from "@/lib/auth/tokens";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL("/login?error=google_unavailable", request.url));
  }
  // state = random nonce + where to land afterwards; verified against the cookie on return.
  const nonce = generateToken();
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const state = `${nonce}.${Buffer.from(next, "utf8").toString("base64url")}`;
  (await cookies()).set(GOOGLE_STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return NextResponse.redirect(googleAuthorizeUrl(state));
}
