import { afterEach, describe, expect, it, vi } from "vitest";
import { modelFor } from "./models";

afterEach(() => vi.unstubAllEnvs());

describe("which model each paid feature uses", () => {
  it("puts the most-called, least-demanding job on the small model by default", () => {
    expect(modelFor("memo")).toBe("claude-haiku-4-5-20251001");
    expect(modelFor("ask")).toBe("claude-sonnet-5");
    expect(modelFor("report")).toBe("claude-sonnet-5");
  });

  it("can be changed per feature, or all at once, without new code", () => {
    vi.stubEnv("AI_MODEL", "claude-haiku-4-5-20251001");
    expect(modelFor("ask")).toBe("claude-haiku-4-5-20251001");
    vi.stubEnv("AI_MODEL_ASK", "claude-sonnet-5");
    expect(modelFor("ask")).toBe("claude-sonnet-5");
    expect(modelFor("report")).toBe("claude-haiku-4-5-20251001");
  });
});
