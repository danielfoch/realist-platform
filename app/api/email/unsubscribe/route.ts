import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { recordConsent } from "@/lib/auth/consent";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyUnsubscribeToken } from "@/lib/digest/unsubscribe";

export const dynamic = "force-dynamic";

/**
 * POST — unsubscribe. Two callers: the button on /unsubscribe (a form post) and
 * mail providers' own one-click button (RFC 8058), which sends no cookie and no
 * Origin. So this is authenticated by the signed token alone, and deliberately
 * has no same-origin check. A GET never unsubscribes: scanners fetch every link.
 */
export async function POST(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("u") ?? "";
  const token = request.nextUrl.searchParams.get("t") ?? "";
  // Both callers post a form. A mail provider's body is exactly "List-Unsubscribe=One-Click"
  // and wants a status code; a person pressed our button and wants a page.
  const form = await request.formData().catch(() => null);
  const fromMailProvider = form?.get("List-Unsubscribe") === "One-Click";
  const done = (ok: boolean) =>
    fromMailProvider
      ? NextResponse.json({ ok }, { status: ok ? 200 : 400 })
      : NextResponse.redirect(new URL(`/unsubscribe?${ok ? "done=1" : "error=1"}`, request.url), 303);

  if (!verifyUnsubscribeToken(userId, token)) return done(false);
  try {
    const [member] = await getDb().select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
    if (member) await recordConsent(member.id, false, "unsubscribe_link");
    return done(true);
  } catch (error) {
    console.error("[unsubscribe]", (error as Error).message);
    return done(false);
  }
}

export function GET(request: NextRequest) {
  const page = new URL("/unsubscribe", request.url);
  page.search = request.nextUrl.search;
  return NextResponse.redirect(page);
}
