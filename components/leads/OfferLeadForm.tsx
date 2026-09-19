"use client";

import { useSearchParams } from "next/navigation";
import { LeadForm } from "./LeadForm";

/**
 * The offer-funnel form. Arriving from a listing or an underwrite, the deal
 * AND the person's numbers ride along in the query string (?mls=&address=
 * &price=&city=&province=&cap=&cf=&dscr=&offer=&down=&want=showing|financing),
 * so nobody retypes anything and the team sees exactly which deal — and what
 * the person made of it — before they pick up the phone.
 */

type Want = "offer" | "showing" | "financing";

const COPY: Record<Want, { submit: string; success: string; placeholder: string }> = {
  offer: {
    submit: "Send it — let's talk",
    success: "Got it. A human will be in touch within a business day.",
    placeholder: "Budget, timeline, the deal you're circling, a listing from Realist…",
  },
  showing: {
    submit: "Book my showing",
    success: "Got it. We'll line up the showing and confirm a time with you.",
    placeholder: "When you're free, and anything you want checked while we're there…",
  },
  financing: {
    submit: "Talk financing",
    success: "Got it. A mortgage broker who works with investors will be in touch within a business day.",
    placeholder: "How you're buying (personal or corporate), other properties you hold, your timeline…",
  },
};

function num(value: string | null): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return isFinite(parsed) ? parsed : null;
}

export function OfferLeadForm() {
  const params = useSearchParams();
  const wanted = params.get("want");
  const want: Want = wanted === "showing" || wanted === "financing" ? wanted : "offer";
  const address = params.get("address") ?? params.get("property");
  const mls = params.get("mls");
  const price = num(params.get("price"));
  const property =
    address || mls
      ? {
          address: address?.slice(0, 300) ?? null,
          mlsNumber: mls?.slice(0, 40) ?? null,
          price: price && price > 0 ? price : null,
          url: mls ? `/listings/${encodeURIComponent(mls)}` : null,
        }
      : undefined;

  const numbers = {
    capRate: num(params.get("cap")),
    monthlyCashFlow: num(params.get("cf")),
    dscr: num(params.get("dscr")),
    offerPrice: num(params.get("offer")),
    downPaymentPercent: num(params.get("down")),
  };
  const hasNumbers = Object.values(numbers).some((value) => value != null);

  const subject = property?.address ?? (property?.mlsNumber ? `MLS® ${property.mlsNumber}` : null);
  const heading =
    want === "showing" ? (subject ? `Book one showing of ${subject}` : "Book a showing")
    : want === "financing" ? (subject ? `Talk financing on ${subject}` : "Talk to a mortgage broker")
    : subject ? `Make an offer on ${subject}` : null;

  return (
    <div>
      {heading && <h3 className="font-display mb-3 text-xl font-semibold leading-snug tracking-tight">{heading}</h3>}
      {property && (
        <p className="mb-4 rounded-[3px] border border-hairline bg-paper px-3 py-2 text-xs leading-relaxed text-ink-soft">
          About <span className="font-medium text-ink">{property.address ?? `MLS® ${property.mlsNumber}`}</span>
          {property.mlsNumber && property.address ? ` · MLS® ${property.mlsNumber}` : ""}
          {hasNumbers ? " — your numbers come with it." : ""}
        </p>
      )}
      <LeadForm
        key={want}
        kind={want}
        // With the deal attached we already know where and what: ask for the person, a number to call, and when.
        ask={property ? ["name", "phone", "timeline", "message"] : want === "financing" ? ["name", "phone", "city", "province", "timeline", "message"] : ["name", "phone", "city", "interest", "timeline", "message"]}
        requirePhone
        property={property}
        context={hasNumbers ? { numbers } : undefined}
        defaultCity={params.get("city")}
        defaultProvince={params.get("province")}
        // The brokerage-partner handoff is about buying, never about a mortgage.
        partnerConsent={want !== "financing"}
        marketingLabel="Keep me on the list for events and research between deals."
        messagePlaceholder={COPY[want].placeholder}
        submitLabel={COPY[want].submit}
        successMessage={COPY[want].success}
      />
    </div>
  );
}
