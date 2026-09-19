import { createPortalExtractor } from "../portal";

export const realestateAuExtractor = createPortalExtractor({
  id: "realestate-au",
  hosts: ["realestate.com.au"],
  countries: ["AU"],
  currency: "AUD",
  urlId: /-(\d{6,})\/?$/i,
});
