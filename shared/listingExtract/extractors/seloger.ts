import { createPortalExtractor } from "../portal";

/** SeLoger — FR public listing pages. Leboncoin skipped (often login-walled). */
export const selogerExtractor = createPortalExtractor({
  id: "seloger-fr",
  hosts: ["seloger.com"],
  countries: ["FR"],
  currency: "EUR",
  urlId: /\/(\d{6,})(?:\.htm|\/|$)/i,
});
