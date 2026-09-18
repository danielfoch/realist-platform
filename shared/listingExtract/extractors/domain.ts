import { createPortalExtractor } from "../portal";

export const domainExtractor = createPortalExtractor({
  id: "domain-au",
  hosts: ["domain.com.au"],
  countries: ["AU"],
  currency: "AUD",
  urlId: /-(\d{6,})\/?$/i,
});
