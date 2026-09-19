import { z } from "zod";
import { aiAllowance } from "@/lib/ai/allowance";
import { askRealist, askRealistConfigured } from "@/lib/ai/askRealist";
import { getBuyBox } from "@/lib/analyses/buyBox";
import { getDealConsensus } from "@/lib/analyses/community";
import { dealKeyFor } from "@/lib/analyses/dealKey";
import { getMarketDecisionLine } from "@/lib/analyses/learn";
import { describeBuyBox } from "@/lib/analyses/thesis";
import { getCurrentUser } from "@/lib/auth/current";
import { crossOriginResponse, isSameOrigin } from "@/lib/auth/origin";
import { getListingSeoByMls } from "@/lib/ddf/listingSeo";
import { marketAggregates } from "@/lib/ddf/yieldSearch";
import { clampInputs } from "@/lib/underwriting/underwriter";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const schema = z.object({
  question: z.string().trim().min(3).max(600),
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
  // An earlier answer can be long; it is trimmed before it reaches the model, never a reason to refuse the next question.
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(12_000) })).max(8).optional(),
});

/**
 * POST /api/deals/ask — a member's question about the deal on their screen.
 * Everything the model is told about the market, the listing and the member is
 * gathered HERE from our own records; the browser supplies only the question
 * and the numbers currently in the underwriter.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return crossOriginResponse();
  if (!askRealistConfigured()) return Response.json({ ok: false, error: "Ask Realist isn't switched on yet." }, { status: 503 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "Create a free account to ask about this deal." }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  const inputs = parsed.success ? clampInputs(parsed.data.inputs) : null;
  if (!parsed.success || !inputs) return Response.json({ ok: false, error: "That question couldn't be read." }, { status: 400 });

  const allowance = await aiAllowance(user);
  if (!allowance.ok) return Response.json({ ok: false, error: allowance.error }, { status: allowance.status });

  const { deal, mlsNumber, question, history } = parsed.data;
  const dealKey = dealKeyFor({ mlsNumber, address: deal.address });
  try {
    const [listing, decisionLine, consensus, box, market] = await Promise.all([
      mlsNumber ? getListingSeoByMls(mlsNumber).catch(() => null) : null,
      getMarketDecisionLine(deal.city, deal.province),
      dealKey ? getDealConsensus(dealKey).catch(() => null) : null,
      getBuyBox(user.id).catch(() => null),
      marketAggregates(deal.city).catch(() => null),
    ]);
    const result = await askRealist(
      question,
      {
        deal: { ...deal, mlsNumber },
        inputs,
        remarks: listing?.publicRemarks ?? null,
        decisionLine,
        consensus: consensus?.medians ? { analysts: consensus.analysts, medianRent: consensus.medians.monthlyRent, medianCapRate: consensus.medians.capRate } : null,
        buyBox: box ? describeBuyBox(box) : null,
        market,
      },
      { history },
    );
    return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[deals/ask]", (error as Error).message);
    return Response.json({ ok: false, error: "Realist couldn't answer just now. Your numbers and the memo are unaffected." }, { status: 502 });
  }
}
