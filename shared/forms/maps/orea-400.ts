/** Field map only — not the official OREA Form 400 / Schedule A PDF. */
import { field, FORM_COPYRIGHT_NOTE, type FormMap } from "../types";

export const orea400: FormMap = {
  formId: "orea-400",
  title: "Schedule A (generic schedule attachment)",
  board: "OREA",
  jurisdiction: "ON",
  mapVersion: "2026.09.1-draft",
  mapConfidence: "draft",
  copyrightNote: FORM_COPYRIGHT_NOTE,
  fields: [
    field({ key: "schedule_letter", label: "Schedule letter", type: "text", required: false, bind: ["facts.scheduleLetter"] }),
    field({ key: "buyer_1_name", label: "Buyer name", type: "text", party: "buyer", required: false, bind: ["parties.buyer.name"] }),
    field({ key: "seller_1_name", label: "Seller name", type: "text", party: "seller", required: false, bind: ["parties.seller.name"] }),
    field({ key: "property_address", label: "Property address", type: "text", required: true, bind: ["property.address", "property.streetAddress"] }),
    field({ key: "agreement_date", label: "Agreement date", type: "date", required: false, bind: ["facts.agreementDate", "facts.offerDate"] }),
    field({ key: "additional_terms", label: "Additional terms", type: "text", required: false, bind: ["facts.additionalTerms"] }),
    field({ key: "buyer_1_initials", label: "Buyer initials", type: "initials", party: "buyer", required: true }),
    field({ key: "seller_1_initials", label: "Seller initials", type: "initials", party: "seller", required: true }),
  ],
};
