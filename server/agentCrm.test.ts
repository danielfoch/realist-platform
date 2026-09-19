import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ db: {}, pool: {} }));
vi.mock("./personSpine", () => ({ linkPersonByEmail: async () => null }));

import { applyCrmUpdate, createMemoryCrmStore, previewCrmUpdate, resetAgentCrmStore, setAgentCrmStore } from "./agentCrm";
import { AgentJobError } from "./agentJobs";

const owner = "user-1";

function seed(overrides: Record<string, unknown> = {}) {
  return createMemoryCrmStore([{
    id: "c1",
    ownerUserId: owner,
    name: "Pat Lee",
    email: "pat@example.com",
    phone: "4165550100",
    stage: "new",
    contactType: "investor",
    source: "web",
    targetMarket: "Hamilton",
    lastTouchAt: null,
    data: {},
    archived: false,
    ...overrides,
  }]);
}

afterEach(() => {
  resetAgentCrmStore();
});

describe("previewCrmUpdate", () => {
  it("proposes an upsert create without writing", async () => {
    const memory = createMemoryCrmStore();
    setAgentCrmStore(memory);
    const preview = await previewCrmUpdate({
      action: "upsert_contact",
      contact: { email: "dana@example.com", name: "Dana Ng" },
    }, owner);
    expect(preview.dryRun).toBe(true);
    expect(preview.proposedDiff.before).toBeNull();
    expect(preview.proposedDiff.after.name).toBe("Dana Ng");
    expect(preview.proposedDiff.after.email).toBe("dana@example.com");
    expect(memory.rows).toHaveLength(0);
  });

  it("proposes a stage change on an owned contact", async () => {
    setAgentCrmStore(seed());
    const preview = await previewCrmUpdate({
      action: "update_stage",
      contactId: "c1",
      stage: "nurturing",
    }, owner);
    expect(preview.proposedDiff.changes).toEqual([
      { field: "stage", from: "new", to: "nurturing" },
    ]);
  });

  it("does not invent a name when creating", async () => {
    setAgentCrmStore(createMemoryCrmStore());
    await expect(previewCrmUpdate({
      action: "upsert_contact",
      contact: { email: "anon@example.com" },
    }, owner)).rejects.toMatchObject({ code: "name_required" });
  });

  it("fails update-only when the contact is not in this book", async () => {
    setAgentCrmStore(seed({ ownerUserId: "other-user" }));
    await expect(previewCrmUpdate({
      action: "update_stage",
      contactId: "c1",
      stage: "client",
    }, owner)).rejects.toMatchObject({ code: "contact_not_found" });
  });
});

describe("applyCrmUpdate", () => {
  it("writes only on apply and records an activity", async () => {
    const memory = createMemoryCrmStore();
    setAgentCrmStore(memory);
    const input = {
      action: "upsert_contact" as const,
      contact: { email: "dana@example.com", name: "Dana Ng" },
    };
    const preview = await previewCrmUpdate(input, owner);
    expect(memory.rows).toHaveLength(0);
    const applied = await applyCrmUpdate(input, owner, preview);
    expect(applied.applied).toBe(true);
    expect(memory.rows).toHaveLength(1);
    expect(memory.rows[0].email).toBe("dana@example.com");
    expect(memory.activities.some((item) => item.kind === "system")).toBe(true);
  });

  it("rejects apply when the live row drifted", async () => {
    const memory = seed();
    setAgentCrmStore(memory);
    const input = { action: "update_stage" as const, contactId: "c1", stage: "contacted" };
    const preview = await previewCrmUpdate(input, owner);
    memory.rows[0].stage = "lost";
    await expect(applyCrmUpdate(input, owner, preview)).rejects.toBeInstanceOf(AgentJobError);
    await expect(applyCrmUpdate(input, owner, preview)).rejects.toMatchObject({ code: "conflict" });
    expect(memory.rows[0].stage).toBe("lost");
  });

  it("adds a note without changing identity fields", async () => {
    const memory = seed();
    setAgentCrmStore(memory);
    const applied = await applyCrmUpdate({
      action: "add_note",
      contactId: "c1",
      note: "Called; wants a duplex in Hamilton.",
    }, owner);
    expect(applied.after.email).toBe("pat@example.com");
    expect(applied.after.name).toBe("Pat Lee");
    expect(memory.activities.some((item) => item.kind === "note" && item.body === "Called; wants a duplex in Hamilton.")).toBe(true);
  });
});
