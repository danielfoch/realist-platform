/** Field map only — not the official OREA Form 101 PDF. */
import { field, FORM_COPYRIGHT_NOTE, type FormMap } from "../types";

export const orea101: FormMap = {
  formId: "orea-101",
  title: "Amendment to Agreement of Purchase and Sale",
  board: "OREA",
  jurisdiction: "ON",
  mapVersion: "2026.09.1-draft",
  mapConfidence: "draft",
  copyrightNote: FORM_COPYRIGHT_NOTE,
  fields: [
    field({ key: "buyer_1_name", label: "Buyer name", type: "text", party: "buyer", required: true, bind: ["parties.buyer.name"] }),
    field({ key: "seller_1_name", label: "Seller name", type: "text", party: "seller", required: true, bind: ["parties.seller.name"] }),
    field({ key: "property_address", label: "Property address", type: "text", required: true, bind: ["property.address", "property.streetAddress"] }),
    field({ key: "property_city", label: "City", type: "text", required: false, bind: ["property.city"] }),
    field({ key: "agreement_date", label: "Original agreement date", type: "date", required: false, bind: ["facts.agreementDate", "facts.offerDate"] }),
    field({ key: "purchase_price", label: "Amended purchase price", type: "currency", required: false, bind: ["facts.purchasePrice"] }),
    field({ key: "completion_date", label: "Amended completion date", type: "date", required: false, bind: ["facts.closingDate"] }),
    field({ key: "amendment_terms", label: "Amendment terms", type: "text", required: false, bind: ["facts.amendmentTerms"] }),
    field({ key: "buyer_1_initials", label: "Buyer initials", type: "initials", party: "buyer", required: true }),
    field({ key: "seller_1_initials", label: "Seller initials", type: "initials", party: "seller", required: true }),
    field({ key: "buyer_1_signature", label: "Buyer signature", type: "signature", party: "buyer", required: true }),
    field({ key: "seller_1_signature", label: "Seller signature", type: "signature", party: "seller", required: true }),
  ],
};
