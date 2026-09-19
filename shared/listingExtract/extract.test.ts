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
    expect(matchExtractor("m.rightmove.co.uk").id).toBe("rightmove-uk");
    expect(matchExtractor("www.zoopla.co.uk").id).toBe("zoopla-uk");
    expect(matchExtractor("www.domain.com.au").id).toBe("domain-au");
    expect(matchExtractor("www.realestate.com.au").id).toBe("realestate-au");
    expect(matchExtractor("www.realtor.com").id).toBe("realtor-com");
    expect(matchExtractor("www.realtor.ca").id).toBe("realtor-ca");
    expect(matchExtractor("www.homes.com").id).toBe("homes-com");
    expect(matchExtractor("www.immobilienscout24.de").id).toBe("immoscout-de");
    expect(matchExtractor("www.seloger.com").id).toBe("seloger-fr");
    expect(matchExtractor("www.idealista.com").id).toBe("idealista");
    expect(matchExtractor("www.idealista.it").id).toBe("idealista");
    expect(matchExtractor("www.propertyguru.com.sg").id).toBe("propertyguru");
    expect(matchExtractor("www.propertyguru.com.my").id).toBe("propertyguru");
    expect(matchExtractor("example.com").id).toBe("generic-jsonld-og");
  });

  it("lists built-in extractors including the generic catch-all", () => {
    const ids = listExtractors().map((item) => item.id);
    expect(ids).toEqual(expect.arrayContaining([
      "zillow",
      "realtor-ca",
      "generic-jsonld-og",
      "rightmove-uk",
      "domain-au",
      "realestate-au",
      "zoopla-uk",
      "realtor-com",
      "homes-com",
      "immoscout-de",
      "seloger-fr",
      "idealista",
      "propertyguru",
    ]));
    expect(listExtractors().find((item) => item.id === "rightmove-uk")?.implemented).toBe(true);
    expect(listExtractors().find((item) => item.id === "domain-au")?.implemented).toBe(true);
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

describe("major portal extractors", () => {
  const cases = [
    {
      file: "rightmove.html",
      url: "https://www.rightmove.co.uk/properties/145678901",
      id: "rightmove-uk",
      city: "Manchester",
      country: "GB",
      currency: "GBP",
      price: 425000,
      beds: 3,
      externalId: "145678901",
    },
    {
      file: "domain.html",
      url: "https://www.domain.com.au/12-example-street-surry-hills-nsw-2010-2012345678",
      id: "domain-au",
      city: "Surry Hills",
      country: "AU",
      currency: "AUD",
      price: 1250000,
      beds: 2,
      externalId: "2012345678",
    },
    {
      file: "realestate-au.html",
      url: "https://www.realestate.com.au/property-house-vic-armadale-401234567",
      id: "realestate-au",
      city: "Armadale",
      country: "AU",
      currency: "AUD",
      price: 1680000,
      beds: 3,
      externalId: "401234567",
    },
    {
      file: "zoopla.html",
      url: "https://www.zoopla.co.uk/for-sale/details/65432109",
      id: "zoopla-uk",
      city: "London",
      country: "GB",
      currency: "GBP",
      price: 795000,
      beds: 2,
      externalId: "65432109",
    },
    {
      file: "realtor-com.html",
      url: "https://www.realtor.com/realestateandhomes-detail/4400-Maple-Ave_Dallas_TX_75219_M12345-67890",
      id: "realtor-com",
      city: "Dallas",
      country: "US",
      currency: "USD",
      price: 549000,
      beds: 4,
      externalId: "12345-67890",
    },
    {
      file: "homes-com.html",
      url: "https://www.homes.com/property/901-oak-lane-denver-co/id-88112233",
      id: "homes-com",
      city: "Denver",
      country: "US",
      currency: "USD",
      price: 410000,
      beds: 3,
      externalId: "88112233",
    },
    {
      file: "immoscout.html",
      url: "https://www.immobilienscout24.de/expose/11002233",
      id: "immoscout-de",
      city: "Berlin",
      country: "DE",
      currency: "EUR",
      price: 429000,
      beds: 3,
      externalId: "11002233",
    },
    {
      file: "seloger.html",
      url: "https://www.seloger.com/annonces/achat/appartement/paris-4eme-75/187654321.htm",
      id: "seloger-fr",
      city: "Paris",
      country: "FR",
      currency: "EUR",
      price: 620000,
      beds: 2,
      externalId: "187654321",
    },
    {
      file: "idealista.html",
      url: "https://www.idealista.com/inmueble/98765432/",
      id: "idealista",
      city: "Madrid",
      country: "ES",
      currency: "EUR",
      price: 375000,
      beds: 2,
      externalId: "98765432",
    },
    {
      file: "propertyguru.html",
      url: "https://www.propertyguru.com.sg/listing/22334455",
      id: "propertyguru",
      city: "Singapore",
      country: "SG",
      currency: "SGD",
      price: 1850000,
      beds: 2,
      externalId: "22334455",
    },
  ] as const;

  it.each(cases)("extracts $id from a public fixture", (item) => {
    const result = extractFromHtml({ html: fixture(item.file), url: item.url });
    expect(result.extractorId).toBe(item.id);
    expect(result.property.city).toBe(item.city);
    expect(result.property.country).toBe(item.country);
    expect(result.listing.currency).toBe(item.currency);
    expect(result.listing.listPrice).toBe(item.price);
    expect(result.property.beds).toBe(item.beds);
    expect(result.listing.externalId).toBe(item.externalId);
    expect(result.missingFields).not.toContain("listing.listPrice");
    expect(result.property.address).toBeTruthy();
  });

  it("does not invent beds on a Domain listing that omitted them", () => {
    const result = extractFromHtml({
      html: fixture("domain-partial.html"),
      url: "https://www.domain.com.au/88-harbour-road-sydney-nsw-2000-2098765432",
    });
    expect(result.extractorId).toBe("domain-au");
    expect(result.listing.listPrice).toBe(980000);
    expect(result.listing.currency).toBe("AUD");
    expect(result.property.beds).toBeUndefined();
    expect(result.missingFields).toContain("property.beds");
  });

  it("applies MY currency from host when PropertyGuru Malaysia has no price", () => {
    const result = extractFromHtml({
      html: "<html><body>Public stub page</body></html>",
      url: "https://www.propertyguru.com.my/listing/1",
    });
    expect(result.extractorId).toBe("propertyguru");
    expect(result.property.country).toBe("MY");
    expect(result.listing.currency).toBe("MYR");
    expect(result.listing.listPrice).toBeUndefined();
    expect(result.missingFields).toContain("listing.listPrice");
  });
});
