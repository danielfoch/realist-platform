import { NextRequest, NextResponse } from "next/server";

/**
 * Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`. Manual triggers
 * (curl, GitHub Actions) use the same header. Reject everything else.
 */
export function unauthorizedCron(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  }
  const header = request.headers.get("authorization");
  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
