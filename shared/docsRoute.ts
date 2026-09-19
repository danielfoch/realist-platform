/**
 * Document routing specialist (P5) — classify user-supplied deal docs
 * and propose a TransactionFile stub. No blank-form storage. No invented
 * parties, prices, or closing dates.
 *
 * Realist-only. Homies is out of scope. OCR of PDF bytes is a follow-up;
 * v1 classifies textContent + filename heuristics.
 */
import { z } from "zod";

/** P5 public class list (GET /api/agent/docs/classes). */
export const DOCS_ROUTE_CLASSES = [
  "offer",
  "amendment",
  "waiver_notice",
  "inspection_report",
  "appraisal",
  "mortgage_commitment",
  "id_document",
  "insurance",
  "title_search",
  "survey",
  "hoa_condo_status",
  "disclosure",
  "commission_trust",
  "other",
] as const;
export type DocsRouteClass = (typeof DOCS_ROUTE_CLASSES)[number];

/**
 * Additive union: P0 placeholder names stay valid so forms.fill stubs
 * (`waiver`, `mortgage`, `identification`, `status_certificate`) still parse.
 */
export const TRANSACTION_DOC_CLASSES = [
  ...DOCS_ROUTE_CLASSES,
  "waiver",
  "mortgage",
  "identification",
  "status_certificate",
] as const;
export type TransactionDocClass = (typeof TRANSACTION_DOC_CLASSES)[number];

export const docsRouteClassSchema = z.enum(DOCS_ROUTE_CLASSES);
export const transactionDocClassSchema = z.enum(TRANSACTION_DOC_CLASSES);

const MAX_TEXT = 200_000;
const MAX_BASE64 = 400_000;

export const docsRouteInputSchema = z.object({
  filename: z.string().trim().min(1).max(240).optional(),
  mimeType: z.string().trim().min(1).max(120).optional(),
  textContent: z.string().min(1).max(MAX_TEXT).optional(),
  /** Size-capped bytes. v1 does not OCR; pair with textContent for high confidence. */
  base64: z.string().min(1).max(MAX_BASE64).optional(),
  dealId: z.string().min(1).optional(),
  analysisId: z.string().min(1).optional(),
  mlsNumber: z.string().min(1).optional(),
  documentId: z.string().min(1).optional(),
  docClass: transactionDocClassSchema.optional(),
  hints: z.record(z.unknown()).optional(),
}).refine((value) => Boolean(
  value.textContent
  || value.filename
  || value.base64
  || value.documentId
  || value.docClass
  || value.dealId
  || value.analysisId
  || value.mlsNumber
), {
  message: "Provide textContent, filename, base64, or a deal/document hint",
});
export type DocsRouteInput = z.infer<typeof docsRouteInputSchema>;

export type DocsConfidence = "high" | "medium" | "low";

export const DEAL_DOC_STAGES = ["offer", "firm", "financing", "closing"] as const;
export type DealDocStage = (typeof DEAL_DOC_STAGES)[number];

/** Expected classes by deal stage for the closing-checklist helper. */
export const CLOSING_CHECKLIST: Record<DealDocStage, DocsRouteClass[]> = {
  offer: ["offer"],
  firm: ["offer", "amendment", "waiver_notice", "inspection_report"],
  financing: ["offer", "mortgage_commitment", "insurance", "id_document"],
  closing: [
    "offer",
    "amendment",
    "waiver_notice",
    "inspection_report",
    "appraisal",
    "mortgage_commitment",
    "id_document",
    "insurance",
    "title_search",
    "survey",
    "disclosure",
  ],
};

export const DOC_CLASS_LABELS: Record<DocsRouteClass, string> = {
  offer: "Agreement of Purchase and Sale / offer",
  amendment: "Amendment to agreement",
  waiver_notice: "Waiver / notice of fulfillment",
  inspection_report: "Home inspection report",
  appraisal: "Appraisal report",
  mortgage_commitment: "Mortgage commitment / loan approval",
  id_document: "Government photo ID",
  insurance: "Property insurance binder / policy",
  title_search: "Title search / parcel register",
  survey: "Survey / SRPR",
  hoa_condo_status: "Status certificate / HOA estoppel",
  disclosure: "Seller property disclosure",
  commission_trust: "Commission trust agreement",
  other: "Unclassified deal document",
};

