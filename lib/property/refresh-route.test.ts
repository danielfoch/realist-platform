import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/cron/property-refresh/route";
afterEach(() => vi.unstubAllEnvs());
describe('private refresh triggers', () => {
  it('requires the existing scheduler token for GET', async () => {
    vi.stubEnv('CRON_SECRET', 'scheduler-token');
    expect((await GET(new NextRequest('https://example.com/api/cron/property-refresh'))).status).toBe(401);
  });
  it('does not accept public, wrong or unicode operator tokens', async () => {
    vi.stubEnv('PROPERTY_REFRESH_SECRET', 'operator-token');
    for (const header of ['', 'Bearer wrong', 'Bearer opérator-token']) expect((await POST(new Request('https://example.com/api/cron/property-refresh', { method: 'POST', headers: { authorization: header } }))).status).toBe(401);
  });
});
