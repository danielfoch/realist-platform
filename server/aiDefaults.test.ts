import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  insertMock: vi.fn(),
  valuesMock: vi.fn(),
}));

vi.mock("./db", () => ({
  db: {
    insert: mocks.insertMock,
  },
}));

import { modelPredictions } from "@shared/schema";
import { recordMarketDefaultPredictions } from "./aiDefaults";
import { MARKET_DEFAULTS_MODEL_KEY, MARKET_DEFAULTS_VERSION } from "./rentIntelligence";

describe("recordMarketDefaultPredictions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.valuesMock.mockResolvedValue(undefined);
    mocks.insertMock.mockReturnValue({ values: mocks.valuesMock });
  });

  it("writes ai_market_defaults priors to model_predictions shape", async () => {
    await recordMarketDefaultPredictions([
      {
        market: "hamilton",
        strategy: "all",
        metric: "market_rent_2br",
        value: 2250,
        p25: 2100,
        p75: 2400,
        sample_size: 42,
      },
    ]);

    expect(mocks.insertMock).toHaveBeenCalledWith(modelPredictions);
    expect(mocks.valuesMock).toHaveBeenCalledWith([
      expect.objectContaining({
        modelKey: MARKET_DEFAULTS_MODEL_KEY,
        modelVersion: MARKET_DEFAULTS_VERSION,
        subjectId: "hamilton:all:market_rent_2br",
        predictedValue: 2250,
        intervalLow: 2100,
        intervalHigh: 2400,
        method: "ai_market_defaults",
        city: "hamilton",
        bedrooms: "2",
      }),
    ]);
  });

  it("skips empty or non-numeric priors", async () => {
    await recordMarketDefaultPredictions([{ market: "x", metric: "cap_rate", value: "nope" }]);

    expect(mocks.insertMock).not.toHaveBeenCalled();
  });
});
