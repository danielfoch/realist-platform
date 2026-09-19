/**
 * Realist Agent API spine — canonical domain schemas + job contract.
 *
 * Specialists (forms, listing extract, docs, CRM writes) call this contract.
 * Persistence for P0 is limited to `agent_jobs`; Property / Listing / Deal /
 * Contact / TransactionFile / AgentOrg are Zod contracts that wrap shapes
 * Realist already uses (analyses, listings, leads, person spine, apiKeys).
 *
 * Realist-only: no external CRM and no partner-platform integrations here.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Auth scopes (single source of truth for minting + route checks)
// ---------------------------------------------------------------------------

export const AGENT_API_SCOPES = [
  "read",
  "underwrite",
  "community:write",
  "deal:submit",
  "partner:referrals",
  // Specialist / job scopes. Existing keys keep working: defaults are unchanged
  // and unknown stored scopes are ignored. New scopes are opt-in at mint time.
  "jobs:write",
  "forms:write",
  "docs:write",
  "crm:write",
] as const;

export type AgentApiScope = (typeof AGENT_API_SCOPES)[number];

/** Scopes granted when a key has none stored (legacy + default mint). */
export const DEFAULT_AGENT_API_SCOPES: AgentApiScope[] = [
  "read",
  "underwrite",
  "deal:submit",
];

export const AGENT_API_SCOPE_SET = new Set<string>(AGENT_API_SCOPES);

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export const CANADIAN_PROVINCE_CODES = [
  "AB",
  "BC",
  "MB",
  "NB",
  "NL",
  "NS",
  "NT",
  "NU",
  "ON",
  "PE",
  "QC",
  "SK",
  "YT",
] as const;

/** ISO 3166-1 alpha-2. Defaults to CA for existing callers. */
export const isoCountryCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2}$/, "ISO 3166-1 alpha-2 country code")
  .transform((value) => value.toUpperCase());
export const countryCodeSchema = isoCountryCodeSchema.default("CA");

/** ISO 4217. Underwrite math is currency-native unless fxToCad is supplied. */
export const isoCurrencySchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{3}$/, "ISO 4217 currency code")
  .transform((value) => value.toUpperCase());

export const areaUnitSchema = z.enum(["sqft", "sqm"]);

export const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const strategyTypeSchema = z.enum([
  "buyHold",
  "buy_hold",
  "brrr",
  "flip",
  "airbnb",
  "multiplex",
  "land_assembly",
]);

/** Agent-API underwrite strategies (existing /api/agent/underwrite/* contract). */
export const agentUnderwriteStrategySchema = z
  .enum(["buyHold", "brrr", "flip", "airbnb", "multiplex"])
  .default("buyHold");

// ---------------------------------------------------------------------------
// A. Canonical resource schemas
// ---------------------------------------------------------------------------

export const propertySchema = z.object({
  id: z.string().min(1).optional(),
  address: z.string().min(1),
  streetAddress: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  province: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  zip: z.string().optional().nullable(),
  country: countryCodeSchema,
  geo: geoPointSchema.optional().nullable(),
  beds: z.number().int().nonnegative().optional().nullable(),
  baths: z.number().nonnegative().optional().nullable(),
  units: z.number().int().positive().optional().nullable(),
  annualPropertyTax: z.number().nonnegative().optional().nullable(),
  propertyType: z.string().optional().nullable(),
  parcelId: z.string().optional().nullable(),
  areaSqft: z.number().nonnegative().optional().nullable(),
  areaSqm: z.number().nonnegative().optional().nullable(),
  areaUnit: areaUnitSchema.optional().nullable(),
});
export type Property = z.infer<typeof propertySchema>;

/** Partial property used by listing extract (address may still be missing). */
export const extractedPropertySchema = propertySchema.partial();

export const listingStatusSchema = z.enum([
  "Active",
  "Pending",
  "Sold",
  "Expired",
  "Cancelled",
  "Unknown",
]);

