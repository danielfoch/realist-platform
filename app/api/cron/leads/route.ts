import { NextRequest, NextResponse } from "next/server";
import { unauthorizedCron } from "@/lib/cron";
import { deliverDue } from "@/lib/leads/outbox";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Retries whatever the inline attempt couldn't deliver. Counts only — no contact details in logs. */
export async function GET(request: NextRequest) {
  const denied = unauthorizedCron(request);
  if (denied) return denied;
  try {
    return NextResponse.json({ ok: true, ...(await deliverDue({ limit: 50 })) });
  } catch (error) {
    console.error("[cron/leads]", (error as Error).message);
    return NextResponse.json({ ok: false, error: "outbox unavailable" }, { status: 503 });
  }
}
