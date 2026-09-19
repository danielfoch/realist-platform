import { createPortalExtractor } from "../portal";

export const zooplaExtractor = createPortalExtractor({
  id: "zoopla-uk",
  hosts: ["zoopla.co.uk"],
  countries: ["GB"],
  currency: "GBP",
  urlId: /\/details\/(\d+)/i,
});