export const listingSchema = z.object({
  id: z.string().min(1).optional(),
  mlsNumber: z.string().min(1).optional().nullable(),
  status: listingStatusSchema.default("Active"),
  listPrice: z.number().nonnegative().optional().nullable(),
  currency: isoCurrencySchema.optional().nullable(),
  property: propertySchema.optional(),
  propertyId: z.string().optional().nullable(),
  daysOnMarket: z.number().int().nonnegative().optional().nullable(),
  source: z.string().default("crea_ddf"),
  sourceUrl: z.string().url().optional().nullable(),
  sourceHost: z.string().optional().nullable(),
  externalId: z.string().optional().nullable(),
  propertyType: z.string().optional().nullable(),
});
export type Listing = z.infer<typeof listingSchema>;

export const extractedListingSchema = listingSchema.partial();

/**
 * Deal / underwrite analysis — links a listing or custom property to the
 * shared investment-metrics engine (`calculateInvestmentMetrics`).
 */
export const dealAssumptionsSchema = z.object({
  monthlyRent: z.number().nonnegative().optional(),
  units: z.number().int().positive().optional(),
  beds: z.number().int().nonnegative().optional(),
  downPaymentPercent: z.number().min(0).max(100).optional(),
  interestRate: z.number().min(0).max(25).optional(),
  vacancyRate: z.number().min(0).max(50).optional(),
  expenseRatio: z.number().min(0).max(80).optional(),
  annualPropertyTax: z.number().nonnegative().optional(),
  amortizationYears: z.number().int().positive().optional(),
});

export const dealMetricsSchema = z.object({
  capRate: z.number().nullable().optional(),
  cashOnCash: z.number().nullable().optional(),
  monthlyCashFlow: z.number().nullable().optional(),
  annualCashFlow: z.number().nullable().optional(),
  noi: z.number().nullable().optional(),
  dscr: z.number().nullable().optional(),
  annualRent: z.number().nullable().optional(),
  calculationVersion: z.string().optional(),
}).passthrough();

export const dealSchema = z.object({
  id: z.string().min(1).optional(),
  analysisId: z.string().optional().nullable(),
  listingId: z.string().optional().nullable(),
  mlsNumber: z.string().optional().nullable(),
  propertyId: z.string().optional().nullable(),
  property: propertySchema.optional(),
  strategy: strategyTypeSchema.default("buyHold"),
  assumptions: dealAssumptionsSchema.default({}),
  metrics: dealMetricsSchema.optional(),
  userId: z.string().optional().nullable(),
});
export type Deal = z.infer<typeof dealSchema>;

/**
 * Contact / lead identity. Aligns with person-spine fields on `users`,
 * `leads`, and `crm_contacts` (email-normalized identity). Realist-owned.
 */
export const contactSchema = z.object({
  id: z.string().min(1).optional(),
  userId: z.string().optional().nullable(),
  email: z.string().email(),
  name: z.string().optional().nullable(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
});
export type Contact = z.infer<typeof contactSchema>;

export const transactionDocClassSchema = z.enum([
  "offer",
  "waiver",
  "amendment",
  "status_certificate",
  "insurance",
  "mortgage",
  "identification",
  "other",
]);

export const transactionFileStatusSchema = z.enum([
  "placeholder",
  "pending",
  "ready",
  "filed",
]);

/** Deal file / closing packet placeholder — no persistence in P0. */
export const transactionFileSchema = z.object({
  id: z.string().min(1),
  dealId: z.string().min(1),
  docClass: transactionDocClassSchema,
  status: transactionFileStatusSchema.default("placeholder"),
  label: z.string().optional(),
});
export type TransactionFile = z.infer<typeof transactionFileSchema>;

/**
 * Minimal org/user ownership already implied by `api_keys.user_id`.
 * P0 does not add a separate orgs table.
 */
export const agentOrgSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  name: z.string().optional().nullable(),
  createdAt: z.union([z.string(), z.date()]).optional(),
});
export type AgentOrg = z.infer<typeof agentOrgSchema>;

// ---------------------------------------------------------------------------
// B. Job contract
// ---------------------------------------------------------------------------

