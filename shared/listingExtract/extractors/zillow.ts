import { createPortalExtractor } from "../portal";

export const zillowExtractor = createPortalExtractor({
  id: "zillow",
  hosts: ["zillow.com"],
  countries: ["US"],
  currency: "USD",
  urlId: /(\d+)_zpid/i,
  extraWarnings: [
    "Zillow public markup is fragile and often login-gated. Missing facts stay null.",
  ],
});
