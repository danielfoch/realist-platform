import { describe, expect, it } from "vitest";
import { boardHref, cityLabel, parseCity, parsePeriod, scoringPoints } from "./board";

describe("parsePeriod", () => {
  it("defaults to the week", () => {
    expect(parsePeriod(undefined)).toBe("week");
    expect(parsePeriod("year")).toBe("week");
    expect(parsePeriod("")).toBe("week");
  });

  it("reads month and all, taking the first of a repeated parameter", () => {
    expect(parsePeriod("month")).toBe("month");
    expect(parsePeriod(["all", "week"])).toBe("all");
  });
});

describe("parseCity", () => {
  it("accepts a plain city name", () => {
    expect(parseCity(" Hamilton ")).toBe("Hamilton");
    expect(parseCity(["Calgary", "Toronto"])).toBe("Calgary");
  });

  it("rejects blanks, addresses and anything oversized", () => {
    expect(parseCity(undefined)).toBeNull();
    expect(parseCity("")).toBeNull();
    expect(parseCity("12 Main St")).toBeNull();
    expect(parseCity("x".repeat(200))).toBeNull();
  });
});

describe("boardHref", () => {
  it("leaves the defaults out so each view has one URL", () => {
    expect(boardHref()).toBe("/community/leaderboard");
    expect(boardHref({ period: "week", city: null })).toBe("/community/leaderboard");
  });

  it("carries the period and the market", () => {
    expect(boardHref({ period: "all" })).toBe("/community/leaderboard?period=all");
    expect(boardHref({ period: "month", city: "St. Catharines" })).toBe("/community/leaderboard?period=month&city=St.+Catharines");
  });
});

describe("cityLabel", () => {
  it("capitalises a hand-typed lowercase city", () => {
    expect(cityLabel("st. catharines")).toBe("St. Catharines");
    expect(cityLabel("montréal")).toBe("Montréal");
  });

  it("leaves a city that already has capitals alone", () => {
    expect(cityLabel("Salaberry-de-Valleyfield")).toBe("Salaberry-de-Valleyfield");
  });
});

describe("scoringPoints", () => {
  it("quotes what the scoring function actually awards, and careful beats careless", () => {
    const points = scoringPoints();
    expect(points).toEqual({ untouched: 2.5, light: 7, worked: 10 });
    expect(points.worked).toBeGreaterThan(points.light);
    expect(points.light).toBeGreaterThan(points.untouched);
  });
});
