/**
 * Deal memo, narrated. Same doctrine as the multiplex report writer: the engine
 * computes, the model explains. Claude receives the computed memo and every
 * number behind it, and may rewrite the prose — tighter, more specific to the
 * listing's remarks — but any figure it states must already exist in the
 * payload. One retry on a leaked number, then the deterministic memo is served
 * unchanged. Without ANTHROPIC_API_KEY the deterministic memo IS the memo.
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { findLeakedNumbers } from "@/lib/multiplex/reportWriter";
import { templateMemo, type DealMemo, type MemoDeal } from "@/lib/underwriting/dealMemo";
import { underwrite, type UnderwriterInputs } from "@/lib/underwriting/underwriter";

let client: Anthropic | null = null;

export function memoWriterConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const proseSchema = z.object({
  headline: z.string().max(120),
  summary: z.string().max(700),
  working: z.array(z.string().max(400)).min(1).max(6),
  watch: z.array(z.string().max(400)).min(1).max(7),
  beforeYouOffer: z.array(z.string().max(400)).min(3).max(6),
  offerLine: z.string().max(500),
});

const PROSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    summary: { type: "string" },
    working: { type: "array", items: { type: "string" } },
    watch: { type: "array", items: { type: "string" } },
    beforeYouOffer: { type: "array", items: { type: "string" } },
    offerLine: { type: "string" },
  },
  required: ["headline", "summary", "working", "watch", "beforeYouOffer", "offerLine"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You are the investor-realtor voice of realist.ca, a Canadian platform where people underwrite rental properties. A deterministic engine has already computed every figure for one deal, using the assumptions the investor chose, and has drafted a memo from fixed rules. Rewrite that memo the way an agent who has bought a hundred small rentals would say it across a table: specific to this property, direct, useful.

Rules, in order of importance:
1. Use ONLY figures present in the provided data. Never invent, estimate, round differently, or do arithmetic. If you state a number, copy it exactly as it appears.
2. Keep every substantive point from the draft memo. You may reorder, merge and sharpen; you may not drop a risk.
3. If listing remarks are provided, use them: name what they reveal (tenancy, condition, motivation, legal status of units, separate meters) and what they conspicuously don't say. Never treat a remark as verified fact.
4. No hype, no hedging filler, no advice to "consult a professional" as a substitute for saying something. Canadian spelling.
5. This is an underwriting read, not legal, tax or financial advice. Do not recommend whether to buy — say what the numbers show and what must be verified.

Shape: headline (under 10 words), summary (2-3 sentences), working (what's good, 1-5 items), watch (what would worry a lender or a partner, 1-6 items), beforeYouOffer (3-5 diligence steps in order, specific to this property's age and type), offerLine (1-2 sentences on price and conditions, using the solved offer prices given).`;

export interface MemoRequest {
  deal: MemoDeal;
  inputs: UnderwriterInputs;
  /** Public listing remarks, when this is a listing. */
  remarks?: string | null;
}

export async function writeDealMemo(request: MemoRequest): Promise<{ memo: DealMemo; source: "ai" | "rules" }> {
  const draft = templateMemo(request.deal, request.inputs);
  if (!memoWriterConfigured()) return { memo: draft, source: "rules" };

  const payload = {
    deal: request.deal,
    assumptions: request.inputs,
    results: underwrite(request.inputs),
    draftMemo: draft,
    listingRemarks: request.remarks?.slice(0, 3000) ?? null,
  };
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: `Rewrite the memo for this computed deal:\n\n${JSON.stringify(payload)}` },
  ];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      client ??= new Anthropic();
      const response = await client.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 3000,
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        messages,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        output_config: { format: { type: "json_schema", schema: PROSE_JSON_SCHEMA as any } },
      });
      const text = response.content.find((block) => block.type === "text")?.text;
      if (!text) throw new Error("no text block in response");
      const prose = proseSchema.parse(JSON.parse(text));

      const narrative = [prose.headline, prose.summary, ...prose.working, ...prose.watch, ...prose.beforeYouOffer, prose.offerLine].join("\n");
      const leaks = findLeakedNumbers(narrative, payload);
      if (leaks.length === 0) {
        return {
          memo: { ...draft, headline: prose.headline, summary: prose.summary, working: prose.working, watch: prose.watch, beforeYouOffer: prose.beforeYouOffer, offer: { ...draft.offer, line: prose.offerLine } },
          source: "ai",
        };
      }
      console.warn(`[deal-memo] number leak (attempt ${attempt + 1}): ${leaks.join(", ")}`);
      messages.push(
        { role: "assistant", content: text },
        { role: "user", content: `Your memo contained figures not present in the data: ${leaks.join(", ")}. Rewrite it using ONLY numbers that appear in the payload, copied exactly.` },
      );
    } catch (error) {
      console.error(`[deal-memo] generation failed (attempt ${attempt + 1}):`, (error as Error).message);
      break;
    }
  }
  return { memo: draft, source: "rules" };
}
