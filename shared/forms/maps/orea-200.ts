/** Field map only — not the official OREA Form 200 PDF. */
import { field, FORM_COPYRIGHT_NOTE, type FormMap } from "../types";

export const orea200: FormMap = {
  formId: "orea-200",
  title: "Seller Representation Agreement (Listing)",
  board: "OREA",
  jurisdiction: "ON",
  mapVersion: "2026.09.1-draft",
  mapConfidence: "draft",
  copyrightNote: FORM_COPYRIGHT_NOTE,
  fields: [
    field({ key: "seller_1_name", label: "Seller name", type: "text", party: "seller", required: true, bind: ["parties.seller.name"] }),
    field({ key: "seller_1_email", label: "Seller email", type: "text", party: "seller", required: false, bind: ["parties.seller.email"] }),
    field({ key: "seller_1_phone", label: "Seller phone", type: "text", party: "seller", required: false, bind: ["parties.seller.phone"] }),
    field({ key: "property_address", label: "Property address", type: "text", required: true, bind: ["property.address", "property.streetAddress"] }),
    field({ key: "property_city", label: "City", type: "text", required: false, bind: ["property.city"] }),
    field({ key: "property_province", label: "Province", type: "text", required: false, bind: ["property.province"] }),
    field({ key: "property_postal_code", label: "Postal code", type: "text", required: false, bind: ["property.postalCode"] }),
    field({ key: "mls_number", label: "MLS number", type: "text", required: false, bind: ["listing.mlsNumber", "deal.mlsNumber"] }),
    field({ key: "list_price", label: "List price", type: "currency", required: false, bind: ["facts.listPrice", "listing.listPrice"] }),
    field({ key: "listing_start_date", label: "Listing commencement", type: "date", required: false, bind: ["facts.listingStartDate"] }),
    field({ key: "listing_expiry_date", label: "Listing expiry", type: "date", required: false, bind: ["facts.listingExpiryDate"] }),
    field({ key: "commission", label: "Commission", type: "text", required: false, bind: ["facts.commission"] }),
    field({ key: "seller_brokerage", label: "Listing brokerage", type: "text", party: "seller_broker", required: false, bind: ["parties.sellerBroker.brokerage", "parties.sellerBroker.name"] }),
    field({ key: "seller_1_initials", label: "Seller initials", type: "initials", party: "seller", required: true }),
    field({ key: "seller_1_signature", label: "Seller signature", type: "signature", party: "seller", required: true }),
    field({ key: "seller_broker_signature", label: "Listing broker signature", type: "signature", party: "seller_broker", required: true }),
  ],
};
