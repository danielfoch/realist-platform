import { fetchJson, rows } from "./http";
import { cityKey, fold, layer, sameStreet, streetNumber, text, type Layer, type Location, type PropertyRequest, type Source } from "./model";
import { nationalAddress } from "./national";

export const GEOCODER: Source = { id: "nrcan-geolocator", name: "Natural Resources Canada Geolocator", url: "https://geolocator.api.geo.ca/", licence: "NRCan public Geolocator service; contact NRCan before bulk use", attribution: "Source: Natural Resources Canada, Geolocator API (locate)." };
const provinces: Record<string, string> = { on: "ontario", ab: "alberta", bc: "british columbia", mb: "manitoba", ns: "nova scotia", nb: "new brunswick", qc: "quebec", sk: "saskatchewan", nl: "newfoundland and labrador", pe: "prince edward island", nt: "northwest territories", nu: "nunavut", yt: "yukon" };
export function provinceKey(v: string): string { const f = fold(v).replace(/\s+[a-z]\d[a-z]\s*\d[a-z]\d$/, "").trim(); return provinces[f] ?? f; }

export async function geocode(input: PropertyRequest): Promise<Layer<Location>> {
  if (input.lat !== undefined && input.lng !== undefined) return layer("available", { address: input.address?.split(",")[0]?.trim() ?? null, city: input.city ?? input.address?.split(",")[1]?.trim() ?? null, province: input.province ?? input.address?.split(",")[2]?.trim() ?? null, latitude: input.lat, longitude: input.lng, accuracy: "caller_supplied", provider: "caller" }, null, "Coordinates supplied by the caller; property identity has not been independently verified.");
  const address = input.address!;
  if (!streetNumber(address)) return layer("ambiguous", null, GEOCODER, "Supply a civic number, street, and municipality. Unit-level matching is not yet supported.");
  const stored = await nationalAddress(input, provinceKey);
  if (stored && (stored.status !== "available" || (stored.data?.latitude !== null && stored.data?.longitude !== null))) return stored;
  const url = new URL(GEOCODER.url);
  url.searchParams.set("q", [address, input.city, input.province].filter(Boolean).join(", "));
  url.searchParams.set("keys", "locate");
  url.searchParams.set("lang", "en");
  try {
    const candidates = rows(await fetchJson(url)).filter(r => {
      const name = text(r.name);
      if (r.category !== "Street" || !name || !Array.isArray(r.tag) || !r.tag.includes("INTERPOLATED_POSITION")) return false;
      const parts = name.split(",").map(v => v.trim());
      const exact = sameStreet(address, name);
      // A natural one-line address may omit commas; the remainder must still name this municipality.
      const full = !address.includes(",") && fold(address).startsWith(fold(parts[0])) && cityKey(address.slice(parts[0].length).trim()) === cityKey(parts[1] ?? "");
      if (!exact && !full) return false;
      if (input.city && cityKey(parts[1] ?? "") !== cityKey(input.city)) return false;
      if (input.province && provinceKey(String(r.province)) !== provinceKey(input.province)) return false;
      const suppliedProvince = address.split(",")[2]?.trim();
      if (suppliedProvince && provinceKey(suppliedProvince) !== provinceKey(String(r.province))) return false;
      // When a comma-separated municipality was supplied, never accept a match in a different city.
      if (!input.city && address.includes(",") && cityKey(address.split(",")[1]) !== cityKey(parts[1] ?? "")) return false;
      return typeof r.lat === "number" && typeof r.lng === "number" && r.lat >= 41 && r.lat <= 84 && r.lng >= -142 && r.lng <= -52;
    });
    const distinct = [...new Map(candidates.map(r => [fold(String(r.name)), r])).values()];
    if (distinct.length !== 1) return stored ?? layer(distinct.length ? "ambiguous" : "no_match", null, GEOCODER, "No unique civic-address match. Include the city and province, or provide verified lat and lng.");
    const hit = distinct[0];
    const name = String(hit.name);
    // The federal service can normalize hyphens and Saint abbreviations before
    // a second exact register lookup supplies the published building point.
    const registered = await nationalAddress({ ...input, address: name, city: name.split(",")[1]?.trim(), province: text(hit.province) ?? undefined }, provinceKey);
    if (registered && (registered.status !== "available" || (registered.data?.latitude !== null && registered.data?.longitude !== null))) return registered;
    return layer("available", { address: name.split(",")[0], city: name.split(",")[1]?.trim() ?? null, province: text(hit.province), latitude: Number(hit.lat), longitude: Number(hit.lng), accuracy: "street_interpolated", provider: GEOCODER.id, ...((registered?.data?.addressRegister ?? stored?.data?.addressRegister) ? { addressRegister: registered?.data?.addressRegister ?? stored?.data?.addressRegister } : {}) }, GEOCODER, "Street interpolation is approximate; verify the location before parcel, zoning, or due-diligence decisions.");
  } catch { return stored ?? layer("unavailable", null, GEOCODER, "Geocoder unavailable. Retry, or supply verified coordinates and city."); }
}
