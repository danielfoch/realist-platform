/**
 * Agent jobs store — persist + run specialist work for /api/agent/jobs.
 *
 * Handlers are registered by type. Underwrite adapters, forms, and
 * listing.extract are wired from agentApi.ts. Docs / CRM remain stubs.
 */
import { and, desc, eq } from "drizzle-orm";
import { db, pool } from "./db";
import { agentJobs, type AgentJobRow } from "@shared/schema";
import {
  SPECIALIST_REGISTRY,
  applyJobTransition,
  jobRequiresApproval,
  parseJobInput,
  type AgentJob,
  type AgentJobAuditEntry,
  type AgentJobType,
  type CreateAgentJobRequest,
} from "@shared/agentSpine";

export class AgentJobError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(message || code);
    this.name = "AgentJobError";
  }
}

export type SpecialistExecutor = (
  input: Record<string, unknown>,
  ctx: {
    userId: string;
    apiKeyId: string | null;
    jobId: string;
    mode: "preview" | "apply";
    previousResult: Record<string, unknown> | null;
  },
) => Promise<Record<string, unknown>>;

const executors = new Map<AgentJobType, SpecialistExecutor>();

export function registerSpecialistExecutor(type: AgentJobType, execute: SpecialistExecutor) {
  executors.set(type, execute);
}

function stubExecutor(type: AgentJobType): SpecialistExecutor {
  return async (input) => ({
    stub: true,
    // TODO: replace when the specialist ships. Approval still gates
    // forms / docs / CRM so nothing leaves Realist in P0.
    todo: `${SPECIALIST_REGISTRY[type].specialistId} is not implemented yet`,
    specialistId: SPECIALIST_REGISTRY[type].specialistId,
    input,
  });
}

const AGENT_JOBS_DDL = `
  CREATE TABLE IF NOT EXISTS agent_jobs (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    type text NOT NULL,
    status text NOT NULL DEFAULT 'queued',
    input jsonb NOT NULL DEFAULT '{}'::jsonb,
    result jsonb,
    error text,
    specialist_id text,
    created_by_user_id varchar NOT NULL,
    created_by_api_key_id varchar,
    approval_required boolean NOT NULL DEFAULT false,
    approved_at timestamp,
    approved_by_user_id varchar,
    idempotency_key text,
    audit_trail jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_agent_jobs_user_created
    ON agent_jobs (created_by_user_id, created_at);
  CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_jobs_user_idempotency
    ON agent_jobs (created_by_user_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
`;

let schemaReady: Promise<void> | undefined;

