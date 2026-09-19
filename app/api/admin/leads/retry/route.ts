import { isAdmin } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/auth/current";
import { crossOriginResponse, isSameOrigin } from "@/lib/auth/origin";
import { deliverDue, expeditePending, requeueFailed } from "@/lib/leads/outbox";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST — put every failed delivery back in line and work the outbox now. Admins only. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return crossOriginResponse();
  if (!isAdmin(await getCurrentUser())) return Response.json({ ok: false, error: "Not found." }, { status: 404 });
  try {
    const requeued = await requeueFailed();
    // Leads parked while a destination had no credentials shouldn't wait out their timer.
    await expeditePending();
    const summary = await deliverDue({ limit: 100 });
    return Response.json({ ok: true, requeued, ...summary });
  } catch (error) {
    console.error("[admin/leads/retry]", (error as Error).message);
    return Response.json({ ok: false, error: "The outbox couldn't be reached." }, { status: 503 });
  }
}
