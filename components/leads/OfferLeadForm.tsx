"use client";

import { useSearchParams } from "next/navigation";
import { LeadForm } from "./LeadForm";

/**
 * The offer-funnel form. Arriving from a listing or an underwrite, the
 * property rides along in the query string (?mls=&address=&price=&city=
 * &province=&want=showing) so the person never retypes it and the team sees
 * exactly which deal the conversation is about.
 */
export function OfferLeadForm() {
  const params = useSearchParams();
  const address = params.get("address") ?? params.get("property");
  const mls = params.get("mls");
  const price = Number(params.get("price"));
  const wantsShowing = params.get("want") === "showing";
  const property =
    address || mls
      ? {
          address: address?.slice(0, 300) ?? null,
          mlsNumber: mls?.slice(0, 40) ?? null,
          price: isFinite(price) && price > 0 ? price : null,
          url: mls ? `/listings/${encodeURIComponent(mls)}` : null,
        }
      : undefined;

  return (
    <div>
      {property && (
        <p className="mb-4 rounded-[3px] border border-hairline bg-paper px-3 py-2 text-xs leading-relaxed text-ink-soft">
          About <span className="font-medium text-ink">{property.address ?? `MLS® ${property.mlsNumber}`}</span>
          {property.mlsNumber && property.address ? ` · MLS® ${property.mlsNumber}` : ""}
        </p>
      )}
      <LeadForm
        kind={wantsShowing ? "showing" : "offer"}
        ask={["name", "phone", "city", "interest", "timeline", "message"]}
        property={property}
        defaultCity={params.get("city")}
        defaultProvince={params.get("province")}
        partnerConsent
        marketingLabel="Keep me on the list for events and research between deals."
        messagePlaceholder="Budget, timeline, the deal you're circling, a listing from Realist…"
        submitLabel={wantsShowing ? "Book my showing" : "Send it — let's talk"}
        successMessage="Got it. A human will be in touch within a business day."
      />
    </div>
  );
}
