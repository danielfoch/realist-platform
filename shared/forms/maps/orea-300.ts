/** Field map only — not the official OREA Form 300 PDF. */
import { field, FORM_COPYRIGHT_NOTE, type FormMap } from "../types";

export const orea300: FormMap = {
  formId: "orea-300",
  title: "Buyer Representation Agreement",
  board: "OREA",
  jurisdiction: "ON",
  mapVersion: "2026.09.1-draft",
  mapConfidence: "draft",
  copyrightNote: FORM_COPYRIGHT_NOTE,
  fields: [
    field({ key: "buyer_1_name", label: "Buyer name", type: "text", party: "buyer", required: true, bind: ["parties.buyer.name"] }),
    field({ key: "buyer_1_email", label: "Buyer email", type: "text", party: "buyer", required: false, bind: ["parties.buyer.email"] }),
    field({ key: "buyer_1_phone", label: "Buyer phone", type: "text", party: "buyer", required: false, bind: ["parties.buyer.phone"] }),
    field({ key: "buyer_brokerage", label: "Buyer brokerage", type: "text", party: "buyer_broker", required: false, bind: ["parties.buyerBroker.brokerage", "parties.buyerBroker.name"] }),
    field({ key: "listing_start_date", label: "Commencement", type: "date", required: false, bind: ["facts.listingStartDate"] }),
    field({ key: "listing_expiry_date", label: "Expiry", type: "date", required: false, bind: ["facts.listingExpiryDate"] }),
    field({ key: "commission", label: "Commission", type: "text", required: false, bind: ["facts.commission"] }),
    field({ key: "property_city", label: "Area / city", type: "text", required: false, bind: ["property.city"] }),
    field({ key: "property_province", label: "Province", type: "text", required: false, bind: ["property.province"] }),
    field({ key: "buyer_1_initials", label: "Buyer initials", type: "initials", party: "buyer", required: true }),
    field({ key: "buyer_1_signature", label: "Buyer signature", type: "signature", party: "buyer", required: true }),
    field({ key: "buyer_broker_signature", label: "Buyer broker signature", type: "signature", party: "buyer_broker", required: true }),
  ],
};
