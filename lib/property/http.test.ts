import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchBytes } from "./http";
const url = new URL("https://quintewest.maps.arcgis.com/sharing/rest/content/items/2d74bbcab91441209f5669908ec31ad6/data");
const binding = { origin: "https://www.arcgis.com", pathname: "/itemdata/pinned/pinned/licence.pdf" };
afterEach(() => vi.unstubAllGlobals());
describe("bounded publisher licence file redirects", () => {
  it("follows one exact allowed publisher file with the original timeout/cache bounds and rejects a second hop", async () => {
    const request = vi.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: binding.origin + binding.pathname + "?signature=temporary" } })).mockResolvedValueOnce(new Response("licence")); vi.stubGlobal("fetch", request);
    expect(new TextDecoder().decode(await fetchBytes(url, 8000, 3600, binding))).toBe("licence"); expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0][1].redirect).toBe("manual"); expect(request.mock.calls[1][1].redirect).toBe("error"); expect(request.mock.calls[1][1].signal).toBe(request.mock.calls[0][1].signal); expect(request.mock.calls[1][1].next).toEqual({ revalidate: 3600 });
  });
  it("rejects off-host, insecure, changed-file, credential-bearing and fragment redirects before a second fetch", async () => {
    for (const location of ["https://evil.invalid" + binding.pathname, "http://www.arcgis.com" + binding.pathname, binding.origin + "/different.pdf", "https://user@www.arcgis.com" + binding.pathname, binding.origin + binding.pathname + "#fragment"]) {
      const request = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location } })); vi.stubGlobal("fetch", request);
      await expect(fetchBytes(url, 8000, 3600, binding)).rejects.toThrow("Unsupported publisher file redirect"); expect(request).toHaveBeenCalledTimes(1);
    }
  });
  it("keeps ordinary provider calls redirect-disabled and preserves the one-megabyte body limit", async () => {
    const request = vi.fn().mockResolvedValue(new Response("source")); vi.stubGlobal("fetch", request); await fetchBytes(new URL("https://www.arcgis.com/sharing/rest/search")); expect(request.mock.calls[0][1].redirect).toBe("error");
    request.mockResolvedValue(new Response(new Uint8Array(1_000_001))); await expect(fetchBytes(url)).rejects.toThrow("Source response too large");
    request.mockClear(); await expect(fetchBytes(new URL("https://evil.invalid/file"))).rejects.toThrow("Unsupported provider"); expect(request).not.toHaveBeenCalled();
  });
});
