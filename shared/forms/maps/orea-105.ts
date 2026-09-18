/** Field map only — not the official OREA Form 105 PDF. */
import { field, FORM_COPYRIGHT_NOTE, type FormMap } from "../types";

export const orea105: FormMap = {
  formId: "orea-105",
  title: "Notice / Waiver",
  board: "OREA",
  jurisdiction: "ON",
  mapVersion: "2026.09.1-draft",
  mapConfidence: "draft",
  copyrightNote: FORM_COPYRIGHT_NOTE,
  fields: [
    field({ key: "buyer_1_name", label: "Buyer name", type: "text", party: "buyer", required: true, bind: ["parties.buyer.name"] }),
    field({ key: "seller_1_name", label: "Seller name", type: "text", party: "seller", required: true, bind: ["parties.seller.name"] }),
    field({ key: "property_address", label: "Property address", type: "text", required: true, bind: ["property.address", "property.streetAddress"] }),
    field({ key: "agreement_date", label: "Agreement date", type: "date", required: false, bind: ["facts.agreementDate", "facts.offerDate"] }),
    field({ key: "notice_type", label: "Notice type", type: "text", required: false, bind: ["facts.noticeType"] }),
    field({ key: "condition_label", label: "Condition referenced", type: "text", required: false, bind: ["facts.conditionLabel"] }),
    field({ key: "notice_date", label: "Notice date", type: "date", required: false, bind: ["facts.offerDate"] }),
    field({ key: "buyer_1_signature", label: "Buyer signature", type: "signature", party: "buyer", required: true }),
    field({ key: "seller_1_signature", label: "Seller signature", type: "signature", party: "seller", required: true }),
  ],
};
