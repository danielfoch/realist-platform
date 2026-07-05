import { isStaticAssetRequest } from '../src/static-asset-request';

function req(method: string, path: string) {
  return { method, path };
}

describe('isStaticAssetRequest', () => {
  it('skips static frontend assets and safe public files', () => {
    expect(isStaticAssetRequest(req('GET', '/assets/CapRates-abc123.js'))).toBe(true);
    expect(isStaticAssetRequest(req('GET', '/assets/leaflet-xyz.css'))).toBe(true);
    expect(isStaticAssetRequest(req('HEAD', '/icons/icon-192.png'))).toBe(true);
    expect(isStaticAssetRequest(req('GET', '/sw.js'))).toBe(true);
    expect(isStaticAssetRequest(req('GET', '/manifest.webmanifest'))).toBe(true);
    expect(isStaticAssetRequest(req('GET', '/favicon.ico'))).toBe(true);
  });

  it('does not skip API, HTML, or non-GET asset-looking requests', () => {
    expect(isStaticAssetRequest(req('GET', '/api/rents/pulse'))).toBe(false);
    expect(isStaticAssetRequest(req('POST', '/api/ddf/listings'))).toBe(false);
    expect(isStaticAssetRequest(req('GET', '/tools/cap-rates'))).toBe(false);
    expect(isStaticAssetRequest(req('POST', '/assets/upload.js'))).toBe(false);
  });
});