export const AGENT_JOB_TYPES = [
  "underwrite.listing",
  "underwrite.custom",
  "forms.fill",
  "listing.extract",
  "docs.route",
  "crm.update",
] as const;
export type AgentJobType = (typeof AGENT_JOB_TYPES)[number];

export const AGENT_JOB_STATUSES = [
  "queued",
  "running",
  "needs_approval",
  "succeeded",
  "failed",
  "cancelled",
] as const;
export type AgentJobStatus = (typeof AGENT_JOB_STATUSES)[number];

export const TERMINAL_JOB_STATUSES: readonly AgentJobStatus[] = [
  "succeeded",
  "failed",
  "cancelled",
];

export const agentJobAuditEntrySchema = z.object({
  at: z.string(),
  action: z.string(),
  actorUserId: z.string().nullable(),
  fromStatus: z.enum(AGENT_JOB_STATUSES).nullable(),
  toStatus: z.enum(AGENT_JOB_STATUSES),
  note: z.string().optional(),
});
export type AgentJobAuditEntry = z.infer<typeof agentJobAuditEntrySchema>;

export const agentJobSchema = z.object({
  id: z.string().min(1),
  type: z.enum(AGENT_JOB_TYPES),
  status: z.enum(AGENT_JOB_STATUSES),
  input: z.record(z.unknown()),
  result: z.record(z.unknown()).nullable(),
  error: z.string().nullable(),
  specialistId: z.string().nullable(),
  createdByUserId: z.string().min(1),
  createdByApiKeyId: z.string().nullable(),
  approvalRequired: z.boolean(),
  approvedAt: z.union([z.string(), z.date()]).nullable(),
  approvedByUserId: z.string().nullable(),
  idempotencyKey: z.string().nullable(),
  auditTrail: z.array(agentJobAuditEntrySchema),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});
export type AgentJob = z.infer<typeof agentJobSchema>;

export const underwriteListingInputSchema = z.object({
  mlsNumber: z.string().min(1),
  strategyType: agentUnderwriteStrategySchema,
  monthlyRent: z.number().positive().optional(),
  downPaymentPercent: z.number().min(0).max(100).optional(),
  interestRate: z.number().min(0).max(25).optional(),
  vacancyRate: z.number().min(0).max(50).optional(),
  expenseRatio: z.number().min(0).max(80).optional(),
});

export const underwriteCustomInputSchema = z.object({
  address: z.string().min(1),
  city: z.string().optional(),
  province: z.string().optional(),
  countryMode: isoCountryCodeSchema.default("CA"),
  strategyType: agentUnderwriteStrategySchema,
  price: z.number().positive(),
  currency: isoCurrencySchema.optional(),
  fxToCad: z.number().positive().optional(),
  monthlyRent: z.number().positive().optional(),
  units: z.number().int().positive().optional(),
  beds: z.number().int().nonnegative().optional(),
  downPaymentPercent: z.number().min(0).max(100).optional(),
  interestRate: z.number().min(0).max(25).optional(),
  vacancyRate: z.number().min(0).max(50).optional(),
  expenseRatio: z.number().min(0).max(80).optional(),
});

export const listingExtractInputSchema = z.object({
  mlsNumber: z.string().min(1).optional(),
  url: z.string().url().optional(),
  /** Caller-supplied public HTML (tests / agents that already fetched the page). */
  html: z.string().min(1).max(1_500_000).optional(),
  rawText: z.string().min(1).max(1_500_000).optional(),
  country: isoCountryCodeSchema.optional(),
  currency: isoCurrencySchema.optional(),
}).refine((value) => Boolean(value.mlsNumber || value.url || value.html || value.rawText), {
  message: "Provide url, html, rawText, or mlsNumber",
});

export const formsFillInputSchema = z.object({
  formId: z.string().trim().min(1),
  dealId: z.string().min(1).optional(),
  deal: z.record(z.unknown()).optional(),
  property: z.record(z.unknown()).optional(),
  listing: z.record(z.unknown()).optional(),
  contacts: z.array(z.unknown()).optional(),
  parties: z.record(z.unknown()).optional(),
  facts: z.record(z.unknown()).optional(),
  overrides: z.record(z.unknown()).optional(),
  fields: z.record(z.unknown()).optional(),
  locale: z.string().optional(),
}).passthrough();

