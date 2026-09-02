/**
 * The two things to do with a finished underwrite: make an offer (routed to
 * Daniel Foch, realtor) or apply for financing (routed to Nick Hill, mortgage
 * broker). Rendered under the VerdictSummary and again at the end of the
 * report, so the ask is there both when the verdict lands and when the reader
 * has finished the reasoning.
 */
import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookCallCta } from "@/components/BookCallCta";
import { track } from "@/lib/analytics";
import { FileSignature, Landmark, PhoneCall } from "lucide-react";
import { fmtMoney, offerPrice } from "./verdict";

export interface MultiplexActionRailProps {
  address: string;
  city?: string;
  province?: string;
  mlsNumber?: string | null;
  underwritingId?: string | null;
  /** Residual land value on the recommended path (null when the comparator said "neither"). */
  maxLandPrice: number | null;
  askingPrice: number | null;
  units: number;
  /** Zoning tier headline, used as the deal verdict on the lead. */
  verdict: string;
  /** Headline MLI numbers for the financing lead. */
  mli?: { points: number; maxLtv: number; loan: number; dscr: number; premiumPct: number } | null;
  /** Distinguishes the top and bottom placements in analytics. */
  placement: "top" | "bottom";
  className?: string;
}

const SOURCE_PAGE = "/tools/multiplex-underwriter";

export function buildOfferHref(p: Pick<MultiplexActionRailProps, "address" | "city" | "province" | "mlsNumber" | "underwritingId" | "maxLandPrice" | "askingPrice">): string {
  const params = new URLSearchParams();
  params.set("address", p.address);
  params.set("city", p.city || "Toronto");
  params.set("province", p.province || "ON");
  const price = offerPrice(p.maxLandPrice, p.askingPrice);
  if (price != null) params.set("price", String(price));
  if (p.mlsNumber) params.set("listingId", p.mlsNumber);
  if (p.underwritingId) params.set("dealId", p.underwritingId);
  return `/offer?${params.toString()}`;
}

export function MultiplexActionRail(props: MultiplexActionRailProps) {
  const { address, city, mlsNumber, underwritingId, maxLandPrice, askingPrice, units, verdict, mli, placement, className } = props;
  const [showAcquisition, setShowAcquisition] = useState(false);
  const offerHref = buildOfferHref(props);
  const price = offerPrice(maxLandPrice, askingPrice);

  const dealSnapshot = {
    address,
    city: city || "Toronto",
    purchasePrice: askingPrice ?? undefined,
    units,
    verdict,
    toolName: "Multiplex Underwriter",
    keyMetrics: {
      ...(maxLandPrice != null ? { maxLandPrice: Math.round(maxLandPrice) } : {}),
      ...(mli
        ? {
            points: mli.points,
            maxLtv: `${Math.round(mli.maxLtv * 100)}%`,
            loan: Math.round(mli.loan),
            dscr: `${mli.dscr.toFixed(2)}x`,
            premium: `${mli.premiumPct.toFixed(2)}%`,
          }
        : {}),
    },
  };

  return (
    <div className={`grid md:grid-cols-2 gap-4 ${className ?? ""}`} data-testid={`multiplex-action-rail-${placement}`}>
      {/* Make an offer */}
      <Card className="border-emerald-500/30 bg-gradient-to-b from-emerald-500/10 to-transparent flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileSignature className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Make an offer
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {maxLandPrice != null ? (
              <>Max land price on the recommended path: <strong className="text-foreground">{fmtMoney(maxLandPrice)}</strong>{askingPrice ? <> (asking {fmtMoney(askingPrice)})</> : null}.</>
            ) : askingPrice ? (
              <>No path cleared its target at this ask — start from the <strong className="text-foreground">{fmtMoney(askingPrice)}</strong> asking price and negotiate down.</>
            ) : (
              <>Draft the offer with the underwrite attached so the price is grounded in the numbers above.</>
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-3 mt-auto">
          <Link
            href={offerHref}
            className="inline-flex w-full h-11 items-center justify-center rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm"
            onClick={() => track({ event: "cta_clicked", cta: "multiplex_make_offer", location: SOURCE_PAGE, destination: offerHref })}
            data-testid="button-make-offer"
          >
            <Landmark className="h-4 w-4 mr-2" /> Draft an offer{price != null ? ` at ${fmtMoney(price)}` : ""}
          </Link>
          <button
            type="button"
            className="w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            onClick={() => {
              setShowAcquisition((v) => !v);
              if (!showAcquisition) track({ event: "cta_clicked", cta: "multiplex_make_offer", location: SOURCE_PAGE, destination: "book-call:acquisition" });
            }}
            data-testid="button-toggle-acquisition"
          >
            {showAcquisition ? "Hide" : "Or have Daniel Foch run the acquisition →"}
          </button>
          {showAcquisition && (
            <BookCallCta
              intent="acquisition"
              sourcePage={SOURCE_PAGE}
              underwritingId={underwritingId ?? undefined}
              dealSnapshot={dealSnapshot}
              title="Have Daniel Foch run this acquisition"
              description="Daniel (broker, Valery Real Estate) will pull comps, structure the offer around the residual land value above, and handle the negotiation."
            />
          )}
        </CardContent>
      </Card>

      {/* Apply for financing */}
      <div
        onClickCapture={(e) => {
          const target = e.target as HTMLElement;
          if (target?.closest?.("button[type='submit']")) {
            track({ event: "cta_clicked", cta: "multiplex_apply_financing", location: SOURCE_PAGE, destination: "book-call:financing" });
          }
        }}
      >
        <BookCallCta
          intent="financing"
          sourcePage={SOURCE_PAGE}
          underwritingId={underwritingId ?? undefined}
          dealSnapshot={dealSnapshot}
          title="Apply for MLI Select financing with Nick Hill"
          description={
            mli
              ? `Nick Hill (mortgage broker) structures CMHC MLI Select takeouts. This underwrite supports about ${fmtMoney(mli.loan)} at ${Math.round(mli.maxLtv * 100)}% LTV and ${mli.points} points — send it to him with your details and he will confirm the terms.`
              : "Nick Hill (mortgage broker) structures CMHC MLI Select and conventional multiplex financing. Send this underwrite with your details and he will come back with terms."
          }
          className="h-full"
        />
        <span className="sr-only"><PhoneCall className="h-4 w-4" /></span>
      </div>
    </div>
  );
}
