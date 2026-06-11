import { isInternalTestEmail } from "../server/leadGuards";

describe("isInternalTestEmail", () => {
  it("identifies QA/test lead emails before production alerts fire", () => {
    expect(isInternalTestEmail("jane.test@example.com")).toBe(true);
    expect(isInternalTestEmail("alex.chen.test2@example.com")).toBe(true);
    expect(isInternalTestEmail("buyer+qa@realist.ca")).toBe(true);
    expect(isInternalTestEmail("demo-lead@realist.ca")).toBe(true);
  });

  it("does not block normal prospect emails", () => {
    expect(isInternalTestEmail("vincent@example.ca")).toBe(false);
    expect(isInternalTestEmail("investor@realist.ca")).toBe(false);
    expect(isInternalTestEmail("alex.chen@gmail.com")).toBe(false);
  });
});
