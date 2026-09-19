import { resolveActor } from "@/lib/analyses/actor";
import { getBuyBox } from "@/lib/analyses/buyBox";
import { dealKeyFor } from "@/lib/analyses/dealKey";
import { getAnalysis } from "@/lib/analyses/store";
import { describeBuyBox } from "@/lib/analyses/thesis";
import { templateMemo } from "@/lib/underwriting/dealMemo";
import { clampInputs, underwrite } from "@/lib/underwriting/underwriter";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import type { LeadProperty } from "@/lib/db/schema";

/**
 * The price we stand behind. For a listing that is the crawl's list price, not
 * the form's; for an off-market deal it is the person's own figure, kept only
 * when it is a plausible purchase price.
 */
export async function trustedProperty<T extends LeadProperty>(property: T | null | undefined): Promise<T | null | undefined> {
  if (!property) return property;
  const typed = typeof property.price === "number" && property.price >= 10_000 && property.price <= 100_000_000 ? property.price : null;
  if (!property.mlsNumber) return { ...property, price: typed };
  try {
    const result = await getDb().execute(sql`
      SELECT list_price FROM ddf_listing_snapshots
      WHERE upper(mls_number) = ${property.mlsNumber.trim().toUpperCase()} AND list_price > 0
      ORDER BY captured_at DESC LIMIT 1`);
    const rows = (Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? [])) as Array<{ list_price: number | string }>;
    const listed = rows[0] ? Number(rows[0].list_price) : null;
    return { ...property, price: listed && isFinite(listed) ? listed : typed };
  } catch {
    return { ...property, price: typed };
  }
}

/**
 * The showing brief. When someone who underwrote a deal at their desk asks for
 * a showing, an offer or financing, the person who picks it up should already
 * know what the investor concluded, what worries them, and exactly what they
 * want verified in person — that is what makes ONE showing enough. Built on
 * the server from the person's own saved analysis; nothing here is typed into
 * a form, so nothing here can be forged by one.
 */
export async function briefFor(property: LeadProperty | null | undefined, email?: string | null): Promise<Record<string, unknown>> {
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
    // A member's profile belongs on their own CRM contact — not on whoever's address was typed into the form.
    if (actor.user && (!email || actor.user.email.toLowerCase() === email.trim().toLowerCase())) {
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
