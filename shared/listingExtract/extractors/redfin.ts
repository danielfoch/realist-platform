import { createPortalExtractor } from "../portal";

export const redfinExtractor = createPortalExtractor({
  id: "redfin",
  hosts: ["redfin.com"],
  countries: ["US"],
  currency: "USD",
  urlId: /\/home\/(\d+)/i,
});
