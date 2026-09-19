import { NextRequest, NextResponse } from "next/server";
import { rebuildLearnedAssumptions } from "@/lib/analyses/learn";
import { unauthorizedCron } from "@/lib/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Nightly: turn the day's analyses into tomorrow's starting values. */
export async function GET(request: NextRequest) {
  const denied = unauthorizedCron(request);
  if (denied) return denied;
  try {
    return NextResponse.json({ ok: true, ...(await rebuildLearnedAssumptions()) });
  } catch (error) {
    console.error("[cron/learn]", (error as Error).message);
    return NextResponse.json({ ok: false, error: "learning unavailable" }, { status: 503 });
  }
}
