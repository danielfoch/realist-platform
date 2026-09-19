import { createPortalExtractor } from "../portal";

export const realtorComExtractor = createPortalExtractor({
  id: "realtor-com",
  hosts: ["realtor.com"],
  countries: ["US"],
  currency: "USD",
  urlId: /_M([\d-]+)/i,
});