const ALIAS_TO_P5: Record<string, DocsRouteClass> = {
  waiver: "waiver_notice",
  mortgage: "mortgage_commitment",
  identification: "id_document",
  status_certificate: "hoa_condo_status",
};

export function canonicalizeDocClass(value: string | undefined | null): DocsRouteClass | null {
  if (!value) return null;
  const key = value.trim().toLowerCase();
  if ((DOCS_ROUTE_CLASSES as readonly string[]).includes(key)) return key as DocsRouteClass;
  return ALIAS_TO_P5[key] ?? null;
}

interface ClassRule {
  docClass: DocsRouteClass;
  patterns: RegExp[];
  filename: RegExp[];
}

const CLASS_RULES: ClassRule[] = [
  {
    docClass: "offer",
    patterns: [/agreement of purchase and sale/i, /offer to purchase/i, /orea\s*(form\s*)?100\b/i, /buyer agrees to purchase/i],
    filename: [/\b(aps|offer|purchase[-_ ]agreement)\b/i],
  },
  {
    docClass: "amendment",
    patterns: [/amendment to (the )?agreement/i, /orea\s*(form\s*)?101\b/i, /amending agreement/i],
    filename: [/\bamend/i],
  },
  {
    docClass: "waiver_notice",
    patterns: [/waiver of condition/i, /notice of fulfillment/i, /orea\s*(form\s*)?105\b/i],
    filename: [/\b(waiver|notice[-_ ]of[-_ ]fulfillment)\b/i],
  },
  {
    docClass: "inspection_report",
    patterns: [/home inspection/i, /property inspection report/i, /\binspector\b/i, /visible deficiencies/i],
    filename: [/\binspect/i],
  },
  {
    docClass: "appraisal",
    patterns: [/appraisal report/i, /appraised (market )?value/i, /\bappraiser\b/i],
    filename: [/\bapprais/i],
  },
  {
    docClass: "mortgage_commitment",
    patterns: [/mortgage commitment/i, /loan approval/i, /commitment letter/i, /lender hereby/i],
    filename: [/\b(mortgage|commitment|loan[-_ ]approv)/i],
  },
  {
    docClass: "id_document",
    patterns: [/driver'?s licen[cs]e/i, /\bpassport\b/i, /government[- ]issued (photo )?id/i],
    filename: [/\b(passport|drivers?[-_ ]licen|gov[-_ ]?id)\b/i],
  },
  {
    docClass: "insurance",
    patterns: [/homeowner'?s insurance/i, /insurance binder/i, /dwelling coverage/i, /policy number/i],
    filename: [/\binsur/i],
  },
  {
    docClass: "title_search",
    patterns: [/title search/i, /parcel register/i, /land titles/i, /\bencumbrance/i],
    filename: [/\btitle\b/i],
  },
  {
    docClass: "survey",
    patterns: [/surveyor'?s real property report/i, /plan of survey/i, /\bs\.?r\.?p\.?r\.?\b/i],
    filename: [/\bsurvey|srpr\b/i],
  },
  {
    docClass: "hoa_condo_status",
    patterns: [/status certificate/i, /condominium corporation/i, /\bestoppel certificate\b/i],
    filename: [/\b(status[-_ ]cert|estoppel|hoa)\b/i],
  },
  {
    docClass: "disclosure",
    patterns: [/seller property information/i, /\bspis\b/i, /property disclosure/i],
    filename: [/\b(disclosure|spis)\b/i],
  },
  {
    docClass: "commission_trust",
    patterns: [/commission trust/i, /cooperating brokerage/i],
    filename: [/\bcommission[-_ ]trust\b/i],
  },
];

export function resolveDealDocStage(hints: Record<string, unknown> | undefined): DealDocStage {
  const raw = typeof hints?.stage === "string" ? hints.stage.trim().toLowerCase() : "";
  if ((DEAL_DOC_STAGES as readonly string[]).includes(raw)) return raw as DealDocStage;
  return "closing";
}

export function missingForClosing(
  present: readonly string[],
  stage: DealDocStage = "closing",
): DocsRouteClass[] {
  const have = new Set(present.map((item) => canonicalizeDocClass(item)).filter(Boolean) as DocsRouteClass[]);
  return CLOSING_CHECKLIST[stage].filter((docClass) => !have.has(docClass));
}

function countHits(text: string, patterns: RegExp[]): number {
  return patterns.reduce((sum, pattern) => sum + (pattern.test(text) ? 1 : 0), 0);
}

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "doc";
}

export function suggestDocFilename(input: {
  docClass: DocsRouteClass;
  filename?: string;
  dealId?: string;
  analysisId?: string;
  mlsNumber?: string;
}): string {
  if (input.filename && /\.[a-z0-9]{2,5}$/i.test(input.filename)) {
    return sanitizeFilenamePart(input.filename);
  }
  const target = input.mlsNumber || input.dealId || input.analysisId || "unattached";
  return `${input.docClass}-${sanitizeFilenamePart(target)}.pdf`;
}

export interface DocsRouteClassification {
  docClass: DocsRouteClass;
  confidence: DocsConfidence;
  suggestedFilename: string;
  missingForClosing: DocsRouteClass[];
  warnings: string[];
  target: { dealId: string | null; analysisId: string | null; mlsNumber: string | null; resolved: boolean };
  scores: Record<string, number>;
}

export function classifyDocument(
  input: DocsRouteInput,
  presentClasses: readonly string[] = [],
): DocsRouteClassification {
  const warnings: string[] = [];
  const scores: Record<string, number> = {};

  if (input.base64 && !input.textContent) {
    warnings.push("v1 does not OCR PDF/image bytes. Provide textContent for high-confidence classification. OCR is a follow-up.");
  }
  if (!input.textContent && !input.filename && !input.docClass) {
    warnings.push("No document text or filename. Classification is other at low confidence.");
  }
  warnings.push("Did not extract party names, purchase price, or closing dates. Weak OCR guesses are never stored as facts.");

  for (const rule of CLASS_RULES) {
    const bodyHits = input.textContent ? countHits(input.textContent, rule.patterns) : 0;
    const nameHits = input.filename ? countHits(input.filename, rule.filename) : 0;
    scores[rule.docClass] = bodyHits * 2 + nameHits;
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  const second = ranked[1];
  const hintClass = canonicalizeDocClass(input.docClass) || canonicalizeDocClass(typeof input.hints?.docClass === "string" ? input.hints.docClass : null);

  let docClass: DocsRouteClass = "other";
  let confidence: DocsConfidence = "low";

  if (top && top[1] >= 4 && (!second || top[1] >= second[1] + 2)) {
    docClass = top[0] as DocsRouteClass;
    confidence = "high";
  } else if (top && top[1] >= 2) {
    docClass = top[0] as DocsRouteClass;
    confidence = "medium";
    if (second && second[1] === top[1]) {
      confidence = "low";
      warnings.push(`Ambiguous between ${top[0]} and ${second[0]}; left at low confidence.`);
    }
  } else if (top && top[1] >= 1) {
    docClass = top[0] as DocsRouteClass;
    confidence = "medium";
  } else if (hintClass) {
    docClass = hintClass;
    confidence = "low";
    warnings.push("Used caller docClass hint only. Text was too weak to confirm.");
  }

  const target = {
    dealId: input.dealId ?? null,
    analysisId: input.analysisId ?? null,
    mlsNumber: input.mlsNumber ?? null,
    resolved: Boolean(input.dealId || input.analysisId || input.mlsNumber),
  };
  if (!target.resolved) {
    warnings.push("No dealId, analysisId, or mlsNumber. Approve will not attach a TransactionFile.");
  }

  const stage = resolveDealDocStage(input.hints);
  const present = [...presentClasses, docClass];

  return {
    docClass,
    confidence,
    suggestedFilename: suggestDocFilename({
      docClass,
      filename: input.filename,
      dealId: input.dealId,
      analysisId: input.analysisId,
      mlsNumber: input.mlsNumber,
    }),
    missingForClosing: missingForClosing(present, stage),
    warnings,
    target,
    scores,
  };
}

export function listDocClasses() {
  return DOCS_ROUTE_CLASSES.map((docClass) => ({
    docClass,
    label: DOC_CLASS_LABELS[docClass],
  }));
}

export function listClosingChecklists() {
  return DEAL_DOC_STAGES.map((stage) => ({
    stage,
    expected: [...CLOSING_CHECKLIST[stage]],
  }));
}
