import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { extractFromHtml, ListingExtractError } from "./extract";
import { listExtractors, matchExtractor, registerExtractor, resetRegisteredExtractors } from "./registry";
import { underwriteCustomInputSchema } from "../agentSpine";

const fixture = (name: string) =>
  readFileSync(path.resolve(process.cwd(), "shared/listingExtract/fixtures", name), "utf8");

describe("extractor router", () => {
  it("picks host-specific extractors and falls back to generic", () => {
    expect(matchExtractor("www.zillow.com").id).toBe("zillow");
    expect(matchExtractor("homes.zillow.com").id).toBe("zillow");
    expect(matchExtractor("realtor.ca").id).toBe("realtor-ca");
    expect(matchExtractor("www.redfin.com").id).toBe("redfin");
    expect(matchExtractor("rightmove.co.uk").id).toBe("rightmove-uk");
    expect(matchExtractor("example.com").id).toBe("generic-jsonld-og");
  });

  it("lists built-in extractors including the generic catch-all", () => {
    const ids = listExtractors().map((item) => item.id);
    expect(ids).toEqual(expect.arrayContaining(["zillow", "realtor-ca", "generic-jsonld-og", "rightmove-uk"]));
  });

  it("registerExtractor prepends a custom host map", () => {
    registerExtractor({
      id: "test-portal",
      hosts: ["test.example"],
      implemented: true,
      extract: () => ({
        property: { address: "1 Test" },
        listing: {},
        confidence: "low",
        missingFields: [],
        warnings: [],
        sourceHost: "test.example",
        extractorId: "test-portal",
      }),
    });
    expect(matchExtractor("www.test.example").id).toBe("test-portal");
    resetRegisteredExtractors();
    expect(matchExtractor("www.test.example").id).toBe("generic-jsonld-og");
  });
});

describe("generic JSON-LD extract", () => {
  it("extracts address, price, beds, and GBP from a worldwide fixture", () => {
    const result = extractFromHtml({
      html: fixture("generic-jsonld.html"),
      url: "https://www.example.com/listings/14-canal",
    });
    expect(result.extractorId).toBe("generic-jsonld-og");
    expect(result.property.address).toContain("14 Canal Street");
    expect(result.property.city).toBe("Manchester");
    expect(result.property.country).toBe("GB");
    expect(result.property.beds).toBe(4);
    expect(result.listing.listPrice).toBe(450000);
    expect(result.listing.currency).toBe("GBP");
    expect(result.confidence).toBe("high");
    expect(result.missingFields).not.toContain("listing.listPrice");
    const underwrite = underwriteCustomInputSchema.safeParse({
      address: result.property.address,
      city: result.property.city,
      countryMode: result.property.country,
      price: result.listing.listPrice,
      currency: result.listing.currency,
      strategyType: "buyHold",
    });
    expect(underwrite.success).toBe(true);
  });
});

describe("host extractors", () => {
  it("reads Zillow-style OpenGraph without inventing beds", () => {
    const result = extractFromHtml({
      html: fixture("zillow-og.html"),
      url: "https://www.zillow.com/homedetails/123-Main-St/99887766_zpid/",
    });
    expect(result.extractorId).toBe("zillow");
    expect(result.listing.externalId).toBe("99887766");
    expect(result.listing.listPrice).toBe(625000);
    expect(result.listing.currency).toBe("USD");
    expect(result.property.city).toBe("Austin");
    expect(result.property.country).toBe("US");
    expect(result.property.beds).toBeUndefined();
    expect(result.missingFields).toContain("property.beds");
    const underwrite = underwriteCustomInputSchema.safeParse({
      address: result.property.address,
      city: result.property.city,
      countryMode: result.property.country,
      price: result.listing.listPrice,
      currency: result.listing.currency,
      strategyType: "buyHold",
    });
    expect(underwrite.success).toBe(true);
  });

  it("reads realtor.ca JSON-LD as the CA public-page path", () => {
    const result = extractFromHtml({
      html: fixture("realtor-ca.html"),
      url: "https://www.realtor.ca/real-estate/123",
    });
    expect(result.extractorId).toBe("realtor-ca");
    expect(result.listing.mlsNumber).toBe("X7654321");
    expect(result.listing.listPrice).toBe(899000);
    expect(result.listing.currency).toBe("CAD");
    expect(result.property.country).toBe("CA");
  });

  it("does not invent a purchase-style price when none is present", () => {
    const result = extractFromHtml({
      html: "<html><head><title>Nice house in Paris</title></head><body>No price</body></html>",
      url: "https://www.example.fr/annonce/1",
      country: "FR",
    });
    expect(result.listing.listPrice).toBeUndefined();
    expect(result.missingFields).toContain("listing.listPrice");
    expect(result.property.country).toBe("FR");
  });

  it("rejects login walls", () => {
    expect(() => extractFromHtml({
      html: fixture("login-wall.html"),
      url: "https://www.zillow.com/homedetails/hidden/1_zpid/",
    })).toThrow(ListingExtractError);
    try {
      extractFromHtml({ html: fixture("login-wall.html"), url: "https://www.zillow.com/x" });
    } catch (error) {
      expect((error as ListingExtractError).code).toBe("blocked_or_login_wall");
    }
  });
});
