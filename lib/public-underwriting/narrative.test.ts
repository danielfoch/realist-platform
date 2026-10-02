import { expect, it, vi } from "vitest";
const provider = vi.hoisted(() => vi.fn());
vi.mock("@anthropic-ai/sdk", () => ({ default: provider }));
import { writeMultiplexReport } from "@/lib/multiplex/reportWriter";

it("never initializes a paid model for a public multiplex narrative, even with a configured key", async () => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key-that-must-not-be-used");
  try {
    const result = await writeMultiplexReport({ address: "Sample Toronto site", site: { zoning: null, trees: { status: "unavailable" }, heritage: { status: "unavailable" }, trca: { status: "unavailable" }, notes: [] }, underwrite: { configs: [], maxUnitsAsOfRight: 4 } }, { useAi: false });
    expect(result.source).toBe("template");
    expect(provider).not.toHaveBeenCalled();
  } finally { vi.unstubAllEnvs(); }
});
