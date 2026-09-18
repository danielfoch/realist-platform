import { createPortalExtractor } from "../portal";

function countryFromHost(host: string | null): string | undefined {
  if (!host) return undefined;
  const h = host.toLowerCase();
  if (h.endsWith("propertyguru.com.my")) return "MY";
  if (h.endsWith("propertyguru.com.sg")) return "SG";
  return undefined;
}

export const propertyguruExtractor = createPortalExtractor({
  id: "propertyguru",
  hosts: ["propertyguru.com.sg", "propertyguru.com.my"],
  countries: ["SG", "MY"],
  currency: "SGD",
  urlId: /\/listing\/(\d+)/i,
  countryFromHost,
});
