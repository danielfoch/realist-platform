import { looksLikeLoginWall, mergeSignals, parseJsonLd, parseOpenGraph } from "./parse";
import { matchExtractor } from "./registry";
import { ListingExtractError, type ExtractResult, type ListingExtractInput } from "./types";

export { ListingExtractError };

export function hostFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function extractFromHtml(input: {
  html: string;
  url?: string;
  country?: string;
  currency?: string;
  mlsNumber?: string;
}): ExtractResult {
  const host = hostFromUrl(input.url);
  const ctx = {
    url: input.url ?? null,
    host,
    html: input.html,
    hints: {
      country: input.country,
      currency: input.currency,
      mlsNumber: input.mlsNumber,
    },
  };
  const preview = mergeSignals(parseJsonLd(input.html), parseOpenGraph(input.html));
  if (looksLikeLoginWall(input.html, preview)) {
    throw new ListingExtractError(
      "blocked_or_login_wall",
      "Page looks login-walled or challenged. Public markup only — we do not sign in.",
    );
  }
  const extractor = matchExtractor(host);
  return extractor.extract(ctx);
}

export function extractFromInputHtml(input: ListingExtractInput): ExtractResult {
  const html = input.html || input.rawText;
  if (!html) {
    throw new ListingExtractError("extract_failed", "No HTML/rawText supplied for offline extract.");
  }
  return extractFromHtml({
    html,
    url: input.url,
    country: input.country,
    currency: input.currency,
    mlsNumber: input.mlsNumber,
  });
}
