import { describe, expect, it } from "vitest";
import { extractIdxListings, extractJsonLdBlocks, MAX_IDX_LISTINGS_PER_SYNC } from "./idxListingExtract";
import { buildIdxFeedAgreement, IDX_FEED_AGREEMENT_VERSION, isListingFeedType } from "./partnerNetwork";

const BASE = "https://agentsite.example.com/listings";

function page(jsonLd: unknown): string {
  return `<html><head><script type="application/ld+json">${JSON.stringify(jsonLd)}</script></head><body></body></html>`;
}

describe("extractJsonLdBlocks", () => {
  it("parses multiple blocks and skips malformed ones", () => {
    const html = `
      <script type="application/ld+json">{"@type":"RealEstateListing","name":"A"}</script>
      <script type="application/ld+json">{not json}</script>
      <script type='application/ld+json'>[{"@type":"House"}]</script>
    `;
    const blocks = extractJsonLdBlocks(html);
    expect(blocks).toHaveLength(2);
  });
});

describe("extractIdxListings", () => {
  it("extracts a RealEstateListing with full schema.org address and offer", () => {
    const listings = extractIdxListings(
      page({
        "@context": "https://schema.org",
        "@type": "RealEstateListing",
        url: "/listing/123-main",
        mlsNumber: "X1234567",
        description: "Solid duplex near transit",
        image: "https://cdn.example.com/photo.jpg",
        address: {
          "@type": "PostalAddress",
          streetAddress: "123 Main St",
          addressLocality: "Hamilton",
          addressRegion: "ON",
          postalCode: "L8P 1A1",
        },
        offers: { "@type": "Offer", price: "749900" },
        numberOfRooms: 3,
        broker: { "@type": "RealEstateAgent", name: "Acme Realty Ltd." },
      }),
      BASE,
    );
    expect(listings).toHaveLength(1);
    const l = listings[0];
    expect(l.externalId).toBe("X1234567");
    expect(l.sourceUrl).toBe("https://agentsite.example.com/listing/123-main");
    expect(l.address).toBe("123 Main St");
    expect(l.city).toBe("Hamilton");
    expect(l.region).toBe("ON");
    expect(l.listPrice).toBe(749900);
    expect(l.bedrooms).toBe(3);
    expect(l.listingBrokerage).toBe("Acme Realty Ltd.");
  });

  it("unwraps ItemList and @graph containers", () => {
    const listings = extractIdxListings(
      page({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "ItemList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                item: {
                  "@type": "SingleFamilyResidence",
                  url: "https://agentsite.example.com/p/1",
                  address: { streetAddress: "1 First Ave", addressLocality: "Guelph" },
                  offers: { price: 599000 },
                },
              },
              {
                "@type": "ListItem",
                position: 2,
                item: {
                  "@type": "SingleFamilyResidence",
                  url: "https://agentsite.example.com/p/2",
                  address: { streetAddress: "2 Second Ave", addressLocality: "Guelph" },
                  offers: { price: 649000 },
                },
              },
            ],
          },
        ],
      }),
      BASE,
    );
    expect(listings).toHaveLength(2);
    expect(listings.map((l) => l.address)).toEqual(["1 First Ave", "2 Second Ave"]);
  });

  it("ignores non-listing nodes and listings with neither price nor address", () => {
    const listings = extractIdxListings(
      page([
        { "@type": "Organization", name: "Acme Realty" },
        { "@type": "WebSite", url: "https://agentsite.example.com" },
        { "@type": "RealEstateListing", name: "branding node, no data" },
      ]),
      BASE,
    );
    expect(listings).toHaveLength(0);
  });

  it("dedupes by external id and handles string prices with formatting", () => {
    const node = {
      "@type": "House",
      url: "/same",
      address: { streetAddress: "9 Dup St", addressLocality: "Barrie" },
      offers: { price: "$1,250,000" },
    };
    const listings = extractIdxListings(page([node, node]), BASE);
    expect(listings).toHaveLength(1);
    expect(listings[0].listPrice).toBe(1250000);
  });

  it("caps the number of listings per sync", () => {
    const nodes = Array.from({ length: MAX_IDX_LISTINGS_PER_SYNC + 20 }, (_, i) => ({
      "@type": "RealEstateListing",
      url: `/p/${i}`,
      address: { streetAddress: `${i} Cap St`, addressLocality: "Ottawa" },
      offers: { price: 500000 + i },
    }));
    const listings = extractIdxListings(page(nodes), BASE);
    expect(listings).toHaveLength(MAX_IDX_LISTINGS_PER_SYNC);
  });
});

describe("IDX feed agreement", () => {
  it("own-site agreement carries the rights warranty and the site URL", () => {
    const agreement = buildIdxFeedAgreement({
      feedType: "own_idx_site",
      signedName: "Jane Agent",
      brokerageName: "Acme Realty",
      realEstateBoard: "Toronto Regional Real Estate Board (TRREB)",
      idxSiteUrl: "https://janesells.ca/listings",
      signedAtIso: "2026-06-12T12:00:00.000Z",
    });
    expect(agreement.version).toBe(IDX_FEED_AGREEMENT_VERSION);
    expect(agreement.text).toContain("represents and warrants");
    expect(agreement.text).toContain("https://janesells.ca/listings");
    expect(agreement.text).toContain("Listing provided by Jane Agent via IDX — Toronto Regional Real Estate Board (TRREB)");
    expect(agreement.text).toContain("listing brokerage");
  });

  it("repliers agreement requires written fee approval before activation", () => {
    const agreement = buildIdxFeedAgreement({
      feedType: "repliers_idx",
      signedName: "Jane Agent",
      brokerageName: "Acme Realty",
      signedAtIso: "2026-06-12T12:00:00.000Z",
    });
    expect(agreement.text).toContain("Repliers");
    expect(agreement.text).toContain("Valery Real Estate Inc.");
    expect(agreement.text).toContain("approve any such fees in writing");
  });

  it("feed type guard", () => {
    expect(isListingFeedType("repliers_idx")).toBe(true);
    expect(isListingFeedType("own_idx_site")).toBe(true);
    expect(isListingFeedType("csv")).toBe(false);
  });
});
