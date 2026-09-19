import { afterEach, describe, expect, it } from "vitest";
import { applyDocsRoute, createMemoryDocsStore, previewDocsRoute, resetAgentDocsStore, setAgentDocsStore } from "./agentDocs";

const OFFER = `
AGREEMENT OF PURCHASE AND SALE
OREA Form 100
The Buyer agrees to purchase the property.
This offer to purchase is submitted for consideration.
`;

afterEach(() => {
  resetAgentDocsStore();
});

describe("docs.route preview / apply", () => {
  it("previews a classification without writing", async () => {
    const store = createMemoryDocsStore();
    setAgentDocsStore(store);

    const preview = await previewDocsRoute({
      filename: "offer.pdf",
      textContent: OFFER,
      dealId: "deal-1",
    }, "user-1");

    expect(preview.dryRun).toBe(true);
    expect(preview.docClass).toBe("offer");
    expect(preview.transactionFile).toEqual(expect.objectContaining({ docClass: "offer", status: "pending" }));
    expect(await store.listForTarget("user-1", { dealId: "deal-1" })).toEqual([]);
  });

  it("persists TransactionFile metadata only on apply when a deal target exists", async () => {
    const store = createMemoryDocsStore();
    setAgentDocsStore(store);

    const applied = await applyDocsRoute({
      filename: "offer.pdf",
      textContent: OFFER,
      dealId: "deal-1",
    }, "user-1", { jobId: "job-9", previousResult: null });

    expect(applied.applied).toBe(true);
    expect(applied.transactionFile).toEqual(expect.objectContaining({
      id: "tf_job-9",
      dealId: "deal-1",
      docClass: "offer",
      status: "ready",
    }));
    const rows = await store.listForTarget("user-1", { dealId: "deal-1" });
    expect(rows).toHaveLength(1);
    expect(rows[0].sourceJobId).toBe("job-9");
  });

  it("does not write when approve has no deal target", async () => {
    const store = createMemoryDocsStore();
    setAgentDocsStore(store);

    const applied = await applyDocsRoute({
      filename: "offer.pdf",
      textContent: OFFER,
    }, "user-1", { jobId: "job-8", previousResult: null });

    expect(applied.applied).toBe(false);
    expect(applied.transactionFile).toBeNull();
    expect(await store.listForTarget("user-1", { dealId: "deal-1" })).toEqual([]);
  });

  it("uses already-routed classes when computing missingForClosing", async () => {
    setAgentDocsStore(createMemoryDocsStore([{
      id: "tf-old",
      ownerUserId: "user-1",
      dealId: "deal-1",
      analysisId: null,
      mlsNumber: null,
      docClass: "offer",
      filename: "offer.pdf",
      status: "ready",
      sourceJobId: "job-1",
    }]));

    const preview = await previewDocsRoute({
      filename: "insurance-binder.pdf",
      textContent: "Homeowner's insurance binder. Dwelling coverage. Policy number HO-1.",
      dealId: "deal-1",
      hints: { stage: "financing" },
    }, "user-1");

    expect(preview.docClass).toBe("insurance");
    expect(preview.missingForClosing).toEqual(["mortgage_commitment", "id_document"]);
  });
});
