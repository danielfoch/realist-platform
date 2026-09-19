import { z } from "zod";
import { aiAllowance } from "@/lib/ai/allowance";
import { memoWriterConfigured, writeDealMemo } from "@/lib/ai/dealMemoWriter";
import { getCurrentUser } from "@/lib/auth/current";
import { crossOriginResponse, isSameOrigin } from "@/lib/auth/origin";
import { getListingSeoByMls } from "@/lib/ddf/listingSeo";
import { clampInputs } from "@/lib/underwriting/underwriter";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  mlsNumber: z.string().trim().max(40).nullish(),
  deal: z.object({
    address: z.string().max(300).nullish(),
    city: z.string().max(120).nullish(),
    province: z.string().max(60).nullish(),
    propertyType: z.string().max(80).nullish(),
    yearBuilt: z.number().int().min(1700).max(2100).nullish(),
    rentSourceLabel: z.string().max(40).nullish(),
    rentEdited: z.boolean().optional(),
    taxFromListing: z.boolean().optional(),
  }),
  inputs: z.record(z.string().max(40), z.number()),
});

/**
 * POST /api/analyses/memo — the AI-written version of the deal memo. The
 * rules-based memo is computed in the browser and needs no request; this only
 * exists for the narrated one, so it is throttled per visitor.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return crossOriginResponse();
  if (!memoWriterConfigured()) return Response.json({ ok: false, error: "AI memos aren't switched on yet." }, { status: 503 });
  // The rules-based memo is free to everyone and needs no request. The written-up one costs money per call.
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "Create a free account for the AI write-up." }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  const inputs = parsed.success ? clampInputs(parsed.data.inputs) : null;
  if (!parsed.success || !inputs) return Response.json({ ok: false, error: "Those numbers couldn't be read." }, { status: 400 });

  const allowance = await aiAllowance(user);
  if (!allowance.ok) return Response.json({ ok: false, error: allowance.error }, { status: allowance.status });

  // Remarks come from our own copy of the listing, never from the browser.
  let remarks: string | null = null;
  if (parsed.data.mlsNumber) {
    remarks = (await getListingSeoByMls(parsed.data.mlsNumber).catch(() => null))?.publicRemarks ?? null;
  }
  const { memo, source } = await writeDealMemo({ deal: parsed.data.deal, inputs, remarks });
  return Response.json({ ok: true, memo, source }, { headers: { "Cache-Control": "no-store" } });
}
