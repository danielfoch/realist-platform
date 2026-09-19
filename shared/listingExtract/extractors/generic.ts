import { extractFromPublicMarkup } from "../portal";
import type { ListingExtractor } from "../types";

export const genericExtractor: ListingExtractor = {
  id: "generic-jsonld-og",
  hosts: [],
  implemented: true,
  extract(ctx) {
    return extractFromPublicMarkup(ctx, "generic-jsonld-og");
  },
};
