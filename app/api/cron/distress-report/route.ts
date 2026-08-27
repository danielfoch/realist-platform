import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { unauthorizedCron } from "@/lib/cron";
import { runMonthlyDistressReport } from "@/lib/distress/report";

export const maxDuration = 800;

/** Monthly distress report: snapshots + published report (2nd of the month). */
export async function GET(request: NextRequest) {
  const unauthorized = unauthorizedCron(request);
  if (unauthorized) return unauthorized;

  try {
    const result = await runMonthlyDistressReport();
    revalidatePath("/deals");
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/distress-report]", error);
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}
