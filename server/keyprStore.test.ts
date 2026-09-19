import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn(), deliver: vi.fn() }));
vi.mock("./db", () => ({ pool: {query:mocks.query}, db:{} }));
vi.mock("./personSpine",()=>({linkPersonByEmail:vi.fn()}));
vi.mock("./keyprWebhook",async importOriginal => ({...await importOriginal<typeof import('./keyprWebhook')>(),deliverKeyprLead:mocks.deliver}));
import { drainKeyprOutbox } from "./keyprStore";
const row = {lead_id:"R-123",payload:{lead_id:"R-123"},attempts:1,created_at:new Date()};
beforeEach(()=>{vi.stubEnv("KEYPR_REALIST_SECRET","test-only");mocks.query.mockReset();mocks.deliver.mockReset();});
afterEach(()=>vi.unstubAllEnvs());
describe("durable Keypr queue",()=>{
  it("leaves jobs untouched when credentials are missing",async()=>{
    vi.stubEnv("KEYPR_REALIST_SECRET","");await drainKeyprOutbox();expect(mocks.query).not.toHaveBeenCalled();
  });
  it.each([['sent','201','sent'],['retry','500','pending'],['failed','401','failed']] as const)("persists %s delivery state",async(status,code,saved)=>{
    mocks.query.mockResolvedValueOnce({rows:[row]}).mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[]});
    mocks.deliver.mockResolvedValue({status,code});await drainKeyprOutbox();
    expect(mocks.query.mock.calls[0][0]).toContain('FOR UPDATE SKIP LOCKED');
    expect(mocks.query.mock.calls[1][1]).toEqual(['R-123',saved,code,null,60_000]);
  });
  it("expires old jobs without sending and releases the drain after errors",async()=>{
    mocks.query.mockResolvedValueOnce({rows:[{...row,created_at:new Date(Date.now()-86_400_001)}]}).mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[]});
    await drainKeyprOutbox();expect(mocks.deliver).not.toHaveBeenCalled();
    expect(mocks.query.mock.calls[1][0]).toContain('retry_window_expired');
    mocks.query.mockRejectedValueOnce(new Error('db unavailable'));
    await expect(drainKeyprOutbox()).rejects.toThrow('db unavailable');
    mocks.query.mockResolvedValueOnce({rows:[]});await drainKeyprOutbox();
  });
});
