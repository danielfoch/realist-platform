import "./testEnv";
import { describe, expect, it } from "vitest";
import { classifyCoaDecision } from "./precedents";

describe("classifyCoaDecision", () => {
  it("maps approval phrasings", () => {
    expect(classifyCoaDecision("Approved")).toBe("approved");
    expect(classifyCoaDecision("Approved with Conditions")).toBe("approved");
    expect(classifyCoaDecision("Conditional Approval")).toBe("approved");
    expect(classifyCoaDecision("Application Granted")).toBe("approved");
  });
  it("maps refusal phrasings", () => {
    expect(classifyCoaDecision("Refused")).toBe("refused");
    expect(classifyCoaDecision("Denied")).toBe("refused");
    expect(classifyCoaDecision("Dismissed")).toBe("refused");
  });
  it("treats blanks / withdrawals / deferrals as other", () => {
    expect(classifyCoaDecision(null)).toBe("other");
    expect(classifyCoaDecision("")).toBe("other");
    expect(classifyCoaDecision("Withdrawn")).toBe("other");
    expect(classifyCoaDecision("Deferred")).toBe("other");
  });
});
