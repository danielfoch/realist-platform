/**
 * docs.route — classify a user-supplied deal document, propose a
 * TransactionFile stub, persist metadata only after approve.
 * Cancel leaves the store unchanged. Realist-only.
 */
import { randomUUID } from "crypto";
import {
  classifyDocument,
  docsRouteInputSchema,
  type DocsRouteClassification,
  type DocsRouteInput,
} from "@shared/docsRoute";
import { AgentJobError } from "./agentJobs";

export type RoutedTransactionFile = {
  id: string;
  ownerUserId: string;
  dealId: string | null;
  analysisId: string | null;
  mlsNumber: string | null;
  docClass: string;
  filename: string;
  status: "pending" | "ready";
  sourceJobId: string | null;
};

export interface AgentDocsStore {
  listForTarget(ownerUserId: string, target: { dealId?: string | null; analysisId?: string | null; mlsNumber?: string | null }): Promise<RoutedTransactionFile[]>;
  insert(row: RoutedTransactionFile): Promise<RoutedTransactionFile>;
}

export function createMemoryDocsStore(seed: RoutedTransactionFile[] = []): AgentDocsStore {
  const rows = [...seed];
  return {
    async listForTarget(ownerUserId, target) {
      return rows.filter((row) => {
        if (row.ownerUserId !== ownerUserId) return false;
        if (target.dealId && row.dealId === target.dealId) return true;
        if (target.analysisId && row.analysisId === target.analysisId) return true;
        if (target.mlsNumber && row.mlsNumber === target.mlsNumber) return true;
        return false;
      });
    },
    async insert(row) {
      rows.push(row);
      return row;
    },
  };
}

let store: AgentDocsStore = createMemoryDocsStore();

export function setAgentDocsStore(next: AgentDocsStore) {
  store = next;
}

export function resetAgentDocsStore() {
  store = createMemoryDocsStore();
}

export function getAgentDocsStore(): AgentDocsStore {
  return store;
}

export function parseDocsRouteInput(input: unknown): DocsRouteInput {
  const parsed = docsRouteInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new AgentJobError(400, "invalid_input", parsed.error.issues.map((issue) => issue.message).join("; "));
  }
  return parsed.data;
}

export async function previewDocsRoute(input: unknown, userId: string): Promise<Record<string, unknown>> {
  const parsed = parseDocsRouteInput(input);
  const existing = await store.listForTarget(userId, parsed);
  const presentFromHints = Array.isArray(parsed.hints?.presentClasses)
    ? (parsed.hints!.presentClasses as unknown[]).map((item) => String(item))
    : [];
  const classification = classifyDocument(parsed, [
    ...existing.map((row) => row.docClass),
    ...presentFromHints,
  ]);
  return {
    dryRun: true,
    ...classification,
    transactionFile: proposedFile(classification, parsed, userId, null),
  };
}

export async function applyDocsRoute(
  input: unknown,
  userId: string,
  ctx: { jobId: string; previousResult: Record<string, unknown> | null },
): Promise<Record<string, unknown>> {
  const parsed = parseDocsRouteInput(input);
  const existing = await store.listForTarget(userId, parsed);
  const presentFromHints = Array.isArray(parsed.hints?.presentClasses)
    ? (parsed.hints!.presentClasses as unknown[]).map((item) => String(item))
    : [];
  const classification = classifyDocument(parsed, [
    ...existing.map((row) => row.docClass),
    ...presentFromHints,
  ]);
  const proposed = (ctx.previousResult?.transactionFile && typeof ctx.previousResult.transactionFile === "object")
    ? ctx.previousResult.transactionFile as Record<string, unknown>
    : proposedFile(classification, parsed, userId, ctx.jobId);

  if (!classification.target.resolved) {
    return {
      dryRun: false,
      applied: false,
      ...classification,
      transactionFile: null,
      warnings: [
        ...classification.warnings,
        "Approve did not persist attachment metadata because no deal target was resolved.",
      ],
    };
  }

  const row = await store.insert({
    id: String(proposed.id || `tf_${ctx.jobId}`),
    ownerUserId: userId,
    dealId: classification.target.dealId,
    analysisId: classification.target.analysisId,
    mlsNumber: classification.target.mlsNumber,
    docClass: classification.docClass,
    filename: classification.suggestedFilename,
    status: "ready",
    sourceJobId: ctx.jobId,
  });

  return {
    dryRun: false,
    applied: true,
    ...classification,
    transactionFile: {
      id: row.id,
      dealId: row.dealId || ctx.jobId,
      docClass: row.docClass,
      status: row.status,
      label: row.filename,
    },
  };
}

function proposedFile(
  classification: DocsRouteClassification,
  input: DocsRouteInput,
  userId: string,
  jobId: string | null,
) {
  return {
    id: jobId ? `tf_${jobId}` : `tf_pending_${userId.slice(0, 8)}`,
    dealId: classification.target.dealId || classification.target.analysisId || classification.target.mlsNumber || "unattached",
    docClass: classification.docClass,
    status: "pending",
    label: classification.suggestedFilename,
    ownerUserId: userId,
    filename: input.filename || classification.suggestedFilename,
  };
}
