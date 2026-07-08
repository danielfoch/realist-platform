import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "./queryClient";

describe("apiRequest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws friendly JSON API messages instead of raw response bodies", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "Invalid email or password", code: "BAD_LOGIN" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(apiRequest("POST", "/api/auth/login", { email: "x@example.com" })).rejects.toMatchObject({
      message: "Invalid email or password",
      status: 401,
      code: "BAD_LOGIN",
    });
  });
});
