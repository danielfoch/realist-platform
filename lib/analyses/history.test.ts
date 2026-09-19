import { describe, expect, it } from "vitest";
import { dealKeyFor } from "./dealKey";
import { reopenHref } from "./history";

const manual = {
  mlsNumber: null,
  address: "45 Secret Ave, Hamilton, ON",
  city: "Hamilton",
  province: "ON",
  price: 749_900.4,
  monthlyRent: 4200,
  units: 2,
};

/** What /underwrite does with the link: join the parts back into one address. */
function rebuilt(href: string): string {
  const params = new URL(href, "https://realist.ca").searchParams;
  return [params.get("address"), params.get("city"), params.get("province")].filter(Boolean).join(", ");
}

describe("reopenHref", () => {
  it("sends a listing to its listing page", () => {
    expect(reopenHref({ ...manual, mlsNumber: "X 50/1" })).toBe("/listings/X%2050%2F1");
  });

  it("reopens an off-market deal in the underwriter with its basics", () => {
    expect(reopenHref(manual)).toBe("/underwrite?address=45+Secret+Ave&city=Hamilton&province=ON&price=749900&rent=4200&units=2");
  });

  it("round-trips to the same deal, so reopening never logs a duplicate", () => {
    for (const row of [manual, { ...manual, province: null, address: "45 Secret Ave, Hamilton" }, { ...manual, city: null, province: null, address: "45 Secret Ave" }]) {
      const href = reopenHref(row);
      expect(href).not.toBeNull();
      expect(dealKeyFor({ address: rebuilt(href as string) })).toBe(dealKeyFor({ address: row.address }));
    }
  });

  it("passes the address whole when it wasn't stored as street, city, province", () => {
    const href = reopenHref({ ...manual, address: "Lot 7 Concession 4 near Hamilton" }) as string;
    expect(rebuilt(href)).toBe("Lot 7 Concession 4 near Hamilton");
  });

  it("leaves out numbers it doesn't have and gives up without an address", () => {
    expect(reopenHref({ ...manual, monthlyRent: null, units: null })).toBe("/underwrite?address=45+Secret+Ave&city=Hamilton&province=ON&price=749900");
    expect(reopenHref({ ...manual, address: null })).toBeNull();
    expect(reopenHref({ ...manual, address: "n/a" })).toBeNull();
  });
});

describe("reopenHref for a multiplex underwrite", () => {
  const lot = { mlsNumber: null, address: "270 Indian Rd, Toronto", city: "Toronto", province: "ON", price: 1_900_000, monthlyRent: null, units: 4 };

  it("reopens the full report, not the rental underwriter", () => {
    expect(reopenHref({ ...lot, source: "multiplex", reportToken: "abc123" })).toBe("/multiplex/r/abc123");
  });

  it("falls back to the tool when the report link is gone", () => {
    expect(reopenHref({ ...lot, source: "multiplex", reportToken: null })).toBe("/multiplex");
  });
});

describe("publicName", () => {
  it("shows a person as First L.", async () => {
    const { publicName } = await import("./dealKey");
    expect(publicName("Dana Marie Tester")).toBe("Dana T.");
    expect(publicName("Jean-Luc O'Brien")).toBe("Jean-Luc O.");
    expect(publicName("Zoë")).toBe("Zoë");
  });

  it("never turns the board into an advertisement", async () => {
    const { publicName } = await import("./dealKey");
    for (const hostile of ["scam-site.com", "BuyCrypto4U", "@handle", "<b>Dana</b>", "http://x.co", "Dana 💰", "", null]) {
      expect(publicName(hostile), String(hostile)).toBe("Realist member");
    }
  });
});
