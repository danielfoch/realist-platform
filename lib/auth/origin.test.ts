import { describe, expect, it } from "vitest";
import { isSameOrigin, safeNextPath } from "./origin";

describe("safeNextPath", () => {
  it("keeps ordinary on-site paths, query and hash included", () => {
    expect(safeNextPath("/account")).toBe("/account");
    expect(safeNextPath("/listings/X123?tab=numbers#rent")).toBe("/listings/X123?tab=numbers#rent");
  });

  it("falls back for anything that could leave the site", () => {
    for (const hostile of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "/\t/evil.example",
      "/\n/evil.example",
      "javascript:alert(1)",
      "account",
      "",
    ]) {
      expect(safeNextPath(hostile), JSON.stringify(hostile)).toBe("/account");
    }
    expect(safeNextPath(null)).toBe("/account");
    expect(safeNextPath(undefined, "/deals")).toBe("/deals");
  });
});

describe("isSameOrigin", () => {
  const request = (headers: Record<string, string>) => new Request("https://new.realist.ca/api/saved", { method: "POST", headers });

  it("accepts a matching Origin, or a matching Referer when Origin is absent", () => {
    expect(isSameOrigin(request({ host: "new.realist.ca", origin: "https://new.realist.ca" }))).toBe(true);
    expect(isSameOrigin(request({ host: "new.realist.ca", referer: "https://new.realist.ca/login" }))).toBe(true);
  });

  it("trusts the forwarded host a proxy reports over the internal one", () => {
    expect(
      isSameOrigin(request({ host: "internal:3000", "x-forwarded-host": "realist.ca", origin: "https://realist.ca" })),
    ).toBe(true);
  });

  it("refuses another site, a lookalike host, and an unparseable Origin", () => {
    expect(isSameOrigin(request({ host: "new.realist.ca", origin: "https://evil.example" }))).toBe(false);
    expect(isSameOrigin(request({ host: "realist.ca", origin: "https://realist.ca.evil.example" }))).toBe(false);
    expect(isSameOrigin(request({ host: "realist.ca", origin: "null" }))).toBe(false);
  });

  it("lets header-less non-browser clients through — they carry no ambient cookie", () => {
    expect(isSameOrigin(request({ host: "new.realist.ca" }))).toBe(true);
  });
});
