import { endSession } from "@/lib/auth/http";
import { crossOriginResponse, isSameOrigin } from "@/lib/auth/origin";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return crossOriginResponse();
  try {
    await endSession();
  } catch {
    // Signing out must always succeed from the person's point of view.
  }
  return Response.json({ ok: true });
}
