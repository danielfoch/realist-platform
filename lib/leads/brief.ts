import { resolveActor } from "@/lib/analyses/actor";
import { getBuyBox } from "@/lib/analyses/buyBox";
import { dealKeyFor } from "@/lib/analyses/dealKey";
import { getAnalysis } from "@/lib/analyses/store";
import { describeBuyBox } from "@/lib/analyses/thesis";
import { templateMemo } from "@/lib/underwriting/dealMemo";
import { clampInputs, underwrite } from "@/lib/underwriting/underwriter";
import type { LeadProperty } from "@/lib/db/schema";

/**
 * The showing brief. When someone who underwrote a deal at their desk asks for
 * a showing, an offer or financing, the person who picks it up should already
 * know what the investor concluded, what worries them, and exactly what they
 * want verified in person — that is what makes ONE showing enough. Built on
 * the server from the person's own saved analysis; nothing here is typed into
 * a form, so nothing here can be forged by one.
 */
export async function briefFor(property: LeadProperty | null | undefined): Promise<Record<string, unknown>> {
  const extra: Record<string, unknown> = {};
  try {
    const actor = await resolveActor({ create: false });
    if (!actor) return extra;

    const dealKey = dealKeyFor({ mlsNumber: property?.mlsNumber, address: property?.address });
    const analysis = dealKey ? await getAnalysis(actor.key, dealKey) : null;
    const inputs = analysis ? clampInputs(analysis.inputs) : null;
    if (analysis && inputs) {
      const result = underwrite(inputs);
      const memo = templateMemo(
        { address: analysis.address, city: analysis.city, province: analysis.province, propertyType: analysis.propertyType, rentSourceLabel: analysis.rentSource, rentEdited: analysis.edited.includes("monthlyRent") },
        inputs,
      );
      extra.brief = { headline: memo.headline, verify: memo.beforeYouOffer, watch: memo.watch, call: analysis.verdict };
      // The server's numbers, not the form's: what this person actually underwrote it at.
      extra.numbers = {
        capRate: result.capRate,
        monthlyCashFlow: result.monthlyCashFlow,
        dscr: result.dscr,
        offerPrice: analysis.offerPrice,
        downPaymentPercent: inputs.downPaymentPercent,
      };
    }
    if (actor.user) {
      const box = await getBuyBox(actor.user.id);
      if (box) {
        extra.buyBox = describeBuyBox(box, "agent");
        extra.calls = box.calls;
      }
    }
  } catch (error) {
    console.error("[leads] brief not built:", (error as Error).message);
  }
  return extra;
}
