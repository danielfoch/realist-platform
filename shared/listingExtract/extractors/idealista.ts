import { createPortalExtractor } from "../portal";

function countryFromHost(host: string | null): string | undefined {
  if (!host) return undefined;
  const h = host.toLowerCase();
  if (h.endsWith("idealista.it")) return "IT";
  if (h.endsWith("idealista.pt")) return "PT";
  if (h.endsWith("idealista.com")) return "ES";
  return undefined;
}

export const idealistaExtractor = createPortalExtractor({
  id: "idealista",
  hosts: ["idealista.com", "idealista.it", "idealista.pt"],
  countries: ["ES", "IT", "PT"],
  currency: "EUR",
  urlId: /\/(?:inmueble|immobile|imovel)\/(\d+)/i,
  countryFromHost,
});