export async function initializeAgentJobs(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('agent-jobs-schema'))");
    await client.query(AGENT_JOBS_DDL);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function ensureAgentJobs(): Promise<void> {
  return (schemaReady ??= initializeAgentJobs().catch((error) => {
    schemaReady = undefined;
    throw error;
  }));
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asAuditTrail(value: unknown): AgentJobAuditEntry[] {
  return Array.isArray(value) ? (value as AgentJobAuditEntry[]) : [];
}

export function rowToAgentJob(row: AgentJobRow): AgentJob {
  return {
    id: row.id,
    type: row.type as AgentJobType,
    status: row.status as AgentJob["status"],
    input: asRecord(row.input),
    result: row.result == null ? null : asRecord(row.result),
    error: row.error ?? null,
    specialistId: row.specialistId ?? null,
    createdByUserId: row.createdByUserId,
    createdByApiKeyId: row.createdByApiKeyId ?? null,
    approvalRequired: Boolean(row.approvalRequired),
    approvedAt: row.approvedAt ?? null,
    approvedByUserId: row.approvedByUserId ?? null,
    idempotencyKey: row.idempotencyKey ?? null,
    auditTrail: asAuditTrail(row.auditTrail),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

export function serializeAgentJob(job: AgentJob) {
  return {
    ...job,
    createdAt: toIso(job.createdAt),
    updatedAt: toIso(job.updatedAt),
    approvedAt: toIso(job.approvedAt),
  };
}

async function persistJob(job: AgentJob): Promise<AgentJob> {
  const [row] = await db.update(agentJobs).set({
    status: job.status,
    input: job.input,
    result: job.result,
    error: job.error,
    specialistId: job.specialistId,
    approvalRequired: job.approvalRequired,
    approvedAt: job.approvedAt ? new Date(job.approvedAt) : null,
    approvedByUserId: job.approvedByUserId,
    auditTrail: job.auditTrail,
    updatedAt: new Date(),
  }).where(eq(agentJobs.id, job.id)).returning();
  if (!row) throw new AgentJobError(500, "job_persist_failed");
  return rowToAgentJob(row);
}

async function loadOwnedJob(id: string, userId: string): Promise<AgentJob> {
  const [row] = await db.select().from(agentJobs)
    .where(and(eq(agentJobs.id, id), eq(agentJobs.createdByUserId, userId)))
    .limit(1);
  if (!row) throw new AgentJobError(404, "job_not_found");
  return rowToAgentJob(row);
}

async function findByIdempotency(userId: string, key: string): Promise<AgentJob | null> {
  const [row] = await db.select().from(agentJobs)
    .where(and(eq(agentJobs.createdByUserId, userId), eq(agentJobs.idempotencyKey, key)))
    .limit(1);
  return row ? rowToAgentJob(row) : null;
}

async function executeSpecialist(job: AgentJob, mode: "preview" | "apply"): Promise<Record<string, unknown>> {
  const execute = executors.get(job.type) ?? stubExecutor(job.type);
  return execute(job.input, {
    userId: job.createdByUserId,
    apiKeyId: job.createdByApiKeyId,
    jobId: job.id,
    mode,
    previousResult: job.result,
  });
}

function withFormsTransactionFile(job: AgentJob, result: Record<string, unknown>): Record<string, unknown> {
  if (job.type !== "forms.fill") return result;
  const formId = String(job.input.formId || "");
  const deal = job.input.deal && typeof job.input.deal === "object" ? job.input.deal as Record<string, unknown> : {};
  const docClass = formId === "orea-101" ? "amendment"
    : formId === "orea-105" ? "waiver"
      : formId === "orea-100" ? "offer"
        : "other";
  return {
    ...result,
    transactionFile: {
      id: `tf_${job.id}`,
      dealId: job.input.dealId || deal.id || job.id,
      docClass,
      status: "ready",
      label: formId,
    },
  };
}

/** Run the handler and store a draft result without leaving needs_approval. */
export async function previewAgentJob(jobId: string, userId: string): Promise<AgentJob> {
  await ensureAgentJobs();
  const job = await loadOwnedJob(jobId, userId);
  if (job.status !== "needs_approval") return job;
  try {
    const result = await executeSpecialist(job, "preview");
    const note = "preview_for_human_approval";
    const entry = {
      at: new Date().toISOString(),
      action: "preview",
      actorUserId: userId,
      fromStatus: job.status,
      toStatus: job.status,
      note,
    };
    return persistJob({
      ...job,
      result: withFormsTransactionFile(job, result),
      error: null,
      auditTrail: [...job.auditTrail, entry],
      updatedAt: new Date(),
    });
  } catch (err: any) {
    if (err instanceof AgentJobError) throw err;
    throw new AgentJobError(400, err?.code || "preview_failed", err?.message || "preview failed");
  }
}

export async function runAgentJob(jobId: string, userId: string): Promise<AgentJob> {
  await ensureAgentJobs();
  let job = await loadOwnedJob(jobId, userId);
  if (job.status === "queued") {
    const started = applyJobTransition(job, "start", userId, { note: "handler_start" });
    if (!started.ok) throw new AgentJobError(409, started.error, started.message);
    job = await persistJob(started.job);
  }
  if (job.status !== "running") return job;
  try {
    const result = await executeSpecialist(job, "apply");
    const done = applyJobTransition(job, "succeed", userId, { result, note: "handler_succeeded" });
    if (!done.ok) throw new AgentJobError(409, done.error, done.message);
    return persistJob(done.job);
  } catch (err: any) {
    if (err instanceof AgentJobError && err.status === 409) throw err;
    const failed = applyJobTransition(job, "fail", userId, {
      error: err?.code || err?.message || "job_failed",
      note: "handler_failed",
    });
    if (!failed.ok) throw new AgentJobError(409, failed.error, failed.message);
    return persistJob(failed.job);
  }
}

export async function createAgentJob(input: {
  request: CreateAgentJobRequest;
  userId: string;
  apiKeyId: string | null;
}): Promise<{ job: AgentJob; replayed: boolean }> {
  await ensureAgentJobs();
  const { request, userId, apiKeyId } = input;
  const parsedInput = parseJobInput(request.type, request.input);
  if (!parsedInput.success) {
    throw new AgentJobError(400, "invalid_input", parsedInput.error.issues.map((i) => i.message).join("; "));
  }

  if (request.idempotencyKey) {
    const existing = await findByIdempotency(userId, request.idempotencyKey);
    if (existing) return { job: existing, replayed: true };
  }

  const approvalRequired = jobRequiresApproval(request.type, request.approvalRequired);
  const status = approvalRequired ? "needs_approval" : "queued";
  const specialistId = SPECIALIST_REGISTRY[request.type].specialistId;
  const now = new Date();
  const auditTrail: AgentJobAuditEntry[] = [{
    at: now.toISOString(),
    action: "create",
    actorUserId: userId,
    fromStatus: null,
    toStatus: status,
    note: approvalRequired ? "awaiting_human_approval" : "queued_for_specialist",
  }];

  let row: AgentJobRow;
  try {
    [row] = await db.insert(agentJobs).values({
      type: request.type,
      status,
      input: parsedInput.data as Record<string, unknown>,
      result: null,
      error: null,
      specialistId,
      createdByUserId: userId,
      createdByApiKeyId: apiKeyId,
      approvalRequired,
      idempotencyKey: request.idempotencyKey ?? null,
      auditTrail,
    }).returning();
  } catch (err: any) {
    if (request.idempotencyKey && (err?.code === "23505" || String(err?.message || "").includes("uq_agent_jobs_user_idempotency"))) {
      const existing = await findByIdempotency(userId, request.idempotencyKey);
      if (existing) return { job: existing, replayed: true };
    }
    throw err;
  }

  let job = rowToAgentJob(row);
  if (!approvalRequired) {
    job = await runAgentJob(job.id, userId);
  } else if (SPECIALIST_REGISTRY[request.type].previewOnCreate) {
    try {
      job = await previewAgentJob(job.id, userId);
    } catch (err: any) {
      await persistJob({
        ...job,
        status: "failed",
        error: err?.code || err?.message || "preview_failed",
        result: { error: err?.message || "preview_failed", dryRun: true },
        updatedAt: new Date(),
      });
      throw err instanceof AgentJobError ? err : new AgentJobError(400, "preview_failed", err?.message);
    }
  }
  return { job, replayed: false };
}

export async function listAgentJobs(userId: string, limit = 25): Promise<AgentJob[]> {
  await ensureAgentJobs();
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const rows = await db.select().from(agentJobs)
    .where(eq(agentJobs.createdByUserId, userId))
    .orderBy(desc(agentJobs.createdAt))
    .limit(safeLimit);
  return rows.map(rowToAgentJob);
}

export async function getAgentJob(id: string, userId: string): Promise<AgentJob> {
  await ensureAgentJobs();
  return loadOwnedJob(id, userId);
}

export async function approveAgentJob(id: string, userId: string): Promise<AgentJob> {
  await ensureAgentJobs();
  const job = await loadOwnedJob(id, userId);
  const approved = applyJobTransition(job, "approve", userId, { note: "human_approved" });
  if (!approved.ok) throw new AgentJobError(409, approved.error, approved.message);
  const running = await persistJob(approved.job);
  // Previewed forms: succeed the stored draft. Do not e-sign, email, or submit.
  // CRM applyOnApprove re-runs the executor so the write happens only after approve.
  if (
    SPECIALIST_REGISTRY[running.type].previewOnCreate
    && running.result
    && !SPECIALIST_REGISTRY[running.type].applyOnApprove
  ) {
    const done = applyJobTransition(running, "succeed", userId, {
      result: running.result,
      note: "approved_without_submit",
    });
    if (!done.ok) throw new AgentJobError(409, done.error, done.message);
    return persistJob(done.job);
  }
  return runAgentJob(id, userId);
}

export async function cancelAgentJob(id: string, userId: string): Promise<AgentJob> {
  await ensureAgentJobs();
  const job = await loadOwnedJob(id, userId);
  const cancelled = applyJobTransition(job, "cancel", userId, { note: "cancelled_by_caller" });
  if (!cancelled.ok) throw new AgentJobError(409, cancelled.error, cancelled.message);
  return persistJob(cancelled.job);
}