export const docsRouteInputSchema = z.object({
  dealId: z.string().min(1).optional(),
  documentId: z.string().min(1).optional(),
  docClass: transactionDocClassSchema.optional(),
});

export const crmContactWriteSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().trim().min(1).max(200).optional(),
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  phone: z.string().trim().min(1).max(30).optional(),
  source: z.string().trim().min(1).max(50).optional(),
  contactType: z.enum(["investor", "buyer", "seller", "renter", "realtor", "sponsor", "other"]).optional(),
  targetMarket: z.string().trim().min(1).max(200).optional(),
});

export const CRM_UPDATE_ACTIONS = [
  "upsert_contact",
  "update_stage",
  "add_note",
  "set_next_action",
] as const;

export const CRM_CONTACT_STAGE_VALUES = [
  "new",
  "contacted",
  "nurturing",
  "appointment",
  "client",
  "past_client",
  "lost",
] as const;

export const crmUpdateInputSchema = z.object({
  action: z.enum(CRM_UPDATE_ACTIONS).default("upsert_contact"),
  contactId: z.string().min(1).optional(),
  contact: crmContactWriteSchema.optional(),
  stage: z.enum(CRM_CONTACT_STAGE_VALUES).optional(),
  note: z.string().trim().min(1).max(5000).optional(),
  nextAction: z.string().trim().min(1).max(500).optional(),
  nextActionAt: z.string().trim().min(1).refine((value) => !Number.isNaN(Date.parse(value)), "ISO timestamp").optional(),
  metadata: z.record(z.unknown()).optional(),
}).superRefine((value, ctx) => {
  const email = value.contact?.email;
  if (!value.contactId && !email) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "contactId or contact.email is required" });
  }
  if (value.action === "update_stage" && !value.stage) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "stage is required for update_stage" });
  }
  if (value.action === "add_note" && !value.note) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "note is required for add_note" });
  }
  if (value.action === "set_next_action" && !value.nextAction) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "nextAction is required for set_next_action" });
  }
});

export const JOB_INPUT_SCHEMAS = {
  "underwrite.listing": underwriteListingInputSchema,
  "underwrite.custom": underwriteCustomInputSchema,
  "listing.extract": listingExtractInputSchema,
  "forms.fill": formsFillInputSchema,
  "docs.route": docsRouteInputSchema,
  "crm.update": crmUpdateInputSchema,
} as const;

export const createAgentJobRequestSchema = z.object({
  type: z.enum(AGENT_JOB_TYPES),
  input: z.record(z.unknown()).default({}),
  idempotencyKey: z.string().trim().min(1).max(200).optional(),
  approvalRequired: z.boolean().optional(),
});
export type CreateAgentJobRequest = z.infer<typeof createAgentJobRequestSchema>;

export interface SpecialistHandlerMeta {
  specialistId: string;
  /** Anything that leaves Realist (forms, docs, CRM writes) must be true. */
  requiresApproval: boolean;
  /** Declared but unused until the specialist ships. */
  implemented: boolean;
  /**
   * Run the handler on create, attach `result`, but stay in needs_approval
   * so a human can review the draft before approve marks succeeded.
   */
  previewOnCreate?: boolean;
  /** After approve, re-run the executor to apply a write (CRM). Forms keep the draft. */
  applyOnApprove?: boolean;
  scopes: AgentApiScope[];
}

/**
 * Job type → specialist registration. Handlers live in server/agentJobs.ts;
 * this table is the contract the router and OpenAPI document.
 */
