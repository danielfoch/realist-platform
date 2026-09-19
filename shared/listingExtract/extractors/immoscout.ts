import { createPortalExtractor } from "../portal";

export const immoscoutExtractor = createPortalExtractor({
  id: "immoscout-de",
  hosts: ["immobilienscout24.de"],
  countries: ["DE"],
  currency: "EUR",
  urlId: /\/expose\/(\d+)/i,
});
