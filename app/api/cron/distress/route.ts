import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { unauthorizedCron } from "@/lib/cron";
import { runDistressScan } from "@/lib/distress/scan";

export const maxDuration = 800;

/** Twice-daily motivated-deals scan (see vercel.json). */
export async function GET(request: NextRequest) {
  const unauthorized = unauthorizedCron(request);
  if (unauthorized) return unauthorized;

  try {
    const data = await runDistressScan();
    revalidatePath("/deals");
    return NextResponse.json({
      ok: true,
      qualified: data.listings.length,
      totalScanned: data.totalDdfScanned,
      failedTerms: data.failedTermCount,
    });
  } catch (error) {
    console.error("[cron/distress]", error);
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}
