export interface ListingAddressLocation {
  city?: string | null;
  zip?: string | null;
}

const TORONTO_MUNICIPALITIES = new Set([
  "city of toronto",
  "east york",
  "etobicoke",
  "north york",
  "scarborough",
  "toronto",
  "york",
]);

const TORONTO_POSTAL_CODE = /^M\d[A-Z]\s?\d[A-Z]\d$/i;

export function isTorontoListingAddress(address?: ListingAddressLocation | null): boolean {
  if (!address) return false;
  const city = address.city?.trim().toLowerCase().replace(/\s+/g, " ");
  if (city && (
    TORONTO_MUNICIPALITIES.has(city)
    || /^toronto\s+[cnew]\d{2}$/.test(city)
  )) {
    return true;
  }

  return TORONTO_POSTAL_CODE.test(address.zip?.trim() || "");
}
