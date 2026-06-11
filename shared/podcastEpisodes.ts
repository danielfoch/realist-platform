/**
 * Shared podcast episode SEO helpers for /insights/podcast/:slug.
 *
 * Pure functions only (no fetch, no DOM): slug generation with deterministic
 * collision handling, topic/keyword derivation from episode titles, and the
 * topic→tool CTA mapping. Imported by server/podcastFeed.ts (feed cache,
 * crawler fallback, sitemap) and the client episode page, and unit-tested in
 * shared/podcastEpisodes.test.ts.
 */

import { PROGRAMMATIC_MARKETS } from "./programmaticSeo";

// ---------------------------------------------------------------------------
// Slugs
// ---------------------------------------------------------------------------

/**
 * Deterministic title → slug: lowercase, apostrophes removed (so "Here's"
 * becomes "heres", not "here-s"), "&" becomes "and", accents stripped, every
 * other punctuation/whitespace run collapsed to a single hyphen.
 */
export function slugifyEpisodeTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/['‘’]/g, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "episode";
}

/** YYYY-MM-DD from an RSS pubDate, or "" when unparseable. */
export function episodeDateSuffix(pubDate: string): string {
  const date = new Date(pubDate);
  return isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export interface SluggableEpisode {
  title: string;
  pubDate: string;
}

/**
 * Assign a stable slug to every episode in the feed.
 *
 * Collision rule (stability is the point — published URLs must not change as
 * new episodes arrive): episodes are grouped by base slug; the OLDEST episode
 * in a group keeps the bare slug, newer episodes with the same title get a
 * -YYYY-MM-DD suffix from their own pubDate, and -2/-3/... is appended if the
 * result still collides. Because the oldest episode always wins the base
 * slug, a brand-new episode reusing an old title can never steal (and break)
 * the old episode's URL.
 */
export function assignEpisodeSlugs<T extends SluggableEpisode>(
  episodes: T[],
): Array<T & { slug: string }> {
  const groups = new Map<string, number[]>();
  episodes.forEach((episode, index) => {
    const base = slugifyEpisodeTitle(episode.title);
    const group = groups.get(base);
    if (group) group.push(index);
    else groups.set(base, [index]);
  });

  const slugs = new Array<string>(episodes.length);
  const used = new Set<string>();

  for (const [base, indexes] of groups) {
    // Oldest first; tie-break on feed position so the order is deterministic.
    const ordered = [...indexes].sort((a, b) => {
      const ta = new Date(episodes[a].pubDate).getTime() || 0;
      const tb = new Date(episodes[b].pubDate).getTime() || 0;
      if (ta !== tb) return ta - tb;
      return b - a; // later feed position = older in a newest-first feed
    });
    ordered.forEach((episodeIndex, position) => {
      const dateSuffix = episodeDateSuffix(episodes[episodeIndex].pubDate);
      let candidate =
        position === 0 ? base : dateSuffix ? `${base}-${dateSuffix}` : `${base}-${position + 1}`;
      let bump = 2;
      while (used.has(candidate)) {
        candidate = `${position === 0 ? base : dateSuffix ? `${base}-${dateSuffix}` : base}-${bump}`;
        bump += 1;
      }
      used.add(candidate);
      slugs[episodeIndex] = candidate;
    });
  }

  return episodes.map((episode, index) => ({ ...episode, slug: slugs[index] }));
}

// ---------------------------------------------------------------------------
// Topics / keywords
// ---------------------------------------------------------------------------

/** Cities we recognize in titles. Market pages only exist for a subset. */
const KNOWN_CITIES: string[] = [
  ...PROGRAMMATIC_MARKETS.map((market) => market.city),
  "Edmonton",
  "Montreal",
  "Winnipeg",
  "Halifax",
  "Mississauga",
  "Brampton",
  "London",
  "Kitchener",
  "Waterloo",
  "Saskatoon",
  "Regina",
  "Victoria",
];

const MARKET_SLUG_BY_CITY = new Map(
  PROGRAMMATIC_MARKETS.map((market) => [market.city.toLowerCase(), market.slug]),
);

interface TopicTerm {
  label: string;
  pattern: RegExp;
}

const TOPIC_TERMS: TopicTerm[] = [
  { label: "Mortgages", pattern: /\bmortgages?\b/i },
  // "rates?" alone would also match "cap rates" — require a qualifier.
  { label: "Interest Rates", pattern: /\binterest rates?\b|\bmortgage rates?\b|\brate (cut|hike|hold)s?\b/i },
  { label: "Bank of Canada", pattern: /\bbank of canada\b|\bboc\b/i },
  { label: "CMHC", pattern: /\bcmhc\b/i },
  { label: "Cap Rates", pattern: /\bcap rates?\b/i },
  { label: "Rentals", pattern: /\brent(s|al|als|ers)?\b|\blandlords?\b|\btenants?\b/i },
  { label: "Pre-Construction", pattern: /\bpre[- ]?con(struction)?\b|\bassignments?\b/i },
  { label: "Condos", pattern: /\bcondos?\b|\bcondominiums?\b/i },
  { label: "Multiplex", pattern: /\bmultiplex(es)?\b|\bduplex(es)?\b|\btriplex(es)?\b|\bfourplex(es)?\b/i },
  { label: "BRRR", pattern: /\bbrrr+\b/i },
  { label: "Power of Sale", pattern: /\bpower of sale\b|\bforeclosures?\b|\bdistress(ed)?\b/i },
  { label: "Taxes", pattern: /\btax(es)?\b|\bhst\b|\bgst\b|\bcapital gains\b/i },
  { label: "Housing Market", pattern: /\bhousing( market)?\b|\bmarkets?\b|\bhome prices?\b/i },
  { label: "Economy", pattern: /\brecession\b|\bgdp\b|\binflation\b|\beconomy\b|\bunemployment\b/i },
  { label: "Immigration", pattern: /\bimmigration\b|\bpopulation\b/i },
  { label: "Short-Term Rentals", pattern: /\bairbnb\b|\bshort[- ]term rentals?\b/i },
  { label: "Development", pattern: /\bdevelopment\b|\bzoning\b|\bconstruction\b|\bbuilders?\b/i },
  { label: "Financing", pattern: /\bfinancing\b|\blenders?\b|\blending\b|\brefinanc\w*\b|\bdown payments?\b/i },
  { label: "First-Time Buyers", pattern: /\bfirst[- ]time (home ?)?buyers?\b/i },
  { label: "Investing Strategy", pattern: /\binvest(or|ors|ing|ment|ments)?\b/i },
];

/**
 * Derive a short topics list from an episode title — used for the keywords
 * meta line, the visible topics row, and related-episode matching.
 */
export function deriveEpisodeTopics(title: string, maxTopics = 6): string[] {
  const topics: string[] = [];
  for (const city of KNOWN_CITIES) {
    if (new RegExp(`\\b${city}\\b`, "i").test(title)) topics.push(city);
  }
  for (const { label, pattern } of TOPIC_TERMS) {
    if (pattern.test(title) && !topics.includes(label)) topics.push(label);
  }
  return topics.slice(0, maxTopics);
}

/** Keywords meta line for an episode page. */
export function deriveEpisodeKeywords(title: string): string {
  return [
    ...deriveEpisodeTopics(title),
    "Canadian real estate podcast",
    "The Canadian Real Estate Investor",
    "Daniel Foch",
    "Nick Hill",
  ].join(", ");
}

// ---------------------------------------------------------------------------
// Topic → tool CTA mapping
// ---------------------------------------------------------------------------

export interface EpisodeCtaLink {
  href: string;
  label: string;
}

export interface EpisodeCta {
  copy: string;
  primary: EpisodeCtaLink;
  secondary?: EpisodeCtaLink;
}

/** First recognized city in the title, or null. */
export function detectEpisodeCity(title: string): { city: string; marketSlug: string | null } | null {
  for (const city of KNOWN_CITIES) {
    if (new RegExp(`\\b${city}\\b`, "i").test(title)) {
      return { city, marketSlug: MARKET_SLUG_BY_CITY.get(city.toLowerCase()) ?? null };
    }
  }
  return null;
}

/**
 * Map an episode title to the contextual tool CTA shown on its page:
 * - mortgage / rate themes → /tools/analyzer (rate-sensitivity framing)
 * - cap rate / market / recognized city → /tools/cap-rates, plus the
 *   /markets/:city page as a secondary link when one exists
 * - everything else → /tools/analyzer with the default conversion copy
 */
export function mapEpisodeCta(title: string): EpisodeCta {
  // "cap rate" is the more specific term — don't let its "rate" suffix route
  // the episode into the mortgage/rate branch.
  const titleWithoutCapRates = title.replace(/\bcap(italization)?\s+rates?\b/gi, "");
  if (/\bmortgages?\b|\brates?\b/i.test(titleWithoutCapRates)) {
    return {
      copy: "Rates move the math. Stress-test a deal at today's mortgage rates — free.",
      primary: { href: "/tools/analyzer", label: "Open the Deal Analyzer" },
      secondary: { href: "/insights/mortgage-rates", label: "See today's mortgage rates" },
    };
  }

  const cityMatch = detectEpisodeCity(title);
  if (/\bcap rates?\b|\bmarkets?\b/i.test(title) || cityMatch) {
    const cta: EpisodeCta = {
      copy: cityMatch
        ? `Browse live cap rates and yields in ${cityMatch.city} and across Canada — free.`
        : "Browse live cap rates and rental yields across Canadian markets — free.",
      primary: { href: "/tools/cap-rates", label: "Explore the Cap Rate Map" },
    };
    if (cityMatch?.marketSlug) {
      cta.secondary = {
        href: `/markets/${cityMatch.marketSlug}`,
        label: `${cityMatch.city} market page`,
      };
    }
    return cta;
  }

  return {
    copy: "Run the numbers on your own deal — free.",
    primary: { href: "/tools/analyzer", label: "Open the Deal Analyzer" },
  };
}
