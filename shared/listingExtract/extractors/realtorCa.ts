import { createPortalExtractor } from "../portal";

export const realtorCaExtractor = createPortalExtractor({
  id: "realtor-ca",
  hosts: ["realtor.ca"],
  countries: ["CA"],
  currency: "CAD",
});
