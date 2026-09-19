/**
 * Agent result views — the document model behind the hosted visual results at
 * /v/:token.
 *
 * When an AI agent (Claude, Codex, Grok, Cursor, a plain REST client, …) calls
 * a Realist tool, the JSON result goes back to the harness and a *view
 * document* is persisted server-side. The tool result carries a `view.url`
 * that the agent hands to the human: opening it in a browser renders this
 * document as an interactive spreadsheet / model / report — the same idea as a
 * deploy preview URL.
 *
 * Two document kinds:
 *   - "underwriting": carries the full BuyHoldInputs. The page recomputes the
 *     pro forma live with shared/buyHoldAnalysis.ts, so the visitor can edit
 *     assumptions and download an Excel model with real formulas.
 *   - "report": a declarative list of sections (stat grid, chart, table,
 *     callout, narrative) reusing the block types from shared/reportContent.ts.
 *     Any future tool can ship a hosted visual just by composing blocks.
 *
 * Pure types + tiny helpers only; shared by server/agent/* and the client.
 */
import type { BuyHoldInputs } from "./schema";
import type {
  CalloutBlock,
  ChartBlock,
  NarrativeSection,
  StatGridBlock,
} from "./reportContent";

export const AGENT_VIEW_DOCUMENT_VERSION = 1;

export const AGENT_VIEW_KINDS = ["underwriting", "report"] as const;
export type AgentViewKind = (typeof AGENT_VIEW_KINDS)[number];

/** Path prefix of the hosted page; the token follows. */
export const AGENT_VIEW_ROUTE_PREFIX = "/v";

export function agentViewPath(token: string): string {
  return `${AGENT_VIEW_ROUTE_PREFIX}/${token}`;
}

export const AGENT_VIEW_DISCLAIMER =
  "Estimates for research purposes only — not an appraisal, or legal, tax, planning, or investment advice. Verify rents, taxes, and financing with licensed professionals before acting.";

export interface AgentViewLink {
  label: string;
  /** Site-relative path or absolute URL. */
  href: string;
  primary?: boolean;
}

export type TableCellFormat = "text" | "currency" | "percent" | "number";

export interface TableColumn {
  key: string;
  label: string;
  format?: TableCellFormat;
  align?: "left" | "right";
}

export type TableCell = string | number | null;

/** A simple data table. `hrefKey` names a row field holding a link for the first column. */
export interface TableBlock {
  type: "table";
  heading?: string;
  caption?: string;
  id?: string;
  columns: TableColumn[];
  rows: Array<Record<string, TableCell>>;
  hrefKey?: string;
}

export type AgentViewSection =
  | StatGridBlock
  | ChartBlock
  | TableBlock
  | CalloutBlock
  | NarrativeSection;

interface AgentViewBase {
  version: typeof AGENT_VIEW_DOCUMENT_VERSION;
  title: string;
  subtitle?: string;
  /** ISO timestamp of the tool call that produced the view. */
  generatedAt: string;
  /** Tool that produced it, e.g. "realist_underwrite_custom". */
  tool: string;
  disclaimer: string;
  links: AgentViewLink[];
}

export type UnderwritingRentSource =
  | "provided"
  | "actual"
  | "realist_estimate"
  | "fallback_table";

export interface UnderwritingViewProperty {
  address: string | null;
  city: string | null;
  province: string | null;
  mlsNumber: string | null;
  listPrice: number | null;
  units: number;
  beds: number | null;
  propertyType: string | null;
}

export interface UnderwritingViewDocument extends AgentViewBase {
  kind: "underwriting";
  property: UnderwritingViewProperty;
  strategyType: string;
  countryMode: "CA" | "US";
  /** The exact assumption set the agent's numbers were computed from. */
  inputs: BuyHoldInputs;
  rent: { source: UnderwritingRentSource; detail?: string };
  /** Plain-language notes on every estimated / defaulted assumption. */
  assumptionNotes: string[];
  analysisId: string | null;
}

export interface ReportViewDocument extends AgentViewBase {
  kind: "report";
  sections: AgentViewSection[];
}

export type AgentViewDocument = UnderwritingViewDocument | ReportViewDocument;

/** The `view` block attached to tool results so agents can hand the human a link. */
export interface AgentViewRef {
  url: string;
  kind: AgentViewKind | "multiplex_model";
  title: string;
  /** Tells the agent what the link is and that it should be shown to the user. */
  instructions: string;
}

export function isAgentViewDocument(value: unknown): value is AgentViewDocument {
  if (!value || typeof value !== "object") return false;
  const doc = value as Partial<AgentViewDocument>;
  if (doc.version !== AGENT_VIEW_DOCUMENT_VERSION) return false;
  if (typeof doc.title !== "string") return false;
  if (doc.kind === "underwriting") {
    return !!(doc as UnderwritingViewDocument).inputs && typeof (doc as UnderwritingViewDocument).inputs === "object";
  }
  if (doc.kind === "report") return Array.isArray((doc as ReportViewDocument).sections);
  return false;
}

export function formatTableCell(value: TableCell, format: TableCellFormat = "text"): string {
  if (value == null || value === "") return "—";
  if (typeof value === "string") return value;
  if (!Number.isFinite(value)) return "—";
  switch (format) {
    case "currency":
      return new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    case "percent":
      return `${value.toFixed(Math.abs(value) < 10 ? 2 : 1)}%`;
    case "number":
      return new Intl.NumberFormat("en-CA", { maximumFractionDigits: 2 }).format(value);
    default:
      return String(value);
  }
}
