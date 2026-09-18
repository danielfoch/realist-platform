import { createPortalExtractor } from "../portal";

export const rightmoveExtractor = createPortalExtractor({
  id: "rightmove-uk",
  hosts: ["rightmove.co.uk"],
  countries: ["GB"],
  currency: "GBP",
  urlId: /\/properties\/(\d+)/i,
});
