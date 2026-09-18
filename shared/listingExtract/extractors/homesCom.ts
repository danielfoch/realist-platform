import { createPortalExtractor } from "../portal";

export const homesComExtractor = createPortalExtractor({
  id: "homes-com",
  hosts: ["homes.com"],
  countries: ["US"],
  currency: "USD",
  urlId: /\/id-(\d+)/i,
});
