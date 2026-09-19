import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { AGENT_API_OPENAPI } from "./agentOpenApi";
import {
  AGENT_API_SCOPES,
  DEFAULT_AGENT_API_SCOPES,
  applyJobTransition,
  canApproveJob,
  canCancelJob,
  contactSchema,
  createAgentJobRequestSchema,
  dealSchema,
  jobRequiresApproval,
  SPECIALIST_REGISTRY,
  listingSchema,
  parseJobInput,
  propertySchema,
  scopesForJobType,
  transactionFileSchema,
  agentOrgSchema,
  type AgentJob,
} from "./agentSpine";

function job(overrides: Partial<AgentJob> = {}): AgentJob {
  return {
    id: "job-1",
    type: "forms.fill",
    status: "needs_approval",
    input: { formId: "orea-123" },
    result: null,
    error: null,
    specialistId: "realist.forms",
    createdByUserId: "user-1",
    createdByApiKeyId: "key-1",
    approvalRequired: true,
    approvedAt: null,
    approvedByUserId: null,
    idempotencyKey: null,
    auditTrail: [],
    createdAt: new Date("2026-09-18T00:00:00.000Z"),
    updatedAt: new Date("2026-09-18T00:00:00.000Z"),
    ...overrides,
  };
}

describe("canonical resource schemas", () => {
  it("accepts a Canadian property with geo and taxes", () => {
    const parsed = propertySchema.safeParse({
      address: "123 King St W",
      city: "Hamilton",
      province: "ON",
      country: "CA",
      geo: { lat: 43.25, lng: -79.87 },
      beds: 3,
      baths: 2,
      units: 2,
      annualPropertyTax: 4200,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a property without an address", () => {
    expect(propertySchema.safeParse({ city: "Toronto" }).success).toBe(false);
  });

  it("accepts a listing keyed by MLS number", () => {
    const parsed = listingSchema.safeParse({
      mlsNumber: "X1234567",
      status: "Active",
      listPrice: 899000,
      daysOnMarket: 12,
      source: "crea_ddf",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a non-CA property and a URL listing without MLS", () => {
    expect(propertySchema.safeParse({
      address: "14 Canal Street",
      city: "Manchester",
      country: "GB",
    }).success).toBe(true);
    const listing = listingSchema.safeParse({
      listPrice: 450000,
      currency: "GBP",
      sourceUrl: "https://www.example.com/listings/14-canal",
      sourceHost: "www.example.com",
      source: "generic-jsonld-og",
    });
    expect(listing.success).toBe(true);
  });

  it("reuses underwrite metrics on a deal", () => {
    const parsed = dealSchema.safeParse({
      mlsNumber: "X1234567",
      strategy: "buyHold",
      assumptions: { downPaymentPercent: 20, vacancyRate: 5 },
      metrics: { capRate: 5.2, monthlyCashFlow: 340, dscr: 1.25 },
    });
    expect(parsed.success).toBe(true);
  });

  it("requires email on a contact (person-spine identity)", () => {
    expect(contactSchema.safeParse({ name: "Dan" }).success).toBe(false);
    expect(contactSchema.safeParse({ email: "dan@example.com", name: "Dan" }).success).toBe(true);
  });

  it("accepts a transaction-file placeholder", () => {
    const parsed = transactionFileSchema.safeParse({
      id: "tf-1",
      dealId: "deal-1",
      docClass: "offer",
      status: "placeholder",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts an AgentOrg owned by a user id", () => {
    const parsed = agentOrgSchema.safeParse({ id: "org-1", userId: "user-1" });
    expect(parsed.success).toBe(true);
  });
});

describe("job input validation", () => {
  it("validates underwrite.custom against the existing agent contract", () => {
    const parsed = parseJobInput("underwrite.custom", {
      address: "10 Queen St",
      price: 750000,
      strategyType: "buyHold",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects underwrite.listing without an MLS number", () => {
    expect(parseJobInput("underwrite.listing", {}).success).toBe(false);
  });

  it("accepts listing.extract from a worldwide URL or caller HTML", () => {
    expect(parseJobInput("listing.extract", {}).success).toBe(false);
    expect(parseJobInput("listing.extract", {
      url: "https://www.zillow.com/homedetails/1_zpid/",
      country: "US",
      currency: "USD",
    }).success).toBe(true);
    expect(parseJobInput("listing.extract", {
      html: "<html></html>",
      country: "gb",
    }).success).toBe(true);
  });

  it("requires identity on crm.update and rejects invented-empty creates", () => {
    expect(parseJobInput("crm.update", {}).success).toBe(false);
    expect(parseJobInput("crm.update", {
      action: "upsert_contact",
      contact: { email: "dana@example.com", name: "Dana" },
    }).success).toBe(true);
    expect(parseJobInput("crm.update", { action: "update_stage", contactId: "c1" }).success).toBe(false);
    expect(parseJobInput("crm.update", { action: "update_stage", contactId: "c1", stage: "nurturing" }).success).toBe(true);
  });

  it("requires a create payload with a known job type", () => {
    expect(createAgentJobRequestSchema.safeParse({ type: "nope", input: {} }).success).toBe(false);
    expect(createAgentJobRequestSchema.safeParse({ type: "underwrite.custom", input: {} }).success).toBe(true);
  });
});

describe("job scope + approval policy", () => {
  it("reuses underwrite/read for existing capabilities", () => {
    expect(scopesForJobType("underwrite.listing")).toEqual(["underwrite", "jobs:write"]);
    expect(scopesForJobType("listing.extract")).toEqual(["read", "jobs:write"]);
  });

  it("requires human approval for anything that leaves the building", () => {
    expect(jobRequiresApproval("forms.fill")).toBe(true);
    expect(SPECIALIST_REGISTRY["forms.fill"].implemented).toBe(true);
    expect(SPECIALIST_REGISTRY["forms.fill"].previewOnCreate).toBe(true);
    expect(SPECIALIST_REGISTRY["listing.extract"].implemented).toBe(true);
    expect(jobRequiresApproval("listing.extract")).toBe(false);
    expect(jobRequiresApproval("docs.route")).toBe(true);
    expect(SPECIALIST_REGISTRY["crm.update"].implemented).toBe(true);
    expect(SPECIALIST_REGISTRY["crm.update"].previewOnCreate).toBe(true);
    expect(SPECIALIST_REGISTRY["crm.update"].applyOnApprove).toBe(true);
    expect(jobRequiresApproval("crm.update")).toBe(true);
    expect(scopesForJobType("crm.update")).toEqual(["crm:write", "jobs:write"]);
    expect(jobRequiresApproval("underwrite.custom")).toBe(false);
    expect(jobRequiresApproval("underwrite.custom", true)).toBe(true);
  });
});

describe("job state transitions", () => {
  it("approves only from needs_approval and records audit + approver", () => {
    expect(canApproveJob("queued")).toBe(false);
    const result = applyJobTransition(job(), "approve", "user-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.job.status).toBe("running");
    expect(result.job.approvedByUserId).toBe("user-1");
    expect(result.job.approvedAt).toBeInstanceOf(Date);
    expect(result.job.auditTrail).toHaveLength(1);
    expect(result.job.auditTrail[0]).toMatchObject({
      action: "approve",
      fromStatus: "needs_approval",
      toStatus: "running",
    });
  });

  it("rejects approve from terminal and running states", () => {
    expect(applyJobTransition(job({ status: "succeeded" }), "approve", "user-1").ok).toBe(false);
    expect(applyJobTransition(job({ status: "running" }), "approve", "user-1").ok).toBe(false);
    expect(applyJobTransition(job({ status: "cancelled" }), "approve", "user-1").ok).toBe(false);
  });

  it("cancels queued, running, and needs_approval jobs only", () => {
    expect(canCancelJob("queued")).toBe(true);
    expect(canCancelJob("succeeded")).toBe(false);
    expect(applyJobTransition(job({ status: "queued" }), "cancel", "user-1").ok).toBe(true);
    expect(applyJobTransition(job({ status: "running" }), "cancel", "user-1").ok).toBe(true);
    expect(applyJobTransition(job({ status: "needs_approval" }), "cancel", "user-1").ok).toBe(true);
    expect(applyJobTransition(job({ status: "failed" }), "cancel", "user-1").ok).toBe(false);
  });

  it("starts only from queued and completes only from running", () => {
    const started = applyJobTransition(job({ status: "queued", type: "underwrite.custom" }), "start", null);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const done = applyJobTransition(started.job, "succeed", null, { result: { capRate: 5 } });
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.job.status).toBe("succeeded");
    expect(done.job.result).toEqual({ capRate: 5 });
    expect(applyJobTransition(done.job, "fail", null).ok).toBe(false);
  });
});

describe("auth scope defaults", () => {
  it("adds specialist scopes without changing safe defaults", () => {
    expect(DEFAULT_AGENT_API_SCOPES).toEqual(["read", "underwrite", "deal:submit"]);
    expect(AGENT_API_SCOPES).toEqual(expect.arrayContaining([
      "read",
      "underwrite",
      "community:write",
      "deal:submit",
      "partner:referrals",
      "jobs:write",
      "forms:write",
      "docs:write",
      "crm:write",
    ]));
  });
});

describe("OpenAPI spine", () => {
  it("keeps the YAML file aligned with the served document", () => {
    const yaml = readFileSync(path.resolve(process.cwd(), "docs/openapi/agent-api.yaml"), "utf8");
    const yamlPaths = [...yaml.matchAll(/^  (\/api\/agent\/\S+):$/gm)].map((match) => match[1]);
    expect(yamlPaths.sort()).toEqual(Object.keys(AGENT_API_OPENAPI.paths).sort());
  });
});
