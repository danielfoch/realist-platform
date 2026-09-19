import { z } from "zod";
import { resolveActor } from "@/lib/analyses/actor";
import { dealKeyFor } from "@/lib/analyses/dealKey";
import { sharePathFor } from "@/lib/analyses/store";
import { crossOriginResponse, isSameOrigin } from "@/lib/auth/origin";

export const dynamic = "force-dynamic";

const schema = z.object({ mlsNumber: z.string().trim().max(40).nullish(), address: z.string().trim().max(300).nullish() });

/** POST — the link to a read-only page of ONE of the caller's own analyses. Sharing is always the owner's act. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return crossOriginResponse();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  const dealKey = parsed.success ? dealKeyFor(parsed.data) : null;
  if (!dealKey) return Response.json({ ok: false, error: "Nothing to share yet." }, { status: 400 });
  try {
    const actor = await resolveActor({ create: false });
    const path = actor ? await sharePathFor(actor.key, dealKey) : null;
    if (!path) return Response.json({ ok: false, error: "Change a number or make your call first — then there's an analysis to share." }, { status: 404 });
    return Response.json({ ok: true, path });
  } catch (error) {
    console.error("[analyses/share]", (error as Error).message);
    return Response.json({ ok: false, error: "Couldn't make a link just now." }, { status: 503 });
  }
}
