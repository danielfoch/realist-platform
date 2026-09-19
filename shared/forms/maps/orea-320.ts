/** Field map only — not the official OREA Form 320 PDF. */
import { field, FORM_COPYRIGHT_NOTE, type FormMap } from "../types";

export const orea320: FormMap = {
  formId: "orea-320",
  title: "Confirmation of Co-operation and Representation",
  board: "OREA",
  jurisdiction: "ON",
  mapVersion: "2026.09.1-draft",
  mapConfidence: "draft",
  copyrightNote: FORM_COPYRIGHT_NOTE,
  fields: [
    field({ key: "buyer_1_name", label: "Buyer name", type: "text", party: "buyer", required: false, bind: ["parties.buyer.name"] }),
    field({ key: "seller_1_name", label: "Seller name", type: "text", party: "seller", required: false, bind: ["parties.seller.name"] }),
    field({ key: "property_address", label: "Property address", type: "text", required: true, bind: ["property.address", "property.streetAddress"] }),
    field({ key: "mls_number", label: "MLS number", type: "text", required: false, bind: ["listing.mlsNumber", "deal.mlsNumber"] }),
    field({ key: "seller_brokerage", label: "Listing brokerage", type: "text", party: "seller_broker", required: false, bind: ["parties.sellerBroker.brokerage", "parties.sellerBroker.name"] }),
    field({ key: "buyer_brokerage", label: "Co-operating brokerage", type: "text", party: "buyer_broker", required: false, bind: ["parties.buyerBroker.brokerage", "parties.buyerBroker.name"] }),
    field({ key: "commission", label: "Listing commission", type: "text", required: false, bind: ["facts.commission"] }),
    field({ key: "cooperating_commission", label: "Co-operating commission", type: "text", required: false, bind: ["facts.cooperatingCommission"] }),
    field({ key: "representation_type", label: "Representation type", type: "text", required: false, bind: ["facts.representationType"] }),
    field({ key: "buyer_1_signature", label: "Buyer signature", type: "signature", party: "buyer", required: true }),
    field({ key: "seller_1_signature", label: "Seller signature", type: "signature", party: "seller", required: true }),
    field({ key: "buyer_broker_signature", label: "Co-operating broker signature", type: "signature", party: "buyer_broker", required: true }),
    field({ key: "seller_broker_signature", label: "Listing broker signature", type: "signature", party: "seller_broker", required: true }),
  ],
};
