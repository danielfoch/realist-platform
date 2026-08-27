/**
 * JSON-LD builders. Every public page renders exactly one <script
 * type="application/ld+json"> through JsonLd (components/JsonLd.tsx) using
 * these helpers, so the schema graph stays consistent across the site.
 */

import {
  BRAND_NAME,
  HOSTS,
  ORGANIZATION_SAME_AS,
  PODCAST_NAME,
  PODCAST_RSS_URL,
  PODCAST_SAME_AS,
  SITE_BASE_URL,
} from "@/lib/brand";

type JsonLdNode = Record<string, unknown>;

export function absoluteUrl(path: string): string {
  return path.startsWith("http") ? path : `${SITE_BASE_URL}${path}`;
}

export function organizationNode(): JsonLdNode {
  return {
    "@type": "Organization",
    "@id": `${SITE_BASE_URL}/#organization`,
    name: BRAND_NAME,
    url: SITE_BASE_URL,
    logo: `${SITE_BASE_URL}/logo.png`,
    sameAs: ORGANIZATION_SAME_AS,
  };
}

export function webSiteNode(): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": `${SITE_BASE_URL}/#website`,
    name: BRAND_NAME,
    url: SITE_BASE_URL,
    publisher: { "@id": `${SITE_BASE_URL}/#organization` },
  };
}

export function podcastSeriesNode(): JsonLdNode {
  return {
    "@type": "PodcastSeries",
    "@id": `${SITE_BASE_URL}/podcast#series`,
    name: PODCAST_NAME,
    url: `${SITE_BASE_URL}/podcast`,
    webFeed: PODCAST_RSS_URL,
    sameAs: PODCAST_SAME_AS,
    author: HOSTS.map((host) => ({
      "@type": "Person",
      name: host.name,
      url: `${SITE_BASE_URL}/about`,
    })),
    publisher: { "@id": `${SITE_BASE_URL}/#organization` },
  };
}

export function podcastEpisodeNode(input: {
  slug: string;
  title: string;
  description: string;
  pubDate: string;
  audioUrl: string;
  durationIso: string | null;
  imageUrl: string;
}): JsonLdNode {
  const node: JsonLdNode = {
    "@type": "PodcastEpisode",
    "@id": absoluteUrl(`/podcast/${input.slug}#episode`),
    name: input.title,
    url: absoluteUrl(`/podcast/${input.slug}`),
    description: input.description,
    datePublished: input.pubDate ? new Date(input.pubDate).toISOString() : undefined,
    image: input.imageUrl || undefined,
    partOfSeries: { "@id": `${SITE_BASE_URL}/podcast#series` },
    associatedMedia: {
      "@type": "MediaObject",
      contentUrl: input.audioUrl,
      encodingFormat: "audio/mpeg",
    },
  };
  if (input.durationIso) node.timeRequired = input.durationIso;
  return node;
}

export function breadcrumbNode(items: Array<{ name: string; path: string }>): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/** Wrap nodes in one @graph document. */
export function jsonLdDocument(...nodes: Array<JsonLdNode | undefined>): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": nodes.filter(Boolean),
  });
}

/**
 * schema.org Event node for community meetups. Dates are ISO 8601 UTC
 * instants; location is the human-readable venue line from the feed.
 */
export function eventNode(input: {
  id: string;
  name: string;
  startDate: string;
  endDate?: string | null;
  url?: string | null;
  location?: string | null;
  description?: string | null;
}): JsonLdNode {
  const node: JsonLdNode = {
    "@type": "Event",
    "@id": absoluteUrl(`/community#event-${encodeURIComponent(input.id)}`),
    name: input.name,
    startDate: input.startDate,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    organizer: { "@id": `${SITE_BASE_URL}/#organization` },
  };
  if (input.endDate) node.endDate = input.endDate;
  if (input.url) node.url = input.url;
  if (input.description) node.description = input.description;
  if (input.location) {
    node.location = {
      "@type": "Place",
      name: input.location,
      address: input.location,
    };
  }
  return node;
}

/**
 * Generic article-like node for editorial pages (research reports, guides).
 * `type` defaults to "Article"; config reports pass "Report". Author and
 * publisher both point at the site-wide Organization node, so include
 * organizationNode() in the same document.
 */
export function articleNode(input: {
  path: string;
  headline: string;
  description: string;
  /** ISO date (YYYY-MM-DD) or a full ISO datetime. */
  datePublished: string;
  type?: "Article" | "Report" | "NewsArticle";
  keywords?: string[];
  image?: string;
}): JsonLdNode {
  const url = absoluteUrl(input.path);
  const type = input.type ?? "Article";
  const node: JsonLdNode = {
    "@type": type,
    "@id": `${url}#${type.toLowerCase()}`,
    headline: input.headline,
    description: input.description,
    url,
    datePublished: input.datePublished.includes("T")
      ? input.datePublished
      : `${input.datePublished}T00:00:00Z`,
    author: { "@id": `${SITE_BASE_URL}/#organization` },
    publisher: { "@id": `${SITE_BASE_URL}/#organization` },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };
  if (input.keywords?.length) node.keywords = input.keywords.join(", ");
  if (input.image) node.image = absoluteUrl(input.image);
  return node;
}

/**
 * schema.org RealEstateListing node for /listings/[key] detail pages. Address
 * fields come from the normalized DDF listing (or its snapshot fallback);
 * price is CAD and only rendered when positive.
 */
export function realEstateListingNode(input: {
  path: string;
  name: string;
  description?: string | null;
  image?: string | null;
  mlsNumber?: string | null;
  price?: number | null;
  status?: string | null;
  datePosted?: string | null;
  street?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  floorSizeSqft?: number | null;
}): JsonLdNode {
  const url = absoluteUrl(input.path);
  const node: JsonLdNode = {
    "@type": "RealEstateListing",
    "@id": `${url}#listing`,
    name: input.name,
    url,
    description: input.description || undefined,
    image: input.image ? absoluteUrl(input.image) : undefined,
    identifier: input.mlsNumber || undefined,
    datePosted: input.datePosted ? new Date(input.datePosted).toISOString() : undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: input.street || undefined,
      addressLocality: input.city || undefined,
      addressRegion: input.region || undefined,
      postalCode: input.postalCode || undefined,
      addressCountry: "CA",
    },
  };
  if (input.price && input.price > 0) {
    node.offers = {
      "@type": "Offer",
      price: input.price,
      priceCurrency: "CAD",
      availability: (input.status || "Active").toLowerCase().startsWith("active")
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    };
  }
  if (input.latitude != null && input.longitude != null) {
    node.geo = {
      "@type": "GeoCoordinates",
      latitude: input.latitude,
      longitude: input.longitude,
    };
  }
  if (input.bedrooms) node.numberOfBedrooms = input.bedrooms;
  if (input.bathrooms) node.numberOfBathroomsTotal = input.bathrooms;
  if (input.floorSizeSqft) {
    node.floorSize = {
      "@type": "QuantitativeValue",
      value: input.floorSizeSqft,
      unitCode: "FTK",
    };
  }
  return node;
}
