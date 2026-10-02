import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ token: vi.fn(), enrich: vi.fn() }));
vi.mock("@/lib/auth/throttle", () => ({ clientIp: () => "127.0.0.1", takeToken: state.token }));
vi.mock("./service", () => ({ enrichProperty: state.enrich }));
import { propertyGet } from "./route";
beforeEach(() => { state.token.mockReset().mockResolvedValue(true); state.enrich.mockReset().mockResolvedValue({ success: true, status: "partial" }); });
describe("anonymous property endpoint", () => {
  it("returns discoverable instructions without consuming lookup quota", async () => {
    const r = await propertyGet(new Request("https://example.com/api/property"));
    expect(r.status).toBe(200); expect((await r.json()).authentication).toBe("none"); expect(state.token).not.toHaveBeenCalled();
  });
  it("rejects bad coordinates, duplicate and unknown parameters before hitting a provider", async () => {
    for (const query of ["lat=&lng=", "lat=43.6", "address=123%20Main%20St&address=456%20Main%20St", "address=123%20Main%20St&url=http://localhost"]) {
      const r = await propertyGet(new Request(`https://example.com/api/property?${query}`));
      expect(r.status).toBe(400);
    }
    expect(state.enrich).not.toHaveBeenCalled(); expect(state.token).not.toHaveBeenCalled();
  });
  it("enriches without a credential and provides public CORS", async () => {
    const r = await propertyGet(new Request("https://example.com/api/property?address=15%20Deermeade%20Pl%20SE%2C%20Calgary%2C%20AB"));
    expect(r.status).toBe(200); expect(state.enrich).toHaveBeenCalledWith({ address: "15 Deermeade Pl SE, Calgary, AB" }); expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
  it("honours both request ceilings, returning Retry-After without enrichment", async () => {
    state.token.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const r = await propertyGet(new Request("https://example.com/api/property?address=90%20Ash%20Crescent%2C%20Toronto"));
    expect(r.status).toBe(429); expect(r.headers.get("Retry-After")).toBe("60"); expect(state.enrich).not.toHaveBeenCalled();
  });
  it("keeps exception contents and credentials out of error responses", async () => {
    state.enrich.mockRejectedValue(new Error("postgres://private-password"));
    const r = await propertyGet(new Request("https://example.com/api/property?address=90%20Ash%20Crescent%2C%20Toronto"));
    expect(r.status).toBe(503); expect(await r.text()).not.toContain("private-password");
  });
});