export const SPECIALIST_REGISTRY: Record<AgentJobType, SpecialistHandlerMeta> = {
  "underwrite.listing": {
    specialistId: "realist.underwrite",
    requiresApproval: false,
    implemented: true,
    scopes: ["underwrite", "jobs:write"],
  },
  "underwrite.custom": {
    specialistId: "realist.underwrite",
    requiresApproval: false,
    implemented: true,
    scopes: ["underwrite", "jobs:write"],
  },
  "listing.extract": {
    specialistId: "realist.listing-extract",
    requiresApproval: false,
    implemented: true,
    scopes: ["read", "jobs:write"],
  },
  "forms.fill": {
    specialistId: "realist.forms",
    requiresApproval: true,
    implemented: true,
    previewOnCreate: true,
    scopes: ["forms:write", "jobs:write"],
  },
  "docs.route": {
    specialistId: "realist.docs",
    requiresApproval: true,
    implemented: false,
    scopes: ["docs:write", "jobs:write"],
  },
  "crm.update": {
    specialistId: "realist.crm",
    requiresApproval: true,
    implemented: true,
    previewOnCreate: true,
    applyOnApprove: true,
    scopes: ["crm:write", "jobs:write"],
  },
};

export function scopesForJobType(type: AgentJobType): AgentApiScope[] {
  return SPECIALIST_REGISTRY[type].scopes;
}

export function jobRequiresApproval(type: AgentJobType, requested?: boolean): boolean {
  return SPECIALIST_REGISTRY[type].requiresApproval || Boolean(requested);
}

export function parseJobInput(type: AgentJobType, input: unknown) {
  return JOB_INPUT_SCHEMAS[type].safeParse(input ?? {});
}

export function canApproveJob(status: AgentJobStatus): boolean {
  return status === "needs_approval";
}

export function canCancelJob(status: AgentJobStatus): boolean {
  return status === "queued" || status === "running" || status === "needs_approval";
}

export function isTerminalJobStatus(status: AgentJobStatus): boolean {
  return (TERMINAL_JOB_STATUSES as readonly string[]).includes(status);
}

export type JobTransitionAction = "approve" | "cancel" | "start" | "succeed" | "fail";

export function nextStatusForAction(
  status: AgentJobStatus,
  action: JobTransitionAction,
): AgentJobStatus | null {
  switch (action) {
    case "approve":
      return canApproveJob(status) ? "running" : null;
    case "cancel":
      return canCancelJob(status) ? "cancelled" : null;
    case "start":
      return status === "queued" ? "running" : null;
    case "succeed":
      return status === "running" ? "succeeded" : null;
    case "fail":
      return status === "running" ? "failed" : null;
    default:
      return null;
  }
}

export function applyJobTransition<T extends {
  status: AgentJobStatus;
  auditTrail: AgentJobAuditEntry[];
  approvedAt?: Date | string | null;
  approvedByUserId?: string | null;
  error?: string | null;
  result?: Record<string, unknown> | null;
  updatedAt?: Date | string;
}>(
  job: T,
  action: JobTransitionAction,
  actorUserId: string | null,
  extras: { note?: string; error?: string | null; result?: Record<string, unknown> | null } = {},
): { ok: true; job: T } | { ok: false; error: "invalid_transition"; message: string } {
  const toStatus = nextStatusForAction(job.status, action);
  if (!toStatus) {
    return {
      ok: false,
      error: "invalid_transition",
      message: `Cannot ${action} a job in status ${job.status}.`,
    };
  }
  const entry: AgentJobAuditEntry = {
    at: new Date().toISOString(),
    action,
    actorUserId,
    fromStatus: job.status,
    toStatus,
    note: extras.note,
  };
  const next: T = {
    ...job,
    status: toStatus,
    auditTrail: [...job.auditTrail, entry],
    updatedAt: new Date(),
  };
  if (action === "approve") {
    next.approvedAt = new Date();
    next.approvedByUserId = actorUserId;
  }
  if (action === "succeed") {
    next.result = extras.result ?? job.result ?? null;
    next.error = null;
  }
  if (action === "fail") {
    next.error = extras.error ?? "job_failed";
  }
  if (action === "cancel") {
    next.error = extras.error ?? job.error ?? null;
  }
  return { ok: true, job: next };
}
