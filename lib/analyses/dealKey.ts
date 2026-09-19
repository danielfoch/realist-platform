/**
 * How a deal is identified. A listing is its MLS® number; anything else is its
 * address, normalised so "12 Main St." and "12 main street" are one deal.
 */

const SUFFIXES: Record<string, string> = {
  street: "st", avenue: "ave", road: "rd", drive: "dr", boulevard: "blvd", crescent: "cres", court: "crt",
  place: "pl", lane: "ln", terrace: "terr", highway: "hwy", parkway: "pkwy", circle: "cir", trail: "trl",
  north: "n", south: "s", east: "e", west: "w",
};

export function normalizeAddress(address: string): string {
  return address
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => SUFFIXES[word] ?? word)
    .join(" ")
    .slice(0, 160);
}

export function dealKeyFor(deal: { mlsNumber?: string | null; address?: string | null }): string | null {
  const mls = deal.mlsNumber?.trim();
  if (mls) return `mls:${mls.toUpperCase().slice(0, 40)}`;
  const address = deal.address?.trim();
  if (address && address.length >= 5) return `addr:${normalizeAddress(address)}`;
  return null;
}

/** Forward sortation area — the first half of a Canadian postal code. */
export function fsaOf(postalCode: string | null | undefined): string | null {
  const match = postalCode?.toUpperCase().replace(/\s/g, "").match(/^[A-Z]\d[A-Z]/);
  return match ? match[0] : null;
}

/** "Dana Tester" → "Dana T." — how a member appears to other people. */
export function publicName(name: string | null | undefined): string {
  // A display name is a name: letters, spaces, hyphens, apostrophes. Anything that looks like a link,
  // a handle or an advertisement never reaches the board, a profile or the weekly email.
  const cleaned = (name ?? "").normalize("NFC").trim();
  if (!/^[\p{L}][\p{L}\p{M}' -]{0,60}$/u.test(cleaned)) return "Realist member";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Realist member";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}
