import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  insertMock: vi.fn(),
  valuesMock: vi.fn(),
  catchMock: vi.fn(),
}));

vi.mock("./db", () => ({
  db: {
    insert: mocks.insertMock,
  },
}));

import {
  hashDemandText,
  logAskRealistInteraction,
  logFindDealsQuery,
  summarizeToolInput,
} from "./demandLedger";

describe("demand ledger helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.catchMock.mockReturnValue(undefined);
    mocks.valuesMock.mockReturnValue({ catch: mocks.catchMock });
    mocks.insertMock.mockReturnValue({ values: mocks.valuesMock });
  });

  it("hashes demand text case-insensitively to the 16-char ledger key", () => {
    expect(hashDemandText(" Duplexes in Hamilton ")).toHaveLength(16);
    expect(hashDemandText(" Duplexes in Hamilton ")).toBe(hashDemandText("duplexes in hamilton"));
  });

  it("summarizes tool inputs without storing raw natural-language queries", () => {
    expect(summarizeToolInput({
      query: "duplexes in Hamilton under 900k",
      city: "Hamilton",
      price: 850000,
      email: "should-not-store@example.com",
    })).toEqual({
      city: "Hamilton",
      price: 850000,
      queryHash: hashDemandText("duplexes in Hamilton under 900k"),
    });
  });

  it("writes Ask Realist rows best-effort", () => {
    logAskRealistInteraction({
      question: "what cap rate should I expect in Hamilton?",
      status: "ok",
      answer: "Use the tool result.",
    });

    expect(mocks.insertMock).toHaveBeenCalledOnce();
    expect(mocks.valuesMock).toHaveBeenCalledWith(expect.objectContaining({
      question: "what cap rate should I expect in Hamilton?",
      status: "ok",
    }));
    expect(mocks.catchMock).toHaveBeenCalledOnce();
  });

  it("writes Find Deals rows with raw query and computed hash", () => {
    logFindDealsQuery({
      rawQuery: "triplexes in London under 800k",
      parsedFilters: { city: "London", maxPrice: 800000 },
      resultCount: 12,
      source: "agent_api",
      userId: "user-1",
    });

    expect(mocks.valuesMock).toHaveBeenCalledWith(expect.objectContaining({
      rawQuery: "triplexes in London under 800k",
      queryHash: hashDemandText("triplexes in London under 800k"),
      resultCount: 12,
      source: "agent_api",
      userId: "user-1",
    }));
  });
});
