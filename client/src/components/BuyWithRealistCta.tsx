import { ArrowRight, HandCoins, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { buildOfferFunnelHref, type OfferFunnelContext } from "@shared/offerFunnel";

interface BuyWithRealistCtaProps {
  context: OfferFunnelContext;
  compact?: boolean;
  className?: string;
}

export function BuyWithRealistCta({ context, compact = false, className = "" }: BuyWithRealistCtaProps) {
  const href = buildOfferFunnelHref(context);
  const trackClick = () => track({
    event: "cta_clicked",
    cta: "buy_this_property",
    location: context.source || "listing",
    destination: href,
  });

  if (compact) {
    return (
      <Button asChild className={className} data-testid="button-buy-this-property-compact">
        <Link href={href} onClick={trackClick}>
          Buy this property <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    );
  }

  return (
    <div className={`rounded-xl border border-primary/30 bg-primary/5 p-4 ${className}`} data-testid="cta-buy-with-realist">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <HandCoins className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="font-bold">Want to buy this one?</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Send the listing and underwriting to our team. Eligible represented buyers may receive 50% of the cooperating commission back.
          </p>
        </div>
      </div>
      <Button asChild className="mt-4 w-full" data-testid="button-buy-this-property">
        <Link href={href} onClick={trackClick}>
          <ShieldCheck className="mr-2 h-4 w-4" />
          Pressure-test it and start an offer
        </Link>
      </Button>
      <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
        Subject to representation, brokerage, transaction and eligibility terms. No rebate is guaranteed until confirmed in writing.
      </p>
    </div>
  );
}
