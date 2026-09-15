import { describe, expect, it, vi } from "vitest";
import { isKeyprCashbackRequest, keyprContactSchema, normalizeKeyprPhone } from "../shared/keypr";
import { deliverKeyprLead, KEYPR_ENDPOINT, keyprPayload, retryDelayMs } from "./keyprWebhook";

const contact = { firstName: "Ada", lastName: "Lovelace", email: "ADA@example.com", phone: "(416) 555-0100", consent: true };
const payload = keyprPayload("R-12345", contact);
describe("Keypr routing and contact validation", () => {
  it("routes only Ontario cashback; a tag alone never routes a lead", () => {
    expect(isKeyprCashbackRequest({ formTag: "cashback_request", province: "ON" })).toBe(true);
    for (const body of [
      {formTag:"mortgage_consultation",province:"ON",tags:["Keypr"]},
      {formTag:"local_expert_request",province:"ON"},
      {formTag:"cashback_request",province:"BC"},
      {formTag:"cashback_request",province:""},
      {formTag:"cashback_request",province:"ON",country:"usa"},
    ]) expect(isKeyprCashbackRequest(body)).toBe(false);
  });
  it("requires all four contact fields and explicit consent", () => {
    expect(keyprContactSchema.safeParse(contact).success).toBe(true);
    for (const patch of [{firstName:""},{lastName:" "},{email:"invalid"},{phone:"----------"},{consent:false},{consent:"true"}]) {
      expect(keyprContactSchema.safeParse({...contact,...patch}).success).toBe(false);
    }
  });
  it("normalizes supported phone formats and emits only the five requested fields", () => {
    expect(normalizeKeyprPhone("1-416-555-0100")).toBe("+14165550100");
    expect(normalizeKeyprPhone("+442079460000")).toBe("+442079460000");
    expect(payload).toEqual({lead_id:"R-12345",first_name:"Ada",last_name:"Lovelace",email:"ada@example.com",phone:"+14165550100"});
  });
});
describe("Keypr HTTP contract", () => {
  it.each([201,202])("accepts %i and stores the partner reference", async status => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({lead_ref:"a".repeat(32)}),{status}));
    expect(await deliverKeyprLead(payload,"test-only-secret",fetcher)).toEqual({status:"sent",code:String(status),leadRef:"a".repeat(32)});
    expect(fetcher).toHaveBeenCalledWith(KEYPR_ENDPOINT,expect.objectContaining({method:"POST",redirect:"error",body:JSON.stringify(payload),headers:{"Content-Type":"application/json","X-Realist-Secret":"test-only-secret"}}));
  });
  it.each([400,401,403,302])("stops on %i without exposing the response body",async status => {
    const fetcher=vi.fn().mockResolvedValue(new Response("private upstream error",{status}));
    expect(await deliverKeyprLead(payload,"test-only-secret",fetcher)).toEqual({status:"failed",code:String(status)});
  });
  it.each([500,502,503,429])("retries %i",async status => {
    expect(await deliverKeyprLead(payload,"test-only-secret",vi.fn().mockResolvedValue(new Response("",{status})))).toEqual({status:"retry",code:String(status)});
  });
  it("retries network/timeouts with an identical lead identifier and body",async () => {
    const fetcher=vi.fn().mockRejectedValue(new Error("timeout"));
    await deliverKeyprLead(payload,"test-only-secret",fetcher);
    expect(await deliverKeyprLead(payload,"test-only-secret",fetcher)).toEqual({status:"retry",code:"network_or_timeout"});
    expect(fetcher.mock.calls[0][1].body).toBe(fetcher.mock.calls[1][1].body);
    expect([1,2,3,4].map(retryDelayMs)).toEqual([60_000,300_000,1_800_000,1_800_000]);
  });
});
