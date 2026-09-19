/**
 * Deterministic form fill. Only copies values present on the structured
 * input. Missing legal facts stay blank and are listed in missingFields.
 */
import { getFormMap } from "./registry";
import type {
  FormFacts,
  FormFillResult,
  FormMap,
  FormPartyInput,
  FormsFillInput,
} from "./types";

export class FormFillError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "FormFillError";
  }
}

type Scalar = string | number | boolean;

function present(value: unknown): value is Scalar {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  return false;
}

function partyName(party: FormPartyInput | undefined | null): string | null {
  if (!party) return null;
  if (present(party.name)) return String(party.name).trim();
  const first = typeof party.firstName === "string" ? party.firstName.trim() : "";
  const last = typeof party.lastName === "string" ? party.lastName.trim() : "";
  const combined = `${first} ${last}`.trim();
  return combined || null;
}

function contactByRole(input: FormsFillInput, role: string): FormPartyInput | undefined {
  return input.contacts?.find((contact) => contact.role === role);
}

function resolveParty(input: FormsFillInput, role: keyof NonNullable<FormsFillInput["parties"]>): FormPartyInput | undefined {
  return input.parties?.[role] ?? contactByRole(input, role === "buyerBroker" ? "buyer_broker"
    : role === "sellerBroker" ? "seller_broker"
      : role === "buyerLawyer" ? "buyer_lawyer"
        : role === "sellerLawyer" ? "seller_lawyer"
          : role);
}

function lookupPath(input: FormsFillInput, path: string): unknown {
  const buyer = resolveParty(input, "buyer");
  const seller = resolveParty(input, "seller");
  const buyerBroker = resolveParty(input, "buyerBroker");
  const sellerBroker = resolveParty(input, "sellerBroker");
  const buyerLawyer = resolveParty(input, "buyerLawyer");
  const sellerLawyer = resolveParty(input, "sellerLawyer");
  const facts: FormFacts = input.facts ?? {};

  const table: Record<string, unknown> = {
    "property.address": input.property?.address,
    "property.streetAddress": input.property?.streetAddress,
    "property.city": input.property?.city,
    "property.province": input.property?.province,
    "property.postalCode": input.property?.postalCode,
    "listing.mlsNumber": input.listing?.mlsNumber,
    "listing.listPrice": input.listing?.listPrice,
    "deal.mlsNumber": input.deal?.mlsNumber,
    "facts.purchasePrice": facts.purchasePrice,
    "facts.depositAmount": facts.depositAmount,
    "facts.depositHeldBy": facts.depositHeldBy,
    "facts.listPrice": facts.listPrice,
    "facts.offerDate": facts.offerDate,
    "facts.irrevocableDate": facts.irrevocableDate,
    "facts.closingDate": facts.closingDate,
    "facts.agreementDate": facts.agreementDate,
    "facts.requisitionDate": facts.requisitionDate,
    "facts.listingStartDate": facts.listingStartDate,
    "facts.listingExpiryDate": facts.listingExpiryDate,
    "facts.commission": facts.commission,
    "facts.cooperatingCommission": facts.cooperatingCommission,
    "facts.amendmentTerms": facts.amendmentTerms,
    "facts.noticeType": facts.noticeType,
    "facts.conditionLabel": facts.conditionLabel,
    "facts.additionalTerms": facts.additionalTerms,
    "facts.inclusions": facts.inclusions,
    "facts.exclusions": facts.exclusions,
    "facts.scheduleLetter": facts.scheduleLetter,
    "facts.representationType": facts.representationType,
    "parties.buyer.name": partyName(buyer),
    "parties.buyer.email": buyer?.email,
    "parties.buyer.phone": buyer?.phone,
    "parties.seller.name": partyName(seller),
    "parties.seller.email": seller?.email,
    "parties.seller.phone": seller?.phone,
    "parties.buyerBroker.name": partyName(buyerBroker),
    "parties.buyerBroker.brokerage": buyerBroker?.brokerage ?? buyerBroker?.company,
    "parties.sellerBroker.name": partyName(sellerBroker),
    "parties.sellerBroker.brokerage": sellerBroker?.brokerage ?? sellerBroker?.company,
    "parties.buyerLawyer.name": partyName(buyerLawyer),
    "parties.sellerLawyer.name": partyName(sellerLawyer),
  };
  return table[path];
}

function overrideValue(input: FormsFillInput, key: string): unknown {
  if (input.overrides && key in input.overrides) return input.overrides[key];
  if (input.fields && key in input.fields) return input.fields[key];
  return undefined;
}

function asScalar(value: unknown): Scalar | null {
  if (!present(value)) return null;
  return value;
}

export function fillForm(input: FormsFillInput): FormFillResult {
  const map = getFormMap(input.formId);
  if (!map) {
    throw new FormFillError("unknown_form", `Unknown formId: ${input.formId}`);
  }
  return fillFormMap(map, input);
}

export function fillFormMap(map: FormMap, input: FormsFillInput): FormFillResult {
  const fields: FormFillResult["fields"] = [];
  const values: FormFillResult["values"] = {};
  const missingFields: FormFillResult["missingFields"] = [];
  const warnings: string[] = [
    map.copyrightNote,
    `mapConfidence=${map.mapConfidence}: apply only to a licensed blank; do not treat this as a completed legal form.`,
  ];

  for (const def of map.fields) {
    const fromOverride = asScalar(overrideValue(input, def.key));
    if (fromOverride != null) {
      fields.push({ key: def.key, value: fromOverride, source: "override" });
      values[def.key] = fromOverride;
      continue;
    }

    if (def.type === "signature") {
      fields.push({ key: def.key, value: null, source: null });
      missingFields.push({ key: def.key, reason: "signature_not_auto_filled" });
      continue;
    }

    let resolved: Scalar | null = null;
    let source: string | null = null;
    for (const path of def.bind ?? []) {
      const hit = asScalar(lookupPath(input, path));
      if (hit != null) {
        resolved = hit;
        source = path;
        break;
      }
    }

    if (resolved != null) {
      fields.push({ key: def.key, value: resolved, source });
      values[def.key] = resolved;
    } else {
      fields.push({ key: def.key, value: null, source: null });
      if (def.required) {
        missingFields.push({
          key: def.key,
          reason: def.type === "initials" ? "initials_not_auto_filled" : "missing_structured_input",
        });
      }
    }
  }

  if (map.mapConfidence === "draft") {
    warnings.push("Draft field map: keys are a best-effort layout, not a licensed form reproduction.");
  }

  const requiredNonSig = map.fields.filter((def) => def.required && def.type !== "signature");
  const filledRequired = requiredNonSig.filter((def) => present(values[def.key]));
  const completenessPct = requiredNonSig.length === 0
    ? 100
    : Math.round((filledRequired.length / requiredNonSig.length) * 100);

  return {
    formId: map.formId,
    mapVersion: map.mapVersion,
    mapConfidence: map.mapConfidence,
    fields,
    values,
    missingFields,
    warnings,
    completenessPct,
    draft: true,
    specialistId: "realist.forms",
  };
}
